// lib/stockanalysis.js — 100% StockAnalysis.com (no API key)

const SA = "https://stockanalysis.com/stocks";
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };

async function fetchPage(ticker, path, quarterly) {
  const q = quarterly ? "?p=quarterly" : "";
  const url = `${SA}/${ticker.toLowerCase()}/${path}${q}`;
  try {
    const res = await fetch(url, { headers: UA, cache: "no-store" });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

function parseTable(html) {
  if (!html) return {};
  const map = {};
  const m = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!m) return map;
  for (const row of m[1].split("</tr>")) {
    if (!row.includes("<td")) continue;
    const nm = row.match(/<td[^>]*>(.*?)<\/td>/);
    if (!nm) continue;
    const name = nm[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
    const vals = [];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    for (let j = 1; j < cells.length; j++) {
      let v = cells[j][1].replace(/<[^>]*>/g, "").trim().replace(/,/g, "").replace("%", "");
      let n = (v === "-" || v === "" || v === "n/a") ? 0 : parseFloat(v);
      vals.push(isNaN(n) ? 0 : n);
    }
    map[name] = vals;
  }
  return map;
}

function getRow(map, aliases) {
  const keys = Object.keys(map);
  for (const a of aliases) {
    const t = a.toLowerCase();
    for (const k of keys) if (k.toLowerCase() === t) return map[k];
    for (const k of keys) if (k.toLowerCase().includes(t)) return map[k];
  }
  return [0, 0, 0, 0, 0];
}

function extractLabels(html) {
  if (!html) return [];
  const m = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/);
  if (!m) return [];
  return [...m[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)]
    .slice(1).map(c => c[1].replace(/<[^>]*>/g, "").trim())
    .filter(t => t && t !== "TTM" && t !== "Current");
}

function parseNum(text) {
  if (!text) return 0;
  text = text.replace(/,/g, "").replace("$", "").trim();
  const mult = { T: 1e12, B: 1e9, M: 1e6, K: 1e3 };
  const last = text.slice(-1).toUpperCase();
  if (mult[last]) return parseFloat(text.slice(0, -1)) * mult[last];
  return parseFloat(text) || 0;
}

// ── Get all info from Statistics page (most reliable) ──
function parseStatsTables(html) {
  if (!html) return {};
  const data = {};
  // Parse all td pairs as key-value
  const allTds = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
  for (let i = 0; i < allTds.length - 1; i += 2) {
    const key = allTds[i][1].replace(/<[^>]*>/g, "").trim();
    const val = allTds[i + 1][1].replace(/<[^>]*>/g, "").trim();
    if (key) data[key] = val;
  }
  return data;
}

// ── Overview (price, marketCap, beta, etc) from statistics + overview ──
export async function getOverview(ticker) {
  // Fetch both pages in parallel
  const [statsHtml, overviewHtml] = await Promise.all([
    fetchPage(ticker, "statistics/", false),
    fetchPage(ticker, "", false),
  ]);

  if (!statsHtml && !overviewHtml) return null;

  // --- Parse statistics page ---
  const stats = parseStatsTables(statsHtml || "");

  // --- Parse overview page for price and basic info ---
  const html = overviewHtml || statsHtml || "";

  // Company name from h1
  const nameMatch = html.match(/<h1[^>]*>([^<]+)/);
  const companyName = nameMatch ? nameMatch[1].replace(/\s*\([^)]*\)\s*$/, "").trim() : ticker;

  // Price: look for the main price number pattern in overview page
  // Pattern: large number followed by change info
  let price = 0;
  // Try multiple patterns
  const pricePatterns = [
    />([\d]{1,5}\.[\d]{2})<\/[^>]*>\s*<[^>]*>[^<]*[+-][\d]/,
    />([\d]{1,5}\.[\d]{2})<\/span>/g,
  ];
  for (const pat of pricePatterns) {
    if (price > 0) break;
    const matches = [...html.matchAll(pat instanceof RegExp ? pat : new RegExp(pat))];
    for (const m of matches) {
      const p = parseFloat(m[1]);
      if (p > 1 && p < 100000) { price = p; break; }
    }
  }

  // If still no price, try "Last Close Price" from stats
  if (!price && stats["Last Close Price"]) {
    price = parseFloat(stats["Last Close Price"].replace(/,/g, "")) || 0;
  }

  // Exchange from "NASDAQ: NVDA" or "NYSE: TSLA" pattern
  let exchange = "";
  const exMatch = html.match(/(NASDAQ|NYSE|AMEX|TSX|LSE)\s*:\s*[A-Z]+/);
  if (exMatch) exchange = exMatch[1];

  // Market cap
  const marketCap = parseNum(stats["Market Cap"] || "0");

  // Volume
  const volume = parseNum(stats["Average Volume (20 Days)"] || "0");

  // Beta
  const beta = parseFloat(stats["Beta (5Y)"]?.replace(/,/g, "") || "0") || 0;

  // 52-week range from overview page
  let yearLow = 0, yearHigh = 0;
  const rangeMatch = html.match(/([\d.]+)\s*-\s*([\d.]+)/);
  // Look specifically for 52-Week Range in overview td pairs
  const overviewStats = parseStatsTables(html);
  const range52 = overviewStats["52-Week Range"] || "";
  const rm = range52.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (rm) { yearLow = parseFloat(rm[1]); yearHigh = parseFloat(rm[2]); }

  // Previous close for dailyChange
  const prevClose = parseFloat(overviewStats["Previous Close"]?.replace(/,/g, "") || "0") || 0;
  const dailyChange = price && prevClose ? (price - prevClose) / prevClose : 0;

  // Description from overview
  let description = "";
  const descPatterns = [
    /class="[^"]*"[^>]*>([A-Z][^<]{20,200}\.)\s*</,
    />((?:[A-Z][a-z]+\s(?:Inc|Corp|Co|Ltd|LLC)?\.?\s)?(?:designs|develops|operates|provides|manufactures|engages|is a)[^<]{10,200}\.)/,
  ];
  for (const dp of descPatterns) {
    if (description) break;
    const dm = html.match(dp);
    if (dm) description = dm[1].split(".")[0] + ".";
  }

  // Sector, Industry
  const sectorMatch = html.match(/Sector\s*<\/[^>]+>\s*<[^>]+>\s*(?:<a[^>]*>)?([^<]+)/);
  const industryMatch = html.match(/Industry\s*<\/[^>]+>\s*<[^>]+>\s*(?:<a[^>]*>)?([^<]+)/);

  return {
    name: companyName,
    ticker: ticker.toUpperCase(),
    exchange,
    description,
    sector: sectorMatch ? sectorMatch[1].trim() : "",
    industry: industryMatch ? industryMatch[1].trim() : "",
    price,
    marketCap,
    beta,
    volume,
    yearHigh,
    yearLow,
    dailyChange,
  };
}

