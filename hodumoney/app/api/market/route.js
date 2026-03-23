// app/api/market/route.js
export const dynamic = "force-dynamic";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

const INDEX_CONFIG = {
  us: [
    { symbol: "^GSPC", name: "S&P 500" },
    { symbol: "^IXIC", name: "나스닥" },
    { symbol: "^DJI", name: "다우존스" },
    { symbol: "^RUT", name: "러셀 2000" },
  ],
  kr: [
    { symbol: "^KS11", name: "코스피" },
    { symbol: "^KQ11", name: "코스닥" },
    { symbol: "^KS200", name: "코스피 200" },
  ],
};

function fmtSigned(n, digits = 2) {
  const val = Number(n) || 0;
  return `${val >= 0 ? "+" : ""}${val.toFixed(digits)}`;
}

function toHistoryPoints(timestamps = [], closes = []) {
  return timestamps
    .map((ts, i) => {
      const close = Number(closes[i]);
      if (!Number.isFinite(close) || close <= 0) return null;
      const dt = new Date(ts * 1000);
      const yy = String(dt.getFullYear()).slice(-2);
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      return { label: `${yy}.${mm}`, value: close };
    })
    .filter(Boolean);
}

async function fetchQuotes(symbols) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
  const res = await fetch(url, { headers: UA, cache: "no-store" });
  if (!res.ok) return {};
  const json = await res.json();
  const arr = Array.isArray(json?.quoteResponse?.result) ? json.quoteResponse.result : [];
  const map = {};
  for (const q of arr) map[q.symbol] = q;
  return map;
}

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
  const res = await fetch(url, { headers: UA, cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  return toHistoryPoints(timestamps, closes);
}

function toIndexCard(cfg, quote, history) {
  const value = Number(quote?.regularMarketPrice) || 0;
  const chg = Number(quote?.regularMarketChange) || 0;
  const pct = Number(quote?.regularMarketChangePercent) || 0;
  return {
    name: cfg.name,
    value: value ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-",
    numValue: value,
    change: fmtSigned(chg, 2),
    pct: `${fmtSigned(pct, 2)}%`,
    up: chg >= 0,
    history: history?.length ? history : [{ label: "N/A", value: value || 0 }],
  };
}

export async function GET() {
  try {
    const allSymbols = [...INDEX_CONFIG.us, ...INDEX_CONFIG.kr].map((c) => c.symbol);
    const [quoteMap, usHist, krHist, fxQuoteMap] = await Promise.all([
      fetchQuotes(allSymbols),
      Promise.all(INDEX_CONFIG.us.map((c) => fetchChart(c.symbol))),
      Promise.all(INDEX_CONFIG.kr.map((c) => fetchChart(c.symbol))),
      fetchQuotes(["KRW=X"]),
    ]);

    const indicesUS = INDEX_CONFIG.us.map((cfg, i) =>
      toIndexCard(cfg, quoteMap[cfg.symbol], usHist[i])
    );
    const indicesKR = INDEX_CONFIG.kr.map((cfg, i) =>
      toIndexCard(cfg, quoteMap[cfg.symbol], krHist[i])
    );

    const usdkrw = Number(fxQuoteMap?.["KRW=X"]?.regularMarketPrice) || 0;

    return Response.json({
      fetchedAt: new Date().toISOString(),
      exchangeRate: usdkrw,
      indicesUS,
      indicesKR,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
