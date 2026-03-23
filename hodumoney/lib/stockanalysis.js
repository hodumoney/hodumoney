// lib/stockanalysis.js — 100% StockAnalysis.com (no API key)

const SA = "https://stockanalysis.com/stocks";
const UA = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

async function fetchPage(ticker, path, quarterly) {
  const q = quarterly ? "?p=quarterly" : "";
  const normalizedPath = path || "";
  const url = `${SA}/${ticker.toLowerCase()}/${normalizedPath}${q}`;

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

  const cleaned = text.replace(/,/g, "").replace("$", "").trim();
  const mult = { T: 1e12, B: 1e9, M: 1e6, K: 1e3 };
  const last = cleaned.slice(-1).toUpperCase();

  if (mult[last]) {
    return (parseFloat(cleaned.slice(0, -1)) || 0) * mult[last];
  }

  return parseFloat(cleaned) || 0;
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

export async function getOverview(ticker) {
  const [statsHtml, overviewHtml] = await Promise.all([
    fetchPage(ticker, "statistics/", false),
    fetchPage(ticker, "", false),
  ]);

  if (!statsHtml && !overviewHtml) return null;

  const stats = parseStatsTables(statsHtml || "");
  const html = overviewHtml || statsHtml || "";

  const nameMatch = html.match(/<h1[^>]*>([^<]+)/);
  const companyName = nameMatch
    ? nameMatch[1].replace(/\s*\([^)]*\)\s*$/, "").trim()
    : ticker;

  let price = 0;

  const pricePatterns = [
    />([\d]{1,5}\.[\d]{2})<\/[^>]*>\s*<[^>]*>[^<]*[+-][\d]/g,
    />([\d]{1,5}\.[\d]{2})<\/span>/g,
  ];

  for (const rawPattern of pricePatterns) {
    if (price > 0) break;

    const pat = toGlobalRegex(rawPattern);
    const matches = [...html.matchAll(pat)];

    for (const m of matches) {
      const p = parseFloat(m[1]);
      if (p > 1 && p < 100000) {
        price = p;
        break;
      }
    }
  }

  if (!price && stats["Last Close Price"]) {
    price = parseFloat(stats["Last Close Price"].replace(/,/g, "")) || 0;
  }

  let exchange = "";
  const exMatch = html.match(/(NASDAQ|NYSE|AMEX|TSX|LSE)\s*:\s*[A-Z]+/);
  if (exMatch) exchange = exMatch[1];

  const marketCap = parseNum(stats["Market Cap"] || "0");
  const volume = parseNum(stats["Average Volume (20 Days)"] || "0");
  const beta = parseFloat(stats["Beta (5Y)"]?.replace(/,/g, "") || "0") || 0;

  let yearLow = 0;
  let yearHigh = 0;

  const overviewStats = parseStatsTables(html);
  const range52 =
    overviewStats["52-Week Range"] ||
    overviewStats["52 Week Range"] ||
    "";
  const rangeMatch = range52.match(/([\d.]+)\s*-\s*([\d.]+)/);

  if (rangeMatch) {
    yearLow = parseFloat(rangeMatch[1]) || 0;
    yearHigh = parseFloat(rangeMatch[2]) || 0;
  }

  const statYearHigh = parseNum(
    overviewStats["52-Week High"] ||
    overviewStats["52 Week High"] ||
    stats["52-Week High"] ||
    stats["52 Week High"] ||
    "0"
  );
  const statYearLow = parseNum(
    overviewStats["52-Week Low"] ||
    overviewStats["52 Week Low"] ||
    stats["52-Week Low"] ||
    stats["52 Week Low"] ||
    "0"
  );

  if (!yearHigh || yearHigh <= 0 || yearHigh < yearLow) yearHigh = statYearHigh;
  if (!yearLow || yearLow <= 0 || yearLow > yearHigh) yearLow = statYearLow;

  // 비정상 데이터 가드 (예: 52주 최고가 $1로 파싱되는 케이스)
  if (price > 0 && yearHigh > 0 && yearHigh < price * 0.5) {
    yearHigh = Math.max(statYearHigh || 0, price);
  }
  if (price > 0 && yearLow > price * 1.5) {
    yearLow = Math.min(statYearLow || price, price);
  }

  const prevClose =
    parseFloat(overviewStats["Previous Close"]?.replace(/,/g, "") || "0") || 0;
  const dailyChange = price && prevClose ? (price - prevClose) / prevClose : 0;

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

  const sectorMatch = html.match(
    /Sector\s*<\/[^>]+>\s*<[^>]+>\s*(?:<a[^>]*>)?([^<]+)/
  );
  const industryMatch = html.match(
    /Industry\s*<\/[^>]+>\s*<[^>]+>\s*(?:<a[^>]*>)?([^<]+)/
  );

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
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
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
