// lib/stockanalysis.js — StockAnalysis.com only (no API key needed!)

const SA_BASE = "https://stockanalysis.com/stocks";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };

async function fetchPage(ticker, path, quarterly) {
  const q = quarterly ? "?p=quarterly" : "";
  const url = `${SA_BASE}/${ticker.toLowerCase()}/${path}${q}`;
  try {
    const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    return null;
  }
}

function parseTable(html) {
  if (!html) return {};
  const map = {};
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return map;
  const rows = tbodyMatch[1].split("</tr>");
  for (const row of rows) {
    if (!row.includes("<td")) continue;
    const nameMatch = row.match(/<td[^>]*>(.*?)<\/td>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
    const values = [];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    for (let j = 1; j < cells.length; j++) {
      let v = cells[j][1].replace(/<[^>]*>/g, "").trim();
      let num = 0;
      if (v !== "-" && v !== "" && v !== "n/a") {
        v = v.replace(/,/g, "").replace("%", "");
        num = parseFloat(v);
        if (isNaN(num)) num = 0;
      }
      values.push(num);
    }
    map[name] = values;
  }
  return map;
}

function getRow(map, aliases) {
  const keys = Object.keys(map);
  for (const alias of aliases) {
    const t = alias.toLowerCase();
    for (const k of keys) {
      if (k.toLowerCase() === t) return map[k];
    }
    for (const k of keys) {
      if (k.toLowerCase().includes(t)) return map[k];
    }
  }
  return [0, 0, 0, 0, 0];
}

function extractLabels(html) {
  if (!html) return [];
  const theadMatch = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/);
  if (!theadMatch) return [];
  const cells = [...theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)];
  const labels = [];
  for (let i = 1; i < cells.length; i++) {
    const t = cells[i][1].replace(/<[^>]*>/g, "").trim();
    if (t && t !== "TTM" && t !== "Current") labels.push(t);
  }
  return labels;
}

// ── Overview (price, marketCap, beta, description etc) ──
export async function getOverview(ticker) {
  const html = await fetchPage(ticker, "", false);
  if (!html) return null;

  const extract = (pattern) => {
    const m = html.match(pattern);
    return m ? m[1].replace(/<[^>]*>/g, "").trim() : "";
  };

  const extractNum = (text) => {
    if (!text) return 0;
    text = text.replace(/,/g, "").replace("$", "").trim();
    const multipliers = { T: 1e12, B: 1e9, M: 1e6, K: 1e3 };
    const last = text.slice(-1).toUpperCase();
    if (multipliers[last]) {
      return parseFloat(text.slice(0, -1)) * multipliers[last];
    }
    return parseFloat(text) || 0;
  };

  // Company name from h1
  const nameMatch = html.match(/<h1[^>]*>([^<]+)/);
  const companyName = nameMatch ? nameMatch[1].replace(/\s*\([^)]*\)\s*$/, "").trim() : ticker;

  // Price
  const priceMatch = html.match(/class="[^"]*"[^>]*>(\d[\d,.]*)<\/span>\s*<span[^>]*>[^<]*[+-]/);
  let price = 0;
  if (priceMatch) price = parseFloat(priceMatch[1].replace(/,/g, ""));

  // Try another price pattern
  if (!price) {
    const p2 = html.match(/>(\d{1,5}\.\d{2})<\/span>/);
    if (p2) price = parseFloat(p2[1]);
  }

  // Parse the two info tables
  const tableData = {};
  const allTds = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
  for (let i = 0; i < allTds.length - 1; i += 2) {
    const key = allTds[i][1].replace(/<[^>]*>/g, "").trim();
    const val = allTds[i + 1][1].replace(/<[^>]*>/g, "").trim();
    if (key) tableData[key] = val;
  }

  const marketCap = extractNum(tableData["Market Cap"]?.split(/[+-]/)[0]?.trim() || "0");
  const peRatio = parseFloat(tableData["PE Ratio"]?.replace(/,/g, "") || "0") || 0;
  const beta = parseFloat(tableData["Beta"]?.replace(/,/g, "") || "0") || 0;
  const volume = extractNum(tableData["Volume"] || "0");
  const range52 = tableData["52-Week Range"] || "";
  const dividend = tableData["Dividend"] || "";

  let yearLow = 0, yearHigh = 0;
  const rangeMatch = range52.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (rangeMatch) {
    yearLow = parseFloat(rangeMatch[1]);
    yearHigh = parseFloat(rangeMatch[2]);
  }

  const prevClose = parseFloat(tableData["Previous Close"]?.replace(/,/g, "") || "0") || 0;
  const change = price && prevClose ? (price - prevClose) / prevClose : 0;

  // Description
  const descMatch = html.match(/About AAPL|About [A-Z]+[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
  let description = "";
  if (descMatch && descMatch[1]) {
    description = descMatch[1].replace(/<[^>]*>/g, "").trim().split(".")[0] + ".";
  }
  // Fallback: look for company description pattern
  if (!description || description.length < 10) {
    const descMatch2 = html.match(/designs,[\s\S]*?\./);
    if (descMatch2) description = ticker + " " + descMatch2[0];
  }

  // Sector, Industry
  const sectorMatch = html.match(/Sector\s*<\/[^>]+>\s*<[^>]+>\s*<a[^>]*>([^<]+)/);
  const industryMatch = html.match(/Industry\s*<\/[^>]+>\s*<[^>]+>\s*<a[^>]*>([^<]+)/);
  const exchangeMatch = html.match(/Stock Exchange\s*<\/[^>]+>\s*<[^>]+>([^<]+)/);

  return {
    name: companyName,
    ticker: ticker.toUpperCase(),
    exchange: exchangeMatch ? exchangeMatch[1].trim() : "",
    description,
    sector: sectorMatch ? sectorMatch[1].trim() : "",
    industry: industryMatch ? industryMatch[1].trim() : "",
    price,
    marketCap,
    peRatio,
    beta,
    volume,
    yearHigh,
    yearLow,
    dailyChange: change,
    dividend,
  };
}

// ── Income Statement ──
export async function getIncome(ticker, quarterly) {
  const html = await fetchPage(ticker, "financials/", quarterly);
  const data = parseTable(html);
  const labels = extractLabels(html);
  return {
    labels,
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
  const data = parseTable(html);
  return {
    totalAssets: getRow(data, ["Total Assets"]),
    currentLiab: getRow(data, ["Total Current Liabilities"]),
    equity: getRow(data, ["Total Equity", "Shareholders' Equity"]),
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
    opMargin: getRow(data, ["Operating Margin"]),
    netMargin: getRow(data, ["Net Profit Margin", "Profit Margin"]),
    marketCap: getRow(data, ["Market Capitalization", "Market Cap"]),
  };
}

// ── Historical Price Data ──
export async function getHistory(ticker) {
  const html = await fetchPage(ticker, "history/", false);
  if (!html) return [];
  const data = parseTable(html);
  // The Close column has price data, dates are row keys
  const rows = [];
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return [];
  const trs = tbodyMatch[1].split("</tr>");
  for (const tr of trs) {
    if (!tr.includes("<td")) continue;
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (cells.length < 5) continue;
    const date = cells[0][1].replace(/<[^>]*>/g, "").trim();
    const closeStr = cells[4][1].replace(/<[^>]*>/g, "").replace(/,/g, "").trim();
    const close = parseFloat(closeStr);
    if (date && !isNaN(close)) {
      rows.push({ date, price: close });
    }
  }
  return rows.reverse(); // oldest first
}
