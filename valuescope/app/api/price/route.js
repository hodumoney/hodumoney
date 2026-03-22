import { getHistoricalPrice } from "@/lib/fmp";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const period = searchParams.get("period") || "1Y";

  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  const now = new Date();
  const to = now.toISOString().split("T")[0];

  const periodMap = {
    "1D": 1,
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365,
    "3Y": 365 * 3,
    "5Y": 365 * 5,
    "10Y": 365 * 10,
    "MAX": 365 * 30,
  };

  const days = periodMap[period] || 365;
  const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const from = fromDate.toISOString().split("T")[0];

  try {
    const data = await getHistoricalPrice(symbol, from, to);

    if (!data || data.length === 0) {
      return Response.json({ error: "No price data" }, { status: 404 });
    }

    // FMP returns newest first, reverse to oldest first
    const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Thin out data for large periods
    let thinned = sorted;
    if (sorted.length > 200) {
      const step = Math.ceil(sorted.length / 200);
      thinned = sorted.filter((_, i) => i % step === 0);
      // Always include the last point
      if (thinned[thinned.length - 1] !== sorted[sorted.length - 1]) {
        thinned.push(sorted[sorted.length - 1]);
      }
    }

    const points = thinned.map(d => ({
      date: d.date,
      price: d.close || d.adjClose || 0,
    }));

    return Response.json({ symbol, period, points });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
