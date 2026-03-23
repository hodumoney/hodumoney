// app/api/market/chart/route.js — Period-specific chart data from Yahoo Finance
export const dynamic = "force-dynamic";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const range = searchParams.get("range") || "1y";

  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  // Choose interval based on range
  const intervalMap = {
    "1mo": "1d",
    "3mo": "1d",
    "6mo": "1d",
    "1y": "1d",
    "5y": "1wk",
    "10y": "1mo",
  };
  const interval = intervalMap[range] || "1d";

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=${range}&interval=${interval}`;

    const res = await fetch(url, { headers: UA, cache: "no-store" });
    if (!res.ok) {
      return Response.json({ error: "Failed to fetch" }, { status: 502 });
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      return Response.json({ error: "No data" }, { status: 404 });
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    // Build points with date labels
    let points = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (typeof close !== "number" || !isFinite(close)) continue;

      const d = new Date(timestamps[i] * 1000);
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");

      // Label format depends on range
      let label;
      if (range === "1mo" || range === "3mo") {
        label = `${mm}.${dd}`;
      } else if (range === "10y") {
        label = `${yy}.${mm}`;
      } else {
        label = `${yy}.${mm}`;
      }

      points.push({ label, value: Math.round(close * 100) / 100 });
    }

    // Thin data if too many points (keep max ~80 for smooth chart)
    if (points.length > 80) {
      const step = Math.ceil(points.length / 80);
      const thinned = points.filter((_, i) => i % step === 0);
      // Always include the last point
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
