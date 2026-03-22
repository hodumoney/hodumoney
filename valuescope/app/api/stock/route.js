export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  const KEY = process.env.FMP_API_KEY;

  if (!KEY) {
    return Response.json({ error: "NO_API_KEY", step: 1 });
  }

  try {
    const url = `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${KEY}`;
    const res = await fetch(url);
    const text = await res.text();

    return Response.json({
      step: 2,
      status: res.status,
      keyPrefix: KEY.substring(0, 6) + "...",
      symbol: symbol,
      raw: text.substring(0, 500),
    });
  } catch (err) {
    return Response.json({ error: err.message, step: "fetch_failed" });
  }
}