// ── Income Statement ──
export async function getIncome(ticker, quarterly) {
  const html = await fetchPage(ticker, "financials/", quarterly);
  const data = parseTable(html);
  return {
    labels: extractLabels(html),
    revenue: getRow(data, ["Revenue", "Total Revenue"]),
    grossProfit: getRow(data, ["Gross Profit"]),
    operatingIncome: getRow(data, ["Operating Income"]),
    netIncome: getRow(data, ["Net Income"]),
    ebitda: getRow(data, ["EBITDA"]),
    eps: getRow(data, ["EPS (Diluted)", "EPS (Basic)", "EPS"]),
    sharesOut: getRow(data, ["Shares Outstanding (Diluted)", "Shares Outstanding (Basic)"]),
  };
}

// ── Balance Sheet ──
export async function getBalance(ticker, quarterly) {
  const html = await fetchPage(ticker, "financials/balance-sheet/", quarterly);
  return {
    totalAssets: getRow(parseTable(html), ["Total Assets"]),
    currentLiab: getRow(parseTable(html), ["Total Current Liabilities"]),
    equity: getRow(parseTable(html), ["Total Equity", "Shareholders' Equity"]),
  };
}

// ── Cash Flow ──
export async function getCashFlow(ticker, quarterly) {
  const html = await fetchPage(ticker, "financials/cash-flow-statement/", quarterly);
  const data = parseTable(html);
  return {
    fcf: getRow(data, ["Free Cash Flow"]),
    opCash: getRow(data, ["Operating Cash Flow"]),
    invCash: getRow(data, ["Investing Cash Flow"]),
    finCash: getRow(data, ["Financing Cash Flow"]),
    netChange: getRow(data, ["Net Change in Cash", "Net Cash Flow"]),
  };
}

// ── Ratios ──
export async function getRatios(ticker, quarterly) {
  const html = await fetchPage(ticker, "financials/ratios/", quarterly);
  const data = parseTable(html);
  return {
    pe: getRow(data, ["PE Ratio"]),
    pb: getRow(data, ["PB Ratio"]),
    deRatio: getRow(data, ["Debt / Equity Ratio"]),
    roe: getRow(data, ["Return on Equity (ROE)"]),
    divYield: getRow(data, ["Dividend Yield"]),
    evEbitda: getRow(data, ["EV / EBITDA", "EV/EBITDA"]),
    peg: getRow(data, ["PEG Ratio"]),
  };
}

// ── Historical Price Data ──
export async function getHistory(ticker) {
  const html = await fetchPage(ticker, "history/", false);
  if (!html) return [];
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return [];
  const rows = [];
  for (const tr of tbodyMatch[1].split("</tr>")) {
    if (!tr.includes("<td")) continue;
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (cells.length < 5) continue;
    const date = cells[0][1].replace(/<[^>]*>/g, "").trim();
    const close = parseFloat(cells[4][1].replace(/<[^>]*>/g, "").replace(/,/g, "").trim());
    if (date && !isNaN(close)) rows.push({ date, price: close });
  }
  return rows.reverse();
}
