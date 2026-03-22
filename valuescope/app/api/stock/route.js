export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  const KEY = process.env.FMP_API_KEY;

  try {
    const url = `https://financialmodelingprep.com/stable/profile?symbol=${symbol}&apikey=${KEY}`;
    const res = await fetch(url);
    const text = await res.text();

    return Response.json({
      step: "stable-api",
      status: res.status,
      symbol: symbol,
      raw: text.substring(0, 500),
    });
  } catch (err) {
    return Response.json({ error: err.message });
  }
}