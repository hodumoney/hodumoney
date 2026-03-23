// app/api/market/route.js
import { getOverview, getHistory } from "@/lib/stockanalysis";

export const dynamic = "force-dynamic";

const MARKET_SYMBOLS = {
  us: [
    // 지수 직접 심볼보다 데이터 안정성이 높은 대표 ETF 프록시 사용
    { symbol: "SPY", name: "S&P 500" },
    { symbol: "QQQ", name: "나스닥" },
    { symbol: "DIA", name: "다우존스" },
    { symbol: "IWM", name: "러셀 2000" },
  ],
  kr: [
    { symbol: "EWY", name: "코스피" },
    { symbol: "KORU", name: "코스닥" },
    { symbol: "069500.KS", name: "코스피 200" },
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
  const [ov, hist] = await Promise.all([
    getOverview(cfg.symbol),
    getHistory(cfg.symbol, "1Y"),
  ]);

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

export async function GET() {
  try {
    const [indicesUS, indicesKR] = await Promise.all([
      Promise.all(MARKET_SYMBOLS.us.map((c) => buildItem(c))),
      Promise.all(MARKET_SYMBOLS.kr.map((c) => buildItem(c))),
    ]);

    return Response.json({
      fetchedAt: new Date().toISOString(),
      // 고정 fallback 값, 추후 환율 API 별도 분리 가능
      exchangeRate: 1386.93,
      indicesUS,
      indicesKR,
      source: "stockanalysis",
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
