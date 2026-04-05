// app/api/search/route.js — 전체 한국 종목 검색 (2,618개 JSON) + Yahoo/StockAnalysis
export const dynamic = "force-dynamic";

import { readFileSync } from "fs";
import { join } from "path";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

// ─── 전체 한국 종목 로드 (빌드 시 JSON 파일에서 한 번만 읽음) ────
let krStocks = null;

function getKrStocks() {
  if (krStocks) return krStocks;
  try {
    const filePath = join(process.cwd(), "public", "kr_stocks.json");
    const raw = readFileSync(filePath, "utf-8");
    krStocks = JSON.parse(raw);
    console.log(`KR stocks loaded: ${krStocks.length} companies`);
  } catch (e) {
    console.error("Failed to load kr_stocks.json:", e.message);
    krStocks = [];
  }
  return krStocks;
}

/**
 * 한글/숫자 검색: 전체 한국 종목에서 검색
 */
function searchKorean(query) {
  const stocks = getKrStocks();
  if (!stocks || stocks.length === 0) return [];

  const q = query.trim().toLowerCase();
  
  // 정확히 시작하는 종목 우선, 그 다음 포함하는 종목
  const startsWithMatches = [];
  const includesMatches = [];
  
  for (const stock of stocks) {
    const name = stock.n.toLowerCase();
    if (name.startsWith(q) || stock.s.startsWith(q)) {
      startsWithMatches.push(stock);
    } else if (name.includes(q)) {
      includesMatches.push(stock);
    }
  }
  
  return [...startsWithMatches, ...includesMatches]
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

  // 1. 한글 검색어 → 전체 한국 종목에서 즉시 검색
  if (hasKorean(q)) {
    const krResults = searchKorean(q);
    if (krResults.length > 0) return Response.json(krResults);
  }

  // 2. 숫자로 시작 → 한국 종목코드 검색
  if (/^\d{1,6}$/.test(q.trim())) {
    const numResults = searchKorean(q);
    if (numResults.length > 0) return Response.json(numResults);
  }

  // 3. 영어 → Yahoo → StockAnalysis
  let results = await searchYahoo(q);
  if (results.length === 0) {
    results = await searchStockAnalysis(q);
  }

  return Response.json(results);
}
