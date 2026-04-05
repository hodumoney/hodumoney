// lib/etfanalysis.js — StockAnalysis ETF + Yahoo Finance (실제 HTML key 매칭 완료)

const SA_ETF = "https://stockanalysis.com/etf";
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };

function stripHtml(t) { return (t||"").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").trim(); }

async function fetchEtfPage(ticker, path) {
  try {
    const res = await fetch(`${SA_ETF}/${ticker.toLowerCase()}/${path||""}`, { headers: UA, cache: "no-store" });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

function parsePairs(html) {
  if (!html) return {};
  const d = {};
  // Method 1: td pairs
  const tds = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
  for (let i = 0; i < tds.length - 1; i += 2) {
    const k = stripHtml(tds[i][1]), v = stripHtml(tds[i+1][1]);
    if (k && v) d[k] = v;
  }
  // Method 2: key-value from spans/divs (StockAnalysis uses this for some sections)
  const kvPairs = [...html.matchAll(/<(?:span|div|dt)[^>]*class="[^"]*label[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|dt)>\s*<(?:span|div|dd)[^>]*>([\s\S]*?)<\/(?:span|div|dd)>/gi)];
  for (const m of kvPairs) {
    const k = stripHtml(m[1]), v = stripHtml(m[2]);
    if (k && v && !d[k]) d[k] = v;
  }
  return d;
}

async function getYahooEtfQuote(ticker) {
  try {
    const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d`, { headers: UA, cache: "no-store" });
    if (!res.ok) return null;
    const r = (await res.json())?.chart?.result?.[0];
    if (!r) return null;
    const meta = r.meta || {};
    const closes = (r.indicators?.quote?.[0]?.close||[]).filter(v=>typeof v==="number"&&isFinite(v));
    const highs = (r.indicators?.quote?.[0]?.high||[]).filter(v=>typeof v==="number"&&isFinite(v));
    const lows = (r.indicators?.quote?.[0]?.low||[]).filter(v=>typeof v==="number"&&isFinite(v));
    const price = meta.regularMarketPrice || 0;
    const prev = meta.chartPreviousClose || meta.previousClose || 0;
    const calc = (d) => closes.length>d+1 ? ((closes[closes.length-1]-closes[closes.length-1-d])/closes[closes.length-1-d])*100 : null;
    return {
      price, dailyChange: prev ? ((price-prev)/prev)*100 : 0,
      yearHigh: highs.length ? Math.max(...highs) : 0,
      yearLow: lows.length ? Math.min(...lows) : 0,
      exchange: meta.exchangeName || "",
      returns: { "1M": calc(21), "3M": calc(63), "6M": calc(126), "1Y": calc(Math.max(0,closes.length-2)) },
    };
  } catch { return null; }
}

export async function getEtfOverview(ticker) {
  const [html, yq] = await Promise.all([fetchEtfPage(ticker,""), getYahooEtfQuote(ticker)]);
  if (!html && !yq) return null;
  const s = parsePairs(html||"");
  const nameM = (html||"").match(/<h1[^>]*>([^<]+)/);
  const descM = (html||"").match(/(?:The fund|The ETF|This ETF|The investment)[^<]{20,400}\./);
  return {
    name: nameM ? nameM[1].replace(/\s*\([^)]*\)\s*$/,"").trim() : ticker,
    ticker: ticker.toUpperCase(),
    description: descM ? stripHtml(descM[0]) : "",
    price: yq?.price||0, dailyChange: yq?.dailyChange||0,
    yearHigh: yq?.yearHigh||0, yearLow: yq?.yearLow||0,
    exchange: yq?.exchange||"", returns: yq?.returns||{},
    // Overview page keys (confirmed from actual HTML)
    expenseRatio: s["Expense Ratio"]||"-",
    aum: s["Assets"]||s["Net Assets"]||"-",
    category: s["Category"]||s["ETF Category"]||"-",
    issuer: s["ETF Provider"]||s["Issuer"]||"-",
    index: s["Index Tracked"]||"-",
    holdingsCount: s["Holdings"]||s["Total Holdings"]||"-",
    inception: s["Inception Date"]||"-",
    divYield: s["Dividend Yield"]||"-",
    divTTM: s["Dividend (ttm)"]||s["Dividend"]||"-",
    pe: s["PE Ratio"]||"-",
    beta: s["Beta"]||"-",
    payoutFreq: s["Payout Frequency"]||"-",
    sharesOut: s["Shares Out"]||"-",
    assetClass: s["Asset Class"]||"-",
    region: s["Region"]||"-",
  };
}

export async function getEtfHoldings(ticker) {
  const html = await fetchEtfPage(ticker, "holdings/");
  if (!html) return { stats: {}, list: [] };

  const s = parsePairs(html);
  const stats = {
    totalHoldings: s["Total Holdings"]||s["Holdings"]||"-",
    top10Pct: s["Top 10 Percentage"]||"-",
    assetClass: s["Asset Class"]||"-",
    category: s["ETF Category"]||s["Category"]||"-",
    assets: s["Assets"]||"-",
    pe: s["PE Ratio"]||"-",
  };

  // Parse holdings table: No. | Symbol | Name | % Weight | Shares
  const list = [];
  const tbM = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (tbM) {
    for (const row of tbM[1].split("</tr>")) {
      if (!row.includes("<td")) continue;
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>stripHtml(c[1]));
      if (cells.length < 4) continue;
      // Link-based symbol extraction
      const linkM = row.match(/href="\/stocks\/([^/"]+)\//);
      const sym = linkM ? linkM[1].toUpperCase() : (cells[1]||"");
      const name = cells[2]||"";
      const weight = (cells[3]||"").replace("%","").trim();
      const shares = cells[4] ? cells[4].replace(/,/g,"") : "";
      if (sym && weight) {
        list.push({ symbol: String(sym), name: String(name||sym), weight: String(weight), shares: String(shares) });
      }
      if (list.length >= 15) break;
    }
  }
  return { stats, list };
}

export async function getEtfDividend(ticker) {
  const html = await fetchEtfPage(ticker, "dividend/");
  if (!html) return null;
  const s = parsePairs(html);
  // Confirmed keys from actual VOO dividend page
  return {
    yield: s["Dividend Yield"]||"-",
    annualDiv: s["Annual Dividend"]||"-",
    exDate: s["Ex-Dividend Date"]||"-",
    frequency: s["Payout Frequency"]||"-",
    payoutRatio: s["Payout Ratio"]||"-",
    divGrowth: s["Dividend Growth"]||s["Dividend Growth(1Y)"]||"-",
  };
}
