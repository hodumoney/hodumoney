// lib/stockanalysis.js — StockAnalysis + Yahoo Finance hybrid (US + KR 지원)

const SA_US = "https://stockanalysis.com/stocks";
const UA = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

// 한국 종목 판별: 6자리 숫자 (005930, 000660 등)
function isKrxTicker(ticker) {
  return /^\d{6}$/.test(ticker.trim());
}

// kr_stocks.json에서 거래소 조회 (KRX=코스피, KOSDAQ=코스닥)
let _krStocksCache = null;
function getKrExchange(ticker) {
  if (!_krStocksCache) {
    try {
      const fs = require("fs");
      const path = require("path");
      const filePath = path.join(process.cwd(), "public", "kr_stocks.json");
      _krStocksCache = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      _krStocksCache = [];
    }
  }
  const found = _krStocksCache.find(s => s.s === ticker);
  return found?.e || "KRX"; // default to KRX if not found
}

// StockAnalysis URL: 코스피 → /quote/krx/, 코스닥 → /quote/kosdaq/
function getSaBase(ticker) {
  if (!isKrxTicker(ticker)) return SA_US;
  const exchange = getKrExchange(ticker);
  return exchange === "KOSDAQ"
    ? "https://stockanalysis.com/quote/kosdaq"
    : "https://stockanalysis.com/quote/krx";
}

// Yahoo Finance용 한국 티커 변환: 코스피 → .KS, 코스닥 → .KQ
function toYahooKrxTicker(ticker) {
  const exchange = getKrExchange(ticker);
  return exchange === "KOSDAQ" ? `${ticker}.KQ` : `${ticker}.KS`;
}

