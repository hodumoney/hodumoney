// app/api/market/route.js
export const dynamic = "force-dynamic";

const FMP = "https://financialmodelingprep.com/api/v3";
const API_KEY = process.env.FMP_API_KEY;

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

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

function toIndexCard(cfg, quote, history = []) {
  const value = Number(quote?.price) || 0;
  const chg = Number(quote?.change) || 0;
  const pct = Number(quote?.changesPercentage) || 0;
  return {
    name: cfg.name,
    value: value ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-",
    numValue: value,
    change: fmtSigned(chg, 2),
    pct: `${fmtSigned(pct, 2)}%`,
    up: chg >= 0,
    history: history.length > 0 ? history : [{ label: "N/A", value: value || 0 }],
  };
}

function normalizeHistory(rows = []) {
  return rows
    .slice()
    .reverse()
    .map((r) => {
      const close = Number(r.close);
      if (!Number.isFinite(close) || close <= 0) return null;
      const dt = new Date(r.date);
      if (Number.isNaN(dt.getTime())) return null;
      const yy = String(dt.getFullYear()).slice(-2);
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      return { label: `${yy}.${mm}`, value: close };
    })
    .filter(Boolean);
}

async function fetchHistory(symbol) {
  if (!API_KEY) return [];
  const now = new Date();
  const from = new Date(now);
  from.setFullYear(now.getFullYear() - 1);
  const toStr = now.toISOString().slice(0, 10);
  const fromStr = from.toISOString().slice(0, 10);

  const url =
    `${FMP}/historical-price-full/${encodeURIComponent(symbol)}` +
    `?from=${fromStr}&to=${toStr}&apikey=${API_KEY}`;

  const json = await fetchJson(url);
  const hist = Array.isArray(json?.historical) ? json.historical : [];
  return normalizeHistory(hist);
}

export async function GET() {
  try {
    if (!API_KEY) {
      return Response.json({ error: "FMP_API_KEY missing" }, { status: 500 });
    }

    const all = [...INDEX_CONFIG.us, ...INDEX_CONFIG.kr];
    const symbols = all.map((c) => c.symbol).join(",");

    const [quoteJson, usHist, krHist, fxJson] = await Promise.all([
      fetchJson(`${FMP}/quote/${encodeURIComponent(symbols)}?apikey=${API_KEY}`),
      Promise.all(INDEX_CONFIG.us.map((c) => fetchHistory(c.symbol))),
      Promise.all(INDEX_CONFIG.kr.map((c) => fetchHistory(c.symbol))),
      fetchJson(`${FMP}/fx/USDKRW?apikey=${API_KEY}`),
    ]);

    const quoteArr = Array.isArray(quoteJson) ? quoteJson : [];
    const quoteMap = {};
    for (const q of quoteArr) quoteMap[q.symbol] = q;

    const indicesUS = INDEX_CONFIG.us.map((cfg, i) =>
      toIndexCard(cfg, quoteMap[cfg.symbol], usHist[i] || [])
    );
    const indicesKR = INDEX_CONFIG.kr.map((cfg, i) =>
      toIndexCard(cfg, quoteMap[cfg.symbol], krHist[i] || [])
    );

    const exchangeRate = Array.isArray(fxJson) && fxJson[0]
      ? Number(fxJson[0].bid || fxJson[0].price || 0) || 0
      : 0;

    return Response.json({
      fetchedAt: new Date().toISOString(),
      exchangeRate,
      indicesUS,
      indicesKR,
      source: "fmp",
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
