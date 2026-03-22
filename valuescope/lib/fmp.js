// lib/fmp.js — Financial Modeling Prep API 호출 헬퍼
// 서버 사이드에서만 실행됨 (API 키 노출 방지)

const BASE = "https://financialmodelingprep.com/api/v3";
const KEY = process.env.FMP_API_KEY;

async function fmpFetch(path) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}apikey=${KEY}`;
  const res = await fetch(url, { next: { revalidate: 300 } }); // 5분 캐시
  if (!res.ok) throw new Error(`FMP ${res.status}: ${path}`);
  return res.json();
}

// ── 기업 프로필 (이름, 설명, 시가총액 등) ──
export async function getProfile(symbol) {
  const data = await fmpFetch(`/profile/${symbol}`);
  return data[0] || null;
}

// ── 실시간 시세 ──
export async function getQuote(symbol) {
  const data = await fmpFetch(`/quote/${symbol}`);
  return data[0] || null;
}

// ── 분기 손익계산서 (최근 5분기) ──
export async function getIncomeQuarterly(symbol) {
  return fmpFetch(`/income-statement/${symbol}?period=quarter&limit=5`);
}

// ── 분기 재무상태표 ──
export async function getBalanceQuarterly(symbol) {
  return fmpFetch(`/balance-sheet-statement/${symbol}?period=quarter&limit=5`);
}

// ── 분기 현금흐름표 ──
export async function getCashflowQuarterly(symbol) {
  return fmpFetch(`/cash-flow-statement/${symbol}?period=quarter&limit=5`);
}

// ── 연간 손익계산서 ──
export async function getIncomeAnnual(symbol) {
  return fmpFetch(`/income-statement/${symbol}?limit=5`);
}

// ── 연간 재무상태표 ──
export async function getBalanceAnnual(symbol) {
  return fmpFetch(`/balance-sheet-statement/${symbol}?limit=5`);
}

// ── 연간 현금흐름표 ──
export async function getCashflowAnnual(symbol) {
  return fmpFetch(`/cash-flow-statement/${symbol}?limit=5`);
}

// ── 핵심 밸류에이션 지표 ──
export async function getKeyMetrics(symbol, period = "quarter") {
  return fmpFetch(`/key-metrics/${symbol}?period=${period}&limit=5`);
}

// ── 재무 비율 ──
export async function getRatios(symbol, period = "quarter") {
  return fmpFetch(`/ratios/${symbol}?period=${period}&limit=5`);
}

// ── 주가 차트 (1년) ──
export async function getHistoricalPrice(symbol) {
  return fmpFetch(`/historical-price-full/${symbol}?timeseries=365`);
}

// ── 주요 지수 시세 ──
export async function getIndexQuotes() {
  // FMP에서 제공하는 주요 지수
  const symbols = "^GSPC,^IXIC,^DJI,^RUT,^KS11,^KQ11";
  return fmpFetch(`/quote/${symbols}`);
}

// ── 경제 지표: 미국 국채 금리 ──
export async function getTreasuryRates() {
  return fmpFetch("/treasury?from=2024-01-01");
}

// ── Fear & Greed 관련 (VIX) ──
export async function getVixQuote() {
  const data = await fmpFetch("/quote/^VIX");
  return data[0] || null;
}

// ── 환율 ──
export async function getForex(pair = "USDKRW") {
  const data = await fmpFetch(`/fx/${pair}`);
  return data[0] || null;
}

// ── 종목 검색 ──
export async function searchSymbol(query) {
  return fmpFetch(`/search?query=${encodeURIComponent(query)}&limit=10`);
}
