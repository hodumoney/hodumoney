// app/api/price/route.js — StockAnalysis history (no API key!)
import { getHistory } from "@/lib/stockanalysis";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const period = searchParams.get("period") || "6M";

  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const data = await getHistory(symbol);

    if (!data || data.length === 0) {
      return Response.json({ error: "No price data" }, { status: 404 });
    }

    // StockAnalysis default shows ~6 months of daily data
    // For shorter periods, trim the data
    const periodDays = { "1D":1, "1M":22, "3M":66, "6M":132, "1Y":252, "3Y":756, "5Y":1260, "10Y":2520, "MAX":99999 };
    const days = periodDays[period] || 132;
    const trimmed = data.slice(-Math.min(days, data.length));

    // Thin for large datasets
    let points = trimmed;
    if (points.length > 150) {
      const step = Math.ceil(points.length / 150);
      points = trimmed.filter((_, i) => i % step === 0);
      if (points[points.length - 1] !== trimmed[trimmed.length - 1]) {
        points.push(trimmed[trimmed.length - 1]);
      }
    }

    return Response.json({ symbol, period, points });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
