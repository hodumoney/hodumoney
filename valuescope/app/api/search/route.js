// app/api/search/route.js — 종목 검색 API
import { searchSymbol } from "@/lib/fmp";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.length < 1) {
    return Response.json([]);
  }

  try {
    const results = await searchSymbol(q);
    // 주식, ETF만 필터링
    const filtered = (results || [])
      .filter(r => r.stockExchange && !r.stockExchange.includes("Crypto"))
      .slice(0, 8)
      .map(r => ({
        symbol: r.symbol,
        name: r.name,
        exchange: r.stockExchange,
        type: r.currency,
      }));

    return Response.json(filtered);
  } catch (err) {
    return Response.json([]);
  }
}
