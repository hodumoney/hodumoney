// lib/etfanalysis.js — StockAnalysis ETF + Yahoo Finance hybrid

const SA_ETF = "https://stockanalysis.com/etf";
const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

function stripHtml(text) {
  return (text || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
}

function parseNum(text) {
  if (!text) return 0;
  const cleaned = text.replace(/,/g, "").replace("$", "").replace("%", "").trim();
  const mult = { T: 1e12, B: 1e9, M: 1e6, K: 1e3 };
  const last = cleaned.slice(-1).toUpperCase();
  if (mult[last]) return (parseFloat(cleaned.slice(0, -1)) || 0) * mult[last];
  return parseFloat(cleaned) || 0;
}

async function fetchEtfPage(ticker, path) {
  const url = `${SA_ETF}/${ticker.toLowerCase()}/${path || ""}`;
  try {
    const res = await fetch(url, { headers: UA, cache: "no-store" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseStatsTables(html) {
  if (!html) return {};
  const data = {};
  const allTds = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
  for (let i = 0; i < allTds.length - 1; i += 2) {
    const key = stripHtml(allTds[i][1]);
    const val = stripHtml(allTds[i + 1][1]);
    if (key) data[key] = val;
  }
  return data;
}

// Yahoo quote for ETF
async function getYahooEtfQuote(ticker) {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d`;
    const res = await fetch(url, { headers: UA, cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta || {};
    const closes = result.indicators?.quote?.[0]?.close || [];
    const highs = result.indicators?.quote?.[0]?.high || [];
    const lows = result.indicators?.quote?.[0]?.low || [];

    const price = meta.regularMarketPrice || 0;
    const previousClose = meta.chartPreviousClose || meta.previousClose || 0;
    const dailyChange = price && previousClose ? ((price - previousClose) / previousClose) * 100 : 0;

    const validHighs = highs.filter(v => typeof v === "number" && isFinite(v));
    const validLows = lows.filter(v => typeof v === "number" && isFinite(v));

    // Calculate period returns from closes
    const validCloses = closes.filter(v => typeof v === "number" && isFinite(v));
    const calcReturn = (daysAgo) => {
      if (validCloses.length < daysAgo) return null;
      const past = validCloses[validCloses.length - daysAgo];
      const now = validCloses[validCloses.length - 1];
      return past ? ((now - past) / past) * 100 : null;
    };

    return {
      price,
      dailyChange,
      yearHigh: validHighs.length > 0 ? Math.max(...validHighs) : 0,
      yearLow: validLows.length > 0 ? Math.min(...validLows) : 0,
      exchange: meta.exchangeName || "",
      returns: {
        "1M": calcReturn(21),
        "3M": calcReturn(63),
        "6M": calcReturn(126),
        "1Y": calcReturn(validCloses.length - 1),
      },
    };
  } catch {
    return null;
  }
}

/**
 * ETF 개요 정보
 */
export async function getEtfOverview(ticker) {
  const [overviewHtml, yahooQuote] = await Promise.all([
    fetchEtfPage(ticker, ""),
    getYahooEtfQuote(ticker),
  ]);

  if (!overviewHtml && !yahooQuote) return null;

  const stats = parseStatsTables(overviewHtml || "");
  const html = overviewHtml || "";

  // ETF name
  const nameMatch = html.match(/<h1[^>]*>([^<]+)/);
  const name = nameMatch ? nameMatch[1].replace(/\s*\([^)]*\)\s*$/, "").trim() : ticker;

  // Description
  const descMatch = html.match(/(?:The fund|The ETF|This ETF|The investment)[^<]{20,400}\./);
  const description = descMatch ? stripHtml(descMatch[0]) : "";

  // Parse stats
  const expenseRatio = stats["Expense Ratio"] || "-";
  const aum = stats["Assets Under Management"] || stats["AUM"] || stats["Net Assets"] || "-";
  const category = stats["Category"] || stats["Asset Class"] || "-";
  const issuer = stats["Issuer"] || stats["Fund Family"] || "-";
  const index = stats["Index Tracked"] || stats["Benchmark"] || "-";
  const holdings = stats["Holdings"] || stats["Number of Holdings"] || "-";
  const inception = stats["Inception Date"] || "-";
  const divYield = stats["Dividend Yield"] || stats["Yield"] || "-";
  const pe = stats["PE Ratio"] || "-";
  const beta = stats["Beta (5Y)"] || "-";

  return {
    name,
    ticker: ticker.toUpperCase(),
    description,
    price: yahooQuote?.price || 0,
    dailyChange: yahooQuote?.dailyChange || 0,
    yearHigh: yahooQuote?.yearHigh || 0,
    yearLow: yahooQuote?.yearLow || 0,
    exchange: yahooQuote?.exchange || "",
    returns: yahooQuote?.returns || {},
    expenseRatio,
    aum,
    category,
    issuer,
    index,
    holdings,
    inception,
    divYield,
    pe,
    beta,
  };
}

/**
 * ETF 구성 종목 (상위 15개)
 */
export async function getEtfHoldings(ticker) {
  const html = await fetchEtfPage(ticker, "holdings/");
  if (!html) return [];

  const holdings = [];
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return [];

  const rows = tbodyMatch[1].split("</tr>");
  for (const row of rows) {
    if (!row.includes("<td")) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (cells.length < 3) continue;

    // Typical columns: #, Symbol, Name, Weight
    const texts = cells.map(c => stripHtml(c[1]));

    // Find symbol (usually 2-5 uppercase letters) and weight (ends with %)
    let symbol = "", name = "", weight = "";
    for (const t of texts) {
      if (/^[A-Z]{1,6}$/.test(t) && !symbol) symbol = t;
      else if (t.includes("%") && !weight) weight = t;
      else if (t.length > 2 && !name && !/^\d+$/.test(t)) name = t;
    }

    if (symbol && weight) {
      holdings.push({ symbol, name: name || symbol, weight: weight.replace("%", "").trim() });
    }

    if (holdings.length >= 15) break;
  }

  return holdings;
}

/**
 * ETF 배당 정보
 */
export async function getEtfDividend(ticker) {
  const html = await fetchEtfPage(ticker, "dividend/");
  if (!html) return null;

  const stats = parseStatsTables(html);

  return {
    yield: stats["Dividend Yield"] || stats["Yield"] || "-",
    annualDiv: stats["Annual Dividend"] || stats["Dividend Per Share"] || "-",
    frequency: stats["Payout Frequency"] || stats["Payment Frequency"] || "-",
    exDate: stats["Ex-Dividend Date"] || "-",
    payDate: stats["Pay Date"] || stats["Payment Date"] || "-",
    growthRate3Y: stats["3-Year Growth Rate"] || "-",
    growthRate5Y: stats["5-Year Growth Rate"] || "-",
  };
}
