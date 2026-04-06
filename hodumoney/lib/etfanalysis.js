// lib/etfanalysis.js — StockAnalysis ETF + Yahoo Finance (text-based parsing)

const SA_ETF = "https://stockanalysis.com/etf";
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };

function stripHtml(t) { return (t||"").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").trim(); }

async function fetchEtfPage(ticker, path) {
  try {
    const res = await fetch(`${SA_ETF}/${ticker.toLowerCase()}/${path||""}`, { headers: UA, cache: "no-store" });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

/**
 * 범용 key-value 파서: td 쌍 + 텍스트 라벨 패턴 모두 시도
 */
function parseAllPairs(html) {
  if (!html) return {};
  const d = {};
  // 1) td pairs
  const tds = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
  for (let i = 0; i < tds.length - 1; i += 2) {
    const k = stripHtml(tds[i][1]), v = stripHtml(tds[i+1][1]);
    if (k && v && k.length < 50) d[k] = v;
  }
  // 2) 라벨 다음에 오는 값 패턴 (StockAnalysis 배당/개요 페이지 구조)
  // "Dividend Yield\n\n3.43%" 또는 "Expense Ratio\n\n0.06%" 형태
  const text = html.replace(/<[^>]*>/g, "\n").replace(/\n{2,}/g, "\n");
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const labels = [
    "Dividend Yield", "Annual Dividend", "Ex-Dividend Date", "Payout Frequency",
    "Payout Ratio", "Dividend Growth", "Expense Ratio", "Assets", "PE Ratio",
    "Shares Out", "Holdings", "Beta", "Inception Date", "ETF Provider",
    "Category", "Index Tracked", "Asset Class", "Region",
    "Total Holdings", "Top 10 Percentage", "ETF Category",
  ];
  for (let i = 0; i < lines.length - 1; i++) {
    for (const label of labels) {
      if (lines[i] === label || lines[i].startsWith(label)) {
        // 값은 바로 다음 줄 또는 같은 줄의 나머지
        const nextVal = lines[i+1];
        const noise = ["News","Trending","Articles","Home","Stocks","ETFs","IPOs","Tools","Collapse","Log In","Sign Up","Chart","History","Watchlist","Overview","Holdings","Dividends","Full Chart","Compare","Market Movers"];
        if (nextVal && !labels.includes(nextVal) && !noise.includes(nextVal) && nextVal.length < 40 && nextVal.length > 0 && !d[label]) {
          d[label] = nextVal;
        }
      }
    }
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
  const s = parseAllPairs(html||"");
  const nameM = (html||"").match(/<h1[^>]*>([^<]+)/);
  const descM = (html||"").match(/(?:The fund|The ETF|This ETF|The investment)[^<]{20,400}\./);
  return {
    name: nameM ? nameM[1].replace(/\s*\([^)]*\)\s*$/,"").trim() : ticker,
    ticker: ticker.toUpperCase(),
    description: descM ? stripHtml(descM[0]) : "",
    price: yq?.price||0, dailyChange: yq?.dailyChange||0,
    yearHigh: yq?.yearHigh||0, yearLow: yq?.yearLow||0,
    exchange: yq?.exchange||"", returns: yq?.returns||{},
    expenseRatio: s["Expense Ratio"]||"-",
    aum: s["Assets"]||"-",
    category: s["Category"]||s["ETF Category"]||"-",
    issuer: s["ETF Provider"]||"-",
    index: s["Index Tracked"]||"-",
    holdingsCount: s["Holdings"]||s["Total Holdings"]||"-",
    inception: s["Inception Date"]||"-",
    divYield: s["Dividend Yield"]||"-",
    pe: s["PE Ratio"]||"-",
    beta: s["Beta"]||"-",
  };
}

export async function getEtfHoldings(ticker) {
  const html = await fetchEtfPage(ticker, "holdings/");
  if (!html) return { stats: {}, list: [] };
  const s = parseAllPairs(html);
  const stats = {
    totalHoldings: s["Total Holdings"]||s["Holdings"]||"-",
    top10Pct: s["Top 10 Percentage"]||"-",
    assetClass: s["Asset Class"]||"-",
    category: s["ETF Category"]||s["Category"]||"-",
    assets: s["Assets"]||"-",
    pe: s["PE Ratio"]||"-",
  };
  const list = [];
  const tbM = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (tbM) {
    for (const row of tbM[1].split("</tr>")) {
      if (!row.includes("<td")) continue;
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>stripHtml(c[1]));
      if (cells.length < 4) continue;
      const linkM = row.match(/href="\/stocks\/([^/"]+)\//);
      const sym = linkM ? linkM[1].toUpperCase() : (cells[1]||"");
      const name = cells[2]||"";
      const weight = (cells[3]||"").replace("%","").trim();
      if (sym && weight) list.push({ symbol: String(sym), name: String(name||sym), weight: String(weight) });
      if (list.length >= 15) break;
    }
  }
  return { stats, list };
}

export async function getEtfDividend(ticker) {
  const html = await fetchEtfPage(ticker, "dividend/");
  if (!html) return null;
  const s = parseAllPairs(html);
  return {
    yield: s["Dividend Yield"]||"-",
    annualDiv: s["Annual Dividend"]||"-",
    exDate: s["Ex-Dividend Date"]||"-",
    frequency: s["Payout Frequency"]||"-",
    payoutRatio: s["Payout Ratio"]||"-",
    divGrowth: s["Dividend Growth"]||"-",
  };
}
