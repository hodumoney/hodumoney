// app/api/market/chart/route.js — Period-specific chart data from Yahoo Finance
// 모든 시간은 한국 시간(KST, UTC+9) 기준으로 표시
export const dynamic = "force-dynamic";
const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

const KST_OFFSET = 9; // 한국은 항상 UTC+9 (서머타임 없음)

// UTC unix timestamp → KST 날짜/시간 요소 추출
function toKST(ts) {
  const d = new Date(ts * 1000 + KST_OFFSET * 60 * 60 * 1000);
  return {
    yy: String(d.getUTCFullYear()).slice(-2),
    mm: String(d.getUTCMonth() + 1).padStart(2, "0"),
    dd: String(d.getUTCDate()).padStart(2, "0"),
    hh: String(d.getUTCHours()).padStart(2, "0"),
    mi: String(d.getUTCMinutes()).padStart(2, "0"),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const range = searchParams.get("range") || "1y";
  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  const intervalMap = {
    "1d": "5m",
    "5d": "15m",
    "5d_daily": "1d",
    "1wk": "15m",
    "1mo": "1d",
    "3mo": "1d",
    "6mo": "1d",
    "1y": "1d",
    "5y": "1wk",
    "10y": "1mo",
    "max": "1mo",
  };
  const interval = intervalMap[range] || "1d";

  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=${range}&interval=${interval}`;

    // query1 실패 시 query2로 fallback
    let res = await fetch(chartUrl, { headers: UA, cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      res = await fetch(chartUrl.replace("query1.", "query2."), { headers: UA, cache: "no-store" }).catch(() => null);
    }
    if (!res?.ok) {
      return Response.json({ error: "Failed to fetch" }, { status: 502 });
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      return Response.json({ error: "No data" }, { status: 404 });
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    // Build points — 모든 시간을 KST로 표시
    let points = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (typeof close !== "number" || !isFinite(close)) continue;

      const t = toKST(timestamps[i]);

      let label;
      if (range === "1d" || range === "5d" || range === "1wk") {
        // 장중/단기: "04.02 09:15" (KST)
        label = `${t.mm}.${t.dd} ${t.hh}:${t.mi}`;
      } else if (range === "5d_daily") {
        label = `${t.mm}.${t.dd}`;
      } else if (range === "1mo" || range === "3mo") {
        label = `${t.mm}.${t.dd}`;
      } else if (range === "10y" || range === "max") {
        label = `${t.yy}.${t.mm}`;
      } else {
        label = `${t.yy}.${t.mm}`;
      }

      points.push({ label, value: Math.round(close * 100) / 100 });
    }

    // Thin data if too many points (keep max ~80 for smooth chart)
    if (points.length > 80) {
      const step = Math.ceil(points.length / 80);
      const thinned = points.filter((_, i) => i % step === 0);
      if (thinned[thinned.length - 1] !== points[points.length - 1]) {
        thinned.push(points[points.length - 1]);
      }
      points = thinned;
    }

    return Response.json({ symbol, range, points });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
