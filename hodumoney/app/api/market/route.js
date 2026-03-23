// app/api/market/route.js
import { getOverview, getHistory } from "@/lib/stockanalysis";

export const dynamic = "force-dynamic";

const MARKET_SYMBOLS = {
  us: [
    // 지수 직접 심볼보다 데이터 안정성이 높은 대표 ETF 프록시 사용
    { name: "S&P 500", candidates: ["^GSPC", "SPX", "SPY"] },
    { name: "나스닥", candidates: ["^IXIC", "IXIC", "QQQ"] },
    { name: "다우존스", candidates: ["^DJI", "DJIA", "DIA"] },
    { name: "러셀 2000", candidates: ["^RUT", "RUT", "IWM"] },
  ],
  kr: [
    { name: "코스피", candidates: ["^KS11", "KOSPI", "EWY"] },
    { name: "코스닥", candidates: ["^KQ11", "KOSDAQ", "KORU"] },
    { name: "코스피 200", candidates: ["^KS200", "069500.KS"] },
  ],
  econUS: [
    { symbol: "^TNX", name: "10년물 국채금리", valueType: "yield" },
    { symbol: "SHY", name: "2년물 국채금리", valueType: "yieldProxy" },
    { symbol: "UUP", name: "달러 인덱스 (DXY)", valueType: "index" },
  ],
  econKR: [
    { symbol: "USDKRW", name: "원/달러 환율", valueType: "fx" },
    { symbol: "EWY", name: "원/엔 환율 (100엔)", valueType: "fxProxy" },
  ],
};

function fmtSigned(n, digits = 2) {
  const val = Number(n) || 0;
  return `${val >= 0 ? "+" : ""}${val.toFixed(digits)}`;
}

function toHistoryPoints(rows = []) {
  return (rows || []).map((p) => {
    const dt = new Date(p.date);
    const yy = String(dt.getFullYear()).slice(-2);
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    return { label: `${yy}.${mm}`, value: Number(p.price) || 0 };
  });
}

async function buildItem(cfg) {
  let ov = null;
  let hist = [];
  const candidates = cfg.candidates && cfg.candidates.length > 0 ? cfg.candidates : [cfg.symbol];

  for (const symbol of candidates) {
    const [candidateOv, candidateHist] = await Promise.all([
      getOverview(symbol),
      getHistory(symbol, "1Y"),
    ]);
    const price = Number(candidateOv?.price) || 0;
    const history = toHistoryPoints(candidateHist).filter((h) => Number.isFinite(h.value) && h.value > 0);
    if (price > 0 && history.length > 5) {
      ov = candidateOv;
      hist = candidateHist;
      break;
    }
  }

  const price = Number(ov?.price) || 0;
  const daily = Number(ov?.dailyChange) || 0;
  const history = toHistoryPoints(hist).filter((h) => Number.isFinite(h.value) && h.value > 0);

  return {
    name: cfg.name,
    value: price ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-",
    numValue: price,
    change: fmtSigned(price * daily, 2),
    pct: `${fmtSigned(daily * 100, 2)}%`,
    up: daily >= 0,
    history: history.length > 0 ? history : [{ label: "N/A", value: price || 0 }],
  };
}

function formatEconValue(type, price) {
  if (!Number.isFinite(price) || price <= 0) return "-";
  if (type === "yield" || type === "yieldProxy") return `${price.toFixed(3)}%`;
  if (type === "fx" || type === "fxProxy") return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

async function buildEconItem(cfg, exchangeRate) {
  let ov = null;
  let hist = [];

  if (cfg.symbol === "USDKRW") {
    const val = Number(exchangeRate) || 0;
    ov = { price: val, dailyChange: 0 };
    hist = [{ date: new Date().toISOString().slice(0, 10), price: val }];
  } else {
    [ov, hist] = await Promise.all([
      getOverview(cfg.symbol),
      getHistory(cfg.symbol, "1Y"),
    ]);
  }

  const price = Number(ov?.price) || 0;
  const daily = Number(ov?.dailyChange) || 0;
  const history = toHistoryPoints(hist).filter((h) => Number.isFinite(h.value) && h.value > 0);
  return {
    name: cfg.name,
    value: formatEconValue(cfg.valueType, price),
    change: fmtSigned(price * daily, cfg.valueType.includes("yield") ? 3 : 2),
    pct: `${fmtSigned(daily * 100, 2)}%`,
    up: daily >= 0,
    history: history.length > 0 ? history : [{ label: "N/A", value: price || 0 }],
  };
}

export async function GET() {
  try {
    const [indicesUS, indicesKR] = await Promise.all([
      Promise.all(MARKET_SYMBOLS.us.map((c) => buildItem(c))),
      Promise.all(MARKET_SYMBOLS.kr.map((c) => buildItem(c))),
    ]);

    const exchangeRate = 1386.93;
    const [econUS, econKR] = await Promise.all([
      Promise.all(MARKET_SYMBOLS.econUS.map((c) => buildEconItem(c, exchangeRate))),
      Promise.all(MARKET_SYMBOLS.econKR.map((c) => buildEconItem(c, exchangeRate))),
    ]);

    return Response.json({
      fetchedAt: new Date().toISOString(),
      exchangeRate,
      indicesUS,
      indicesKR,
      econUS,
      econKR,
      source: "stockanalysis",
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
