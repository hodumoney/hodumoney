// app/api/search/route.js — Search using StockAnalysis
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q || q.length < 1) return Response.json([]);

  try {
    const url = `https://stockanalysis.com/api/search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return Response.json([]);
    const data = await res.json();
    return Response.json(Array.isArray(data) ? data.slice(0, 8) : []);
  } catch (err) {
    return Response.json([]);
  }
}
