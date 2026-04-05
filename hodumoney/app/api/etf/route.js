// app/api/etf/route.js — ETF 분석 API
import { getEtfOverview, getEtfHoldings, getEtfDividend } from "@/lib/etfanalysis";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  if (!symbol) return Response.json({ error: "symbol required" }, { status: 400 });

  try {
    const [overview, holdings, dividend] = await Promise.all([
      getEtfOverview(symbol),
      getEtfHoldings(symbol),
      getEtfDividend(symbol),
    ]);

    if (!overview) {
      return Response.json({ error: "ETF를 찾을 수 없습니다: " + symbol }, { status: 404 });
    }

    return Response.json({
      ...overview,
      holdings,
      dividend,
    });
  } catch (err) {
    return Response.json({ error: "Error: " + err.message }, { status: 500 });
  }
}
