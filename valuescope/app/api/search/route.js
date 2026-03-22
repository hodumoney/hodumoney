// app/api/search/route.js — Search using StockAnalysis
export const dynamic = "force-dynamic";

const LOCAL_COMPANIES = [
  { s: "005930.KS", n: "삼성전자" },
  { s: "000660.KS", n: "SK하이닉스" },
  { s: "035420.KS", n: "네이버" },
  { s: "035720.KS", n: "카카오" },
  { s: "005380.KS", n: "현대차" },
  { s: "NVDA", n: "NVIDIA" },
  { s: "AAPL", n: "Apple" },
  { s: "MSFT", n: "Microsoft" },
  { s: "TSLA", n: "Tesla" },
  { s: "GOOG", n: "Alphabet" },
  { s: "AMZN", n: "Amazon" },
  { s: "META", n: "Meta Platforms" },
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 1) return Response.json([]);

  const qLower = q.toLowerCase();
  const localStartsWith = LOCAL_COMPANIES.filter((item) =>
    item.n.toLowerCase().startsWith(qLower) || item.s.toLowerCase().startsWith(qLower)
  );
  const localIncludes = LOCAL_COMPANIES.filter((item) =>
    (item.n.toLowerCase().includes(qLower) || item.s.toLowerCase().includes(qLower)) &&
    !localStartsWith.some((s) => s.s === item.s)
  );
  const localResults = [...localStartsWith, ...localIncludes].slice(0, 8);

  try {
    const [stockAnalysisRes, yahooRes] = await Promise.allSettled([
      fetch(`https://stockanalysis.com/api/search?q=${encodeURIComponent(q)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      }),
      fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
          q
        )}&quotesCount=12&newsCount=0`,
        {
          headers: { "User-Agent": "Mozilla/5.0" },
          cache: "no-store",
        }
      ),
    ]);

    let saData = [];
    if (stockAnalysisRes.status === "fulfilled" && stockAnalysisRes.value.ok) {
      saData = await stockAnalysisRes.value.json();
    }

    let yahooQuotes = [];
    if (yahooRes.status === "fulfilled" && yahooRes.value.ok) {
      const yahooData = await yahooRes.value.json();
      yahooQuotes = Array.isArray(yahooData?.quotes) ? yahooData.quotes : [];
    }

    const saList = Array.isArray(saData)
      ? saData.map((item) => ({
          s: (item?.s || item?.symbol || "").toUpperCase(),
          n: item?.n || item?.name || "",
        }))
      : [];

    const yahooList = yahooQuotes
      .map((item) => ({
        s: (item?.symbol || "").toUpperCase(),
        n: item?.shortname || item?.longname || item?.symbol || "",
      }))
      .filter((item) => item.s && item.n);

    const merged = [...localResults];
    for (const item of [...saList, ...yahooList]) {
      if (!item.s) continue;
      if (!merged.some((m) => m.s === item.s)) {
        merged.push(item);
      }
      if (merged.length >= 8) break;
    }

    if (merged.length > 0) return Response.json(merged.slice(0, 8));

    // 최후 폴백: 기존 StockAnalysis 단일 요청
    const res = await fetch(`https://stockanalysis.com/api/search?q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return Response.json([]);
    const data = await res.json();
    return Response.json(Array.isArray(data) ? data.slice(0, 8) : []);
  } catch (err) {
    return Response.json(localResults.slice(0, 8));
  }
}
