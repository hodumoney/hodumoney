// lib/fmp.js — Financial Modeling Prep API
const BASE = "https://financialmodelingprep.com/api/v3";
const KEY = process.env.FMP_API_KEY;

async function fmpFetch(path) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}apikey=${KEY}`;
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data["Error Message"]) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export async function getProfile(symbol) {
  const d = await fmpFetch(`/profile/${symbol}`);
  return Array.isArray(d) ? d[0] || null : null;
}

export async function getQuote(symbol) {
  const d = await fmpFetch(`/quote/${symbol}`);
  return Array.isArray(d) ? d[0] || null : null;
}

export async function getIncomeQuarterly(symbol) {
  const d = await fmpFetch(`/income-statement/${symbol}?period=quarter&limit=5`);
  return Array.isArray(d) ? d : [];
}

export async function getBalanceQuarterly(symbol) {
  const d = await fmpFetch(`/balance-sheet-statement/${symbol}?period=quarter&limit=5`);
  return Array.isArray(d) ? d : [];
}

export async function getCashflowQuarterly(symbol) {
  const d = await fmpFetch(`/cash-flow-statement/${symbol}?period=quarter&limit=5`);
  return Array.isArray(d) ? d : [];
}

export async function getKeyMetrics(symbol) {
  const d = await fmpFetch(`/key-metrics/${symbol}?period=quarter&limit=5`);
  return Array.isArray(d) ? d : [];
}

export async function getRatios(symbol) {
  const d = await fmpFetch(`/ratios/${symbol}?period=quarter&limit=5`);
  return Array.isArray(d) ? d : [];
}

export async function searchSymbol(query) {
  const d = await fmpFetch(`/search?query=${encodeURIComponent(query)}&limit=10`);
  return Array.isArray(d) ? d : [];
}
