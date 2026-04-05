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
    const validCloses = closes.filter(v => typeof v === "number" && isFinite(v));

    const calcReturn = (daysAgo) => {
      if (validCloses.length < daysAgo + 1) return null;
      const past = validCloses[validCloses.length - 1 - daysAgo];
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
        "1Y": calcReturn(Math.max(0, validCloses.length - 2)),
      },
    };
  } catch {
    return null;
  }
}

export async function getEtfOverview(ticker) {
  const [overviewHtml, yahooQuote] = await Promise.all([
    fetchEtfPage(ticker, ""),
    getYahooEtfQuote(ticker),
  ]);

  if (!overviewHtml && !yahooQuote) return null;

  const stats = parseStatsTables(overviewHtml || "");
  const html = overviewHtml || "";

  const nameMatch = html.match(/<h1[^>]*>([^<]+)/);
  const name = nameMatch ? nameMatch[1].replace(/\s*\([^)]*\)\s*$/, "").trim() : ticker;

  const descMatch = html.match(/(?:The fund|The ETF|This ETF|The investment)[^<]{20,400}\./);
  const description = descMatch ? stripHtml(descMatch[0]) : "";

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
    expenseRatio: stats["Expense Ratio"] || "-",
    aum: stats["Assets Under Management"] || stats["AUM"] || stats["Net Assets"] || "-",
    category: stats["Category"] || stats["Asset Class"] || "-",
    issuer: stats["Issuer"] || stats["Fund Family"] || "-",
    index: stats["Index Tracked"] || stats["Benchmark"] || "-",
    holdings: stats["Holdings"] || stats["Number of Holdings"] || "-",
    inception: stats["Inception Date"] || "-",
    divYield: stats["Dividend Yield"] || stats["Yield"] || "-",
    pe: stats["PE Ratio"] || "-",
    beta: stats["Beta (5Y)"] || "-",
  };
}

export async function getEtfHoldings(ticker) {
  const html = await fetchEtfPage(ticker, "holdings/");
  if (!html) return [];

  const holdings = [];

  // Method 1: Parse table rows
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (tbodyMatch) {
    const rows = tbodyMatch[1].split("</tr>");
    for (const row of rows) {
      if (!row.includes("<td")) continue;
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
      if (cells.length < 2) continue;

      const texts = cells.map(c => stripHtml(c[1]));

      // Try to find: symbol (uppercase 1-6 chars), weight (number with optional %)
      let symbol = "", name = "", weight = "";
      for (const t of texts) {
        if (!symbol && /^[A-Z][A-Z0-9.]{0,7}$/.test(t)) symbol = t;
        else if (!weight && /^\d+\.?\d*%?$/.test(t.replace(",", ""))) weight = t.replace("%", "").replace(",", "");
        else if (!name && t.length > 1 && !/^\d+$/.test(t) && !/^[A-Z]{1,6}$/.test(t)) name = t;
      }

      // If no clear symbol found, try first non-number text
      if (!symbol && texts.length >= 2) {
        for (const t of texts) {
          if (t.length >= 1 && t.length <= 10 && !/^\d+\.?\d*%?$/.test(t) && !/^\d+$/.test(t)) {
            symbol = t;
            break;
          }
        }
      }

      // Weight: try last column that looks numeric
      if (!weight) {
        for (let j = texts.length - 1; j >= 0; j--) {
          const cleaned = texts[j].replace("%", "").replace(",", "").trim();
          if (/^\d+\.?\d*$/.test(cleaned) && parseFloat(cleaned) < 100) {
            weight = cleaned;
            break;
          }
        }
      }

      if (symbol && weight) {
        holdings.push({
          symbol: String(symbol),
          name: String(name || symbol),
          weight: String(weight),
        });
      }

      if (holdings.length >= 15) break;
    }
  }

  return holdings;
}

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
