// app/api/stock/route.js
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return Response.json({ error: "symbol 필요" }, { status: 400 });
  }

  const KEY = process.env.FMP_API_KEY;

  // 1. API 키 확인
  if (!KEY) {
    return Response.json({ error: "FMP_API_KEY가 설정되지 않았습니다", step: 1 });
  }

  // 2. FMP 직접 호출 테스트
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
    return Response.json({ error: err.message, step: "fetch failed" });
  }
}
```

저장 후 터미널에서:
```
git add .
```
```
git commit -m "debug api"
```
```
git push
```

1~2분 후 브라우저에서 다시 테스트:
```
https://본인사이트주소/api/stock?symbol=AAPL

