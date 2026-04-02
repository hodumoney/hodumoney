// app/api/search/route.js — Robust search with Yahoo Finance + StockAnalysis fallback
export const dynamic = "force-dynamic";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

/**
 * Yahoo Finance search (v1/finance/search)
 * Returns: array of { symbol, name, exchange, type }
 */
async function searchYahoo(query) {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      query
    )}&quotesCount=8&newsCount=0&listsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`;

    const res = await fetch(url, {
      headers: UA,
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data = await res.json();
    const quotes = data?.quotes || [];

    return quotes
      .filter((q) => q.quoteType === "EQUITY" || q.quoteType === "ETF")
      .map((q) => ({
        s: q.symbol || "",
        n: q.longname || q.shortname || q.symbol || "",
        t: q.quoteType === "ETF" ? "ETF" : "Stock",
        e: q.exchange || "",
      }))
      .slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * StockAnalysis search (fallback)
 */
async function searchStockAnalysis(query) {
  try {
    const url = `https://stockanalysis.com/api/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: UA,
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.slice(0, 8).map((item) => ({
      s: item.s || item.symbol || "",
      n: item.n || item.name || "",
      t: item.t || "Stock",
      e: item.e || "",
    }));
  } catch {
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q || q.length < 1) return Response.json([]);

  // Try Yahoo first, fall back to StockAnalysis
  let results = await searchYahoo(q);

  if (results.length === 0) {
    results = await searchStockAnalysis(q);
  }

  return Response.json(results);
}
