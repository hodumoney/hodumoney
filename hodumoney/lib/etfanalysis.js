// lib/etfanalysis.js — StockAnalysis ETF + Yahoo Finance hybrid

const SA_ETF = "https://stockanalysis.com/etf";
const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

function stripHtml(text) {
  return (text || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
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

    // Total return = 배당 포함 수익률은 Yahoo에서 직접 못 가져오므로, 가격 수익률만 계산
    // 배당 포함 수익률은 StockAnalysis에서 가져옴
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

  // 실제 StockAnalysis key 이름 매칭 (확인된 것들)
  const totalReturn = stats["Total Return"] || null;

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
    // 실제 확인된 key 이름들
    expenseRatio: stats["Expense Ratio"] || "-",
    aum: stats["Assets"] || stats["Net Assets"] || stats["Assets Under Management"] || stats["AUM"] || "-",
    category: stats["Category"] || "-",
    issuer: stats["ETF Provider"] || stats["Issuer"] || stats["Fund Family"] || "-",
    index: stats["Index Tracked"] || stats["Benchmark"] || "-",
    holdingsCount: stats["Holdings"] || "-",
    inception: stats["Inception Date"] || "-",
    divYield: stats["Dividend Yield"] || "-",
    divTTM: stats["Dividend (ttm)"] || stats["Dividend"] || "-",
    pe: stats["PE Ratio"] || "-",
    beta: stats["Beta"] || stats["Beta (5Y)"] || "-",
    payoutFreq: stats["Payout Frequency"] || "-",
    payoutRatio: stats["Payout Ratio"] || "-",
    sharesOut: stats["Shares Out"] || "-",
    region: stats["Region"] || "-",
    assetClass: stats["Asset Class"] || "-",
    totalReturn,
  };
}

export async function getEtfHoldings(ticker) {
  const html = await fetchEtfPage(ticker, "holdings/");
  if (!html) return [];

  const holdings = [];

  // StockAnalysis holdings table: Name | Symbol | Weight
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return [];

  const rows = tbodyMatch[1].split("</tr>");
  for (const row of rows) {
    if (!row.includes("<td")) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (cells.length < 2) continue;

    const texts = cells.map(c => stripHtml(c[1]));

    // 각 cell에서 링크 안의 종목 심볼 추출
    const linkMatch = row.match(/href="\/stocks\/([^/"]+)\//);
    const symbol = linkMatch ? linkMatch[1].toUpperCase() : "";

    // 비중: 마지막에서 % 포함된 값 찾기
    let weight = "";
    for (let j = texts.length - 1; j >= 0; j--) {
      const cleaned = texts[j].replace("%", "").replace(",", "").trim();
      if (/^\d+\.?\d*$/.test(cleaned) && parseFloat(cleaned) <= 100) {
        weight = cleaned;
        break;
      }
    }

    // 이름: 첫 번째 긴 텍스트
    let name = "";
    for (const t of texts) {
      if (t.length > 3 && !/^\d+\.?\d*%?$/.test(t.replace(",","")) && t !== symbol) {
        name = t;
        break;
      }
    }

    if ((symbol || name) && weight) {
      holdings.push({
        symbol: String(symbol || name.substring(0, 6)),
        name: String(name || symbol),
        weight: String(weight),
      });
    }

    if (holdings.length >= 15) break;
  }

  return holdings;
}

export async function getEtfDividend(ticker) {
  const html = await fetchEtfPage(ticker, "dividend/");
  if (!html) return null;

  const stats = parseStatsTables(html);

  return {
    yield: stats["Dividend Yield"] || stats["Yield"] || "-",
    annualDiv: stats["Annual Dividend"] || stats["Dividend Per Share"] || stats["Dividend (ttm)"] || "-",
    frequency: stats["Payout Frequency"] || stats["Payment Frequency"] || stats["Frequency"] || "-",
    exDate: stats["Ex-Dividend Date"] || stats["Last Ex-Dividend Date"] || "-",
    payDate: stats["Pay Date"] || stats["Payment Date"] || stats["Last Pay Date"] || "-",
    growthRate3Y: stats["3-Year Growth Rate"] || stats["3Y CAGR"] || "-",
    growthRate5Y: stats["5-Year Growth Rate"] || stats["5Y CAGR"] || "-",
  };
}
