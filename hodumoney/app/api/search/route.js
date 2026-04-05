// app/api/search/route.js — 전체 한국 종목 검색 (KRX API 캐시) + Yahoo/StockAnalysis
export const dynamic = "force-dynamic";
const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

// ─── KRX 전체 종목 캐시 ─────────────────────────────────────────
let krxCache = null;
let krxCacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

/**
 * KRX(한국거래소) 전체 상장 종목 로드
 * 첫 검색 시 한 번만 호출, 이후 24시간 캐시
 */
async function loadKrxStocks() {
  if (krxCache && (Date.now() - krxCacheTime) < CACHE_TTL) {
    return krxCache;
  }

  try {
    const res = await fetch("http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd", {
      method: "POST",
      headers: {
        ...UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020201",
      },
      body: "bld=dbms/MDC/STAT/standard/MDCSTAT01901&locale=ko_KR&mktId=ALL&share=1&csvxls_isNo=false",
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("KRX API failed:", res.status);
      return krxCache || [];
    }

    const data = await res.json();
    const items = data?.OutBlock_1 || [];

    krxCache = items
      .filter(item => {
        const code = item.ISU_SRT_CD || "";
        return /^\d{6}$/.test(code);
      })
      .map(item => ({
        s: item.ISU_SRT_CD || "",
        n: item.ISU_ABBRV || "",
        e: (item.MKT_NM || "").includes("코스닥") ? "KOSDAQ" : "KRX",
      }));

    krxCacheTime = Date.now();
    console.log(`KRX cache loaded: ${krxCache.length} stocks`);
    return krxCache;
  } catch (e) {
    console.error("KRX load error:", e.message);
    return krxCache || [];
  }
}

/**
 * 한글/숫자 검색: KRX 캐시에서 검색
 */
async function searchKorean(query) {
  const stocks = await loadKrxStocks();
  if (!stocks || stocks.length === 0) return [];

  const q = query.trim().toLowerCase();
  return stocks
    .filter(stock => stock.n.toLowerCase().includes(q) || stock.s.startsWith(q))
    .slice(0, 10)
    .map(stock => ({
      s: stock.s,
      n: stock.n,
      t: "Stock",
      e: stock.e,
      isKrx: true,
    }));
}

function hasKorean(text) {
  return /[가-힣]/.test(text);
}

// ─── Yahoo / StockAnalysis (미국 주식용) ─────────────────────────
async function searchYahoo(query) {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      query
    )}&quotesCount=10&newsCount=0&listsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`;
    const res = await fetch(url, { headers: UA, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const quotes = data?.quotes || [];
    return quotes
      .filter((q) => q.quoteType === "EQUITY" || q.quoteType === "ETF")
      .map((q) => {
        let symbol = q.symbol || "";
        let exchange = q.exchange || "";
        let isKrx = false;
        if (symbol.endsWith(".KS")) {
          symbol = symbol.replace(".KS", "");
          exchange = "KRX";
          isKrx = true;
        } else if (symbol.endsWith(".KQ")) {
          symbol = symbol.replace(".KQ", "");
          exchange = "KOSDAQ";
          isKrx = true;
        }
        return {
          s: symbol,
          n: q.longname || q.shortname || q.symbol || "",
          t: q.quoteType === "ETF" ? "ETF" : "Stock",
          e: exchange,
          isKrx,
        };
      })
      .slice(0, 8);
  } catch {
    return [];
  }
}

async function searchStockAnalysis(query) {
  try {
    const url = `https://stockanalysis.com/api/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: UA, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.slice(0, 8).map((item) => ({
      s: item.s || item.symbol || "",
      n: item.n || item.name || "",
      t: item.t || "Stock",
      e: item.e || "",
      isKrx: false,
    }));
  } catch {
    return [];
  }
}

// ─── GET handler ─────────────────────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q || q.length < 1) return Response.json([]);

  // 1. 한글 검색어 → KRX 전체 종목에서 검색
  if (hasKorean(q)) {
    const krResults = await searchKorean(q);
    if (krResults.length > 0) return Response.json(krResults);
  }

  // 2. 숫자 → 한국 종목코드 검색
  if (/^\d{1,6}$/.test(q.trim())) {
    const numResults = await searchKorean(q);
    if (numResults.length > 0) return Response.json(numResults);
  }

  // 3. 영어 → Yahoo → StockAnalysis
  let results = await searchYahoo(q);
  if (results.length === 0) {
    results = await searchStockAnalysis(q);
  }

  return Response.json(results);
}
