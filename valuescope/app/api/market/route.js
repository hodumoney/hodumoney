// app/api/market/route.js — 시장 동향 데이터 API
import { getIndexQuotes, getVixQuote, getForex } from "@/lib/fmp";

export async function GET() {
  try {
    const [indices, vix, usdkrw] = await Promise.all([
      getIndexQuotes(),
      getVixQuote(),
      getForex("USDKRW"),
    ]);

    // 지수 데이터 정리
    const indexMap = {};
    (indices || []).forEach(q => {
      indexMap[q.symbol] = {
        name: q.name,
        value: q.price,
        change: q.change,
        pct: q.changesPercentage,
        up: q.change >= 0,
      };
    });

    return Response.json({
      indices: indexMap,
      vix: vix ? {
        value: vix.price,
        change: vix.change,
        pct: vix.changesPercentage,
        prevClose: vix.previousClose,
        yearHigh: vix.yearHigh,
        yearLow: vix.yearLow,
      } : null,
      forex: {
        usdkrw: usdkrw?.bid || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Market API error:", err);
    return Response.json({ error: "시장 데이터를 가져오는 중 오류가 발생했습니다" }, { status: 500 });
  }
}
