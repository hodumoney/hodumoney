// lib/stockanalysis.js — StockAnalysis + Yahoo Finance hybrid (US + KR 지원)

const SA_US = "https://stockanalysis.com/stocks";
const SA_KRX = "https://stockanalysis.com/quote/krx";
const UA = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

// 한국 종목 판별: 6자리 숫자 (005930, 000660 등)
function isKrxTicker(ticker) {
  return /^\d{6}$/.test(ticker.trim());
}

// Yahoo Finance용 한국 티커 변환: 005930 → 005930.KS
function toYahooKrxTicker(ticker) {
  return `${ticker}.KS`;
}

async function fetchPage(ticker, path, quarterly) {
  const q = quarterly ? "?p=quarterly" : "";
  const normalizedPath = path || "";

  // 한국 종목은 /quote/krx/005930/ 경로 사용
  const base = isKrxTicker(ticker) ? SA_KRX : SA_US;
  const url = `${base}/${ticker.toLowerCase()}/${normalizedPath}${q}`;

  try {
    const res = await fetch(url, {
      headers: UA,
      cache: "no-store",
    });

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function stripHtml(text) {
  return (text || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function toGlobalRegex(regex) {
  if (!(regex instanceof RegExp)) {
    return new RegExp(regex, "g");
  }
  return regex.global ? regex : new RegExp(regex.source, regex.flags + "g");
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

    const name = stripHtml(nm[1]);
    const vals = [];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];

    for (let j = 1; j < cells.length; j++) {
      let v = stripHtml(cells[j][1]).replace(/,/g, "").replace("%", "");
      let n = v === "-" || v === "" || v.toLowerCase() === "n/a" ? 0 : parseFloat(v);
      vals.push(Number.isNaN(n) ? 0 : n);
    }

    map[name] = vals;
  }

  return map;
}

function getRow(map, aliases) {
  const keys = Object.keys(map);

  for (const a of aliases) {
    const target = a.toLowerCase();

    for (const k of keys) {
      if (k.toLowerCase() === target) return map[k];
    }

    for (const k of keys) {
      if (k.toLowerCase().includes(target)) return map[k];
    }
  }

  return [0, 0, 0, 0, 0];
}

function extractLabels(html) {
  if (!html) return [];

  const m = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/);
  if (!m) return [];

  return [...m[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)]
    .slice(1)
    .map((c) => stripHtml(c[1]))
    .filter((t) => t && t !== "TTM" && t !== "Current");
}

function parseNum(text) {
  if (!text) return 0;

  const cleaned = text.replace(/,/g, "").replace("$", "").replace("₩", "").replace("KRW", "").trim();
  const mult = { T: 1e12, B: 1e9, M: 1e6, K: 1e3 };
  const last = cleaned.slice(-1).toUpperCase();

  if (mult[last]) {
    return (parseFloat(cleaned.slice(0, -1)) || 0) * mult[last];
  }

  return parseFloat(cleaned) || 0;
}

function makeKoreanCompanyDescription({ name, sector, industry, exchange, rawDescription }) {
  const clean = (rawDescription || "").replace(/\s+/g, " ").trim();
  const hasKorean = /[가-힣]/.test(clean);
  const lower = clean.toLowerCase();
  const noisySignals = ["revenue was", "net income", "fiscal year", "earnings per share", "eps was", "real-time price", "chart, key statistics"];
  const isNoisy = noisySignals.some((sig) => lower.includes(sig));

  const sectorText = sector ? `${sector} 섹터` : "글로벌 시장";
  const industryText = industry ? `${industry} 산업` : "관련 산업";
  const exchangeText = exchange ? `${exchange} 상장` : "상장";

  if (!clean || isNoisy || !hasKorean) {
    return `${name}는 ${sectorText}에 속한 ${industryText} 기업으로, ${exchangeText} 종목입니다.`;
  }

  return `${name}는 ${sectorText}에 속한 ${industryText} 기업입니다. ${clean}`;
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

/**
 * Fetch reliable quote data from Yahoo Finance v8 chart API
 * 한국 종목: 005930.KS 형식 사용
 */
async function getYahooQuote(ticker) {
  try {
    const yahooTicker = isKrxTicker(ticker) ? toYahooKrxTicker(ticker) : ticker;
    const chartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooTicker
    )}?range=1y&interval=1d`;

    const res = await fetch(chartUrl, { headers: UA, cache: "no-store" });
    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta || {};
    const closes = result.indicators?.quote?.[0]?.close || [];
    const highs = result.indicators?.quote?.[0]?.high || [];
    const lows = result.indicators?.quote?.[0]?.low || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];

    const price = meta.regularMarketPrice || 0;

    const validHighs = highs.filter((v) => typeof v === "number" && isFinite(v));
    const validLows = lows.filter((v) => typeof v === "number" && isFinite(v));

    const yearHigh = validHighs.length > 0 ? Math.max(...validHighs) : 0;
    const yearLow = validLows.length > 0 ? Math.min(...validLows) : 0;

    const previousClose = meta.chartPreviousClose || meta.previousClose || 0;
    const dailyChange = price && previousClose ? (price - previousClose) / previousClose : 0;

    const recentVolumes = volumes.slice(-20).filter((v) => typeof v === "number" && v > 0);
    const avgVolume =
      recentVolumes.length > 0
        ? Math.round(recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length)
        : 0;

    return {
      price,
      yearHigh,
      yearLow,
      dailyChange,
      volume: avgVolume,
      exchange: meta.exchangeName || "",
      currency: meta.currency || (isKrxTicker(ticker) ? "KRW" : "USD"),
    };
  } catch (e) {
    console.error("Yahoo quote error:", e.message);
    return null;
  }
}

export async function getOverview(ticker) {
  const [statsHtml, overviewHtml, yahooQuote] = await Promise.all([
    fetchPage(ticker, "statistics/", false),
    fetchPage(ticker, "", false),
    getYahooQuote(ticker),
  ]);

  if (!statsHtml && !overviewHtml && !yahooQuote) return null;

  const stats = parseStatsTables(statsHtml || "");
  const html = overviewHtml || statsHtml || "";

  const nameMatch = html.match(/<h1[^>]*>([^<]+)/);
  const companyName = nameMatch
    ? nameMatch[1].replace(/\s*\([^)]*\)\s*$/, "").trim()
    : ticker;

  const marketCap = parseNum(stats["Market Cap"] || "0");
  const beta = parseFloat(stats["Beta (5Y)"]?.replace(/,/g, "") || "0") || 0;

  const sectorMatch = html.match(
    /Sector\s*<\/[^>]+>\s*<[^>]+>\s*(?:<a[^>]*>)?([^<]+)/
  );
  const industryMatch = html.match(
    /Industry\s*<\/[^>]+>\s*<[^>]+>\s*(?:<a[^>]*>)?([^<]+)/
  );

  const summaryMatch = html.match(/(\b[A-Z][^<]{40,320}\.)/);
  const rawDescription = summaryMatch ? stripHtml(summaryMatch[1]) : "";

  let price = yahooQuote?.price || 0;
  let yearHigh = yahooQuote?.yearHigh || 0;
  let yearLow = yahooQuote?.yearLow || 0;
  let dailyChange = yahooQuote?.dailyChange || 0;
  let volume = yahooQuote?.volume || 0;
  let exchange = yahooQuote?.exchange || "";
  const currency = yahooQuote?.currency || (isKrxTicker(ticker) ? "KRW" : "USD");

  if (!price) {
    const pricePatterns = [
      />([\d]{1,7}[,.]?[\d]*\.?[\d]*)<\/[^>]*>\s*<[^>]*>[^<]*[+-][\d]/g,
      />([\d]{1,7}[,.]?[\d]*\.?[\d]*)<\/span>/g,
    ];
    for (const rawPattern of pricePatterns) {
      if (price > 0) break;
      const pat = toGlobalRegex(rawPattern);
      const matches = [...html.matchAll(pat)];
      for (const m of matches) {
        const p = parseFloat(m[1].replace(/,/g, ""));
        if (p > 0) {
          price = p;
          break;
        }
      }
    }
  }

  if (!yearHigh || !yearLow) {
    const overviewStats = parseStatsTables(html);
    const range52 = overviewStats["52-Week Range"] || stats["52-Week Range"] || "";
    const rangeMatch = range52.match(/([\d,.]+)\s*-\s*([\d,.]+)/);
    if (rangeMatch) {
      yearLow = yearLow || parseFloat(rangeMatch[1].replace(/,/g, "")) || 0;
      yearHigh = yearHigh || parseFloat(rangeMatch[2].replace(/,/g, "")) || 0;
    }
  }

  if (!volume) {
    volume = parseNum(stats["Average Volume (20 Days)"] || "0");
  }

  if (!exchange) {
    const exMatch = html.match(/(NASDAQ|NYSE|AMEX|TSX|LSE|KRX|KOSDAQ)\s*:?\s*[A-Z0-9]+/);
    if (exMatch) exchange = exMatch[1];
  }

  if (!dailyChange) {
    const prevClose =
      parseFloat(parseStatsTables(html)["Previous Close"]?.replace(/,/g, "") || "0") || 0;
    if (price && prevClose) dailyChange = (price - prevClose) / prevClose;
  }

  const sector = sectorMatch ? sectorMatch[1].trim() : "";
  const industry = industryMatch ? industryMatch[1].trim() : "";
  const description = makeKoreanCompanyDescription({
    name: companyName,
    sector,
    industry,
    exchange,
    rawDescription,
  });

  return {
    name: companyName,
    ticker: ticker.toUpperCase(),
    exchange,
    description,
    sector,
    industry,
    price,
    marketCap,
    beta,
    volume,
    yearHigh,
    yearLow,
    dailyChange,
    currency,
  };
}

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
    sharesOut: getRow(data, [
      "Shares Outstanding (Diluted)",
      "Shares Outstanding (Basic)",
    ]),
  };
}

export async function getBalance(ticker, quarterly) {
  const html = await fetchPage(ticker, "financials/balance-sheet/", quarterly);
  const data = parseTable(html);

  return {
    totalAssets: getRow(data, ["Total Assets"]),
    currentLiab: getRow(data, ["Total Current Liabilities"]),
    equity: getRow(data, ["Total Equity", "Shareholders' Equity"]),
  };
}

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

export async function getHistory(ticker, period = "1Y") {
  const rangeMap = {
    "1D": "5d",
    "1M": "1mo",
    "3M": "3mo",
    "6M": "6mo",
    "1Y": "1y",
    "3Y": "3y",
    "5Y": "5y",
    "10Y": "10y",
    "MAX": "max",
  };

  const range = rangeMap[period] || "1y";

  try {
    const yahooTicker = isKrxTicker(ticker) ? toYahooKrxTicker(ticker) : ticker;
    const yahooUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooTicker
    )}?range=${range}&interval=1d`;
    const yahooRes = await fetch(yahooUrl, { headers: UA, cache: "no-store" });

    if (yahooRes.ok) {
      const json = await yahooRes.json();
      const result = json?.chart?.result?.[0];
      const timestamps = result?.timestamp || [];
      const closes = result?.indicators?.quote?.[0]?.close || [];

      const points = timestamps
        .map((ts, i) => {
          const close = closes[i];
          if (typeof close !== "number" || !isFinite(close)) return null;
          return {
            date: new Date(ts * 1000).toISOString().slice(0, 10),
            price: close,
          };
        })
        .filter(Boolean);

      if (points.length > 0) return points;
    }
  } catch {
    // Fall through to StockAnalysis parsing fallback
  }

  const html = await fetchPage(ticker, "history/", false);
  if (!html) return [];

  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return [];

  const rows = [];

  for (const tr of tbodyMatch[1].split("</tr>")) {
    if (!tr.includes("<td")) continue;

    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (cells.length < 5) continue;

    const date = stripHtml(cells[0][1]);
    const close = parseFloat(stripHtml(cells[4][1]).replace(/,/g, ""));

    if (date && !Number.isNaN(close)) {
      rows.push({ date, price: close });
    }
  }

  return rows.reverse();
}