async function fetchPage(ticker, path, quarterly) {
  const q = quarterly ? "?p=quarterly" : "";
  const normalizedPath = path || "";

  const base = getSaBase(ticker);
  const url = `${base}/${ticker.toLowerCase()}/${normalizedPath}${q}`;

  try {
    const res = await fetch(url, {
      headers: UA,
      cache: "no-store",
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Check if HTML has actual table data
    if (html && html.includes("<tbody")) return html;

    // Dot-ticker fallback: try __data.json (SvelteKit data endpoint)
    if (ticker.includes(".")) {
      const dataUrl = `${base}/${ticker.toLowerCase()}/${normalizedPath}__data.json${q}`;
      try {
        const dataRes = await fetch(dataUrl, { headers: UA, cache: "no-store" });
        if (dataRes.ok) {
          const jsonText = await dataRes.text();
          // Convert __data.json to fake HTML table so parseTable can handle it
          const fakeHtml = convertDataJsonToHtml(jsonText, normalizedPath);
          if (fakeHtml) return fakeHtml;
        }
      } catch {}
    }

    return html; // Return original HTML even if no tbody (overview page etc.)
  } catch {
    return null;
  }
}

/**
 * SvelteKit __data.json → fake HTML table 변환
 * __data.json은 devalue 인코딩이지만, 숫자/문자열 데이터는 JSON 안에 직접 들어있음
 */
function convertDataJsonToHtml(jsonText, path) {
  try {
    const data = JSON.parse(jsonText);
    if (!data || !data.nodes) return null;

    // SvelteKit devalue: nodes[0].data contains the page data
    // The data is encoded as an array where even indices are types and odd are values
    // We need to find the financial table data within it

    // Strategy: Find arrays of numbers that look like financial data
    // The __data.json contains all page data as a flat structure
    const str = JSON.stringify(data);

    // Extract row labels and their values
    // Look for patterns like: "Revenue",... followed by number arrays
    const financialLabels = [
      "Revenue", "Gross Profit", "Operating Income", "Net Income", "EBITDA",
      "EPS (Diluted)", "Shares Outstanding", "Operating Expenses", "Cost of Revenue",
      "PE Ratio", "PB Ratio", "EPS", "Debt / Equity", "Return on Equity",
      "Dividend Yield", "EV/EBITDA", "PEG Ratio", "Current Ratio",
      "Total Assets", "Total Liabilities", "Shareholders' Equity", "Total Current Liabilities",
      "Free Cash Flow", "Operating Cash Flow", "Investing Cash Flow", "Financing Cash Flow",
      "Net Cash Flow", "Capital Expenditures"
    ];

    // Try to find a tabular data structure in the devalue format
    // devalue format: [type_markers, ...values]
    // The data array contains all values sequentially

    // Approach: Find all string+number sequences that match label→values pattern
    const allStrings = [];
    const allNumbers = [];

    function walk(obj, depth) {
      if (depth > 10) return;
      if (Array.isArray(obj)) {
        obj.forEach(item => walk(item, depth + 1));
      } else if (obj && typeof obj === "object") {
        Object.entries(obj).forEach(([k, v]) => walk(v, depth + 1));
      } else if (typeof obj === "string") {
        allStrings.push(obj);
      } else if (typeof obj === "number") {
        allNumbers.push(obj);
      }
    }
    walk(data, 0);

    // Build fake HTML with found data
    // Look for label sequences followed by number arrays in the raw JSON
    const rows = [];
    for (const label of financialLabels) {
      const labelIdx = str.indexOf(`"${label}"`);
      if (labelIdx === -1) continue;

      // Find the next array of numbers after this label
      const afterLabel = str.substring(labelIdx + label.length + 2, labelIdx + label.length + 500);
      const numArrayMatch = afterLabel.match(/\[([-\d.,\s"null]+)\]/);
      if (numArrayMatch) {
        const nums = numArrayMatch[1].split(",").map(v => {
          const cleaned = v.trim().replace(/"/g, "");
          return cleaned === "null" ? "-" : cleaned;
        });
        if (nums.length >= 2 && nums.some(n => n !== "-" && !isNaN(parseFloat(n)))) {
          rows.push(`<tr><td>${label}</td>${nums.map(n => `<td>${n}</td>`).join("")}</tr>`);
        }
      }
    }

    if (rows.length === 0) return null;
    return `<tbody>${rows.join("")}</tbody>`;
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
  // 여러 <tbody> 섹션 모두 읽기 (StockAnalysis ratios 페이지는 섹션별로 분리됨)
  const tbodies = [...html.matchAll(/<tbody[^>]*>([\s\S]*?)<\/tbody>/g)];
  if (tbodies.length === 0) return map;

  for (const tb of tbodies) {
    for (const row of tb[1].split("</tr>")) {
      if (!row.includes("<td")) continue;

      const nm = row.match(/<td[^>]*>(.*?)<\/td>/);
      if (!nm) continue;

      const name = stripHtml(nm[1]);
      if (!name) continue;

      const vals = [];
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];

      for (let j = 1; j < cells.length; j++) {
        let v = stripHtml(cells[j][1]).replace(/,/g, "").replace("%", "");
        let n = v === "-" || v === "" || v.toLowerCase() === "n/a" ? 0 : parseFloat(v);
        vals.push(Number.isNaN(n) ? 0 : n);
      }

      // 이미 있는 키는 덮어쓰지 않음 (첫 등장 우선)
      if (!(name in map)) map[name] = vals;
    }
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

// 추정치(Estimate) 컬럼 인덱스 찾기
function findEstimateIndices(labels) {
  const indices = [];
  const now = new Date();
  const curYear = now.getFullYear();
  const curQ = Math.ceil((now.getMonth() + 1) / 3);

  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    // "Q1 2027E", "FY 2027E", ends with E
    if (/E$/i.test(l.trim())) { indices.push(i); continue; }
    // Check if quarter is in the future (for quarterly data)
    const qm = l.match(/Q(\d)\s*(\d{4})/);
    if (qm) {
      const qNum = parseInt(qm[1]);
      const year = parseInt(qm[2]);
      if (year > curYear || (year === curYear && qNum > curQ)) {
        indices.push(i);
      }
    }
    // Check annual: "FY 2027" etc
    const fm = l.match(/FY\s*(\d{4})/);
    if (fm && parseInt(fm[1]) > curYear) {
      indices.push(i);
    }
  }
  return indices;
}

// 추정치 라벨에 (예상) 표시 추가
function markEstimateLabels(labels, estIndices) {
  if (!labels || !estIndices || estIndices.length === 0) return labels;
  return labels.map((l, i) => estIndices.includes(i) ? `${l.replace(/E$/i, "")} (예상)` : l);
}

// 추정치 제거한 배열 반환 (사용하지 않지만 유지)
function removeEstimates(arr, estIndices) {
  if (!arr || !estIndices || estIndices.length === 0) return arr;
  return arr.filter((_, i) => !estIndices.includes(i));
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

  // 결산월 추출 (Fiscal Year Ends: "January", "September" 등)
  const fyEndRaw = stats["Fiscal Year Ends"] || stats["Fiscal Year End"] || "";
  const monthMap = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
  const fiscalYearEndMonth = monthMap[fyEndRaw.toLowerCase().trim()] || 12; // 기본값 12월 (달력 = 회계연도)

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
    fiscalYearEndMonth,
  };
}

export async function getIncome(ticker, quarterly) {
  // 상세 income-statement 페이지 사용 (발행주식수, EBITDA 포함)
  const html = await fetchPage(ticker, "financials/income-statement/", quarterly);
  const data = parseTable(html);
  const labels = extractLabels(html);
  const estIdx = findEstimateIndices(labels);

  return {
    labels: markEstimateLabels(labels, estIdx),
    revenue: getRow(data, ["Revenue", "Total Revenue"]),
    grossProfit: getRow(data, ["Gross Profit"]),
    operatingIncome: getRow(data, ["Operating Income"]),
    netIncome: getRow(data, ["Net Income"]),
    ebitda: getRow(data, ["EBITDA"]),
    eps: getRow(data, ["EPS (Diluted)", "EPS (Basic)", "EPS"]),
    sharesOut: getRow(data, [
      "Shares Outstanding (Diluted)",
      "Shares Outstanding (Basic)",
      "Diluted Shares Outstanding",
      "Basic Shares Outstanding",
      "Shares Outstanding",
    ]),
  };
}

export async function getBalance(ticker, quarterly) {
  const html = await fetchPage(ticker, "financials/balance-sheet/", quarterly);
  const data = parseTable(html);

  return {
    totalAssets: getRow(data, ["Total Assets"]),
    currentLiab: getRow(data, ["Total Current Liabilities", "Current Liabilities"]),
    equity: getRow(data, ["Shareholders' Equity", "Total Shareholders' Equity", "Total Equity", "Total Stockholders Equity", "Total Common Equity"]),
  };
}

export async function getCashFlow(ticker, quarterly) {
  const html = await fetchPage(ticker, "financials/cash-flow-statement/", quarterly);
  const data = parseTable(html);

  return {
    fcf: getRow(data, ["Free Cash Flow", "Levered Free Cash Flow"]),
    opCash: getRow(data, ["Operating Cash Flow", "Cash from Operations", "Operating Cash Flow"]),
    invCash: getRow(data, ["Investing Cash Flow", "Cash from Investing"]),
    finCash: getRow(data, ["Financing Cash Flow", "Cash from Financing"]),
    netChange: getRow(data, ["Net Change in Cash", "Net Cash Flow", "Net Change In Cash"]),
    depreciation: getRow(data, ["Depreciation & Amortization", "Depreciation and Amortization", "Depreciation & Amortization (D&A)"]),
  };
}

export async function getRatios(ticker, quarterly) {
  const html = await fetchPage(ticker, "financials/ratios/", quarterly);
  const data = parseTable(html);

  // ratios 페이지는 첫 데이터 컬럼이 "Current"(실시간)일 수 있음 → 헤더로 판별해 제거
  const labels = extractLabels(html);
  const hasCurrentCol = labels.length > 0 && /current/i.test(labels[0]);
  const drop = (arr) => hasCurrentCol && arr.length > 1 ? arr.slice(1) : arr;

  return {
    pe: drop(getRow(data, ["PE Ratio"])),
    pb: drop(getRow(data, ["PB Ratio"])),
    deRatio: drop(getRow(data, ["Debt / Equity Ratio"])),
    roe: drop(getRow(data, ["Return on Equity (ROE)"])),
    divYield: drop(getRow(data, ["Dividend Yield"])),
    evEbitda: drop(getRow(data, ["EV/EBITDA Ratio", "EV / EBITDA", "EV/EBITDA"])),
    peg: drop(getRow(data, ["PEG Ratio"])),
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
