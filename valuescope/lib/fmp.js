const BASE = "https://financialmodelingprep.com/stable";
const KEY = process.env.FMP_API_KEY;

async function fmpFetch(path) {
  const sep = path.includes("?") ? "&" : "?";
  const url = BASE + path + sep + "apikey=" + KEY;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data["Error Message"]) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export async function getProfile(symbol) {
  const d = await fmpFetch("/profile?symbol=" + symbol);
  return Array.isArray(d) ? d[0] || null : null;
}

export async function getQuote(symbol) {
  const d = await fmpFetch("/quote?symbol=" + symbol);
  return Array.isArray(d) ? d[0] || null : null;
}

export async function getIncomeQuarterly(symbol) {
  const d = await fmpFetch("/income-statement?symbol=" + symbol + "&period=quarter&limit=5");
  return Array.isArray(d) ? d : [];
}

export async function getBalanceQuarterly(symbol) {
  const d = await fmpFetch("/balance-sheet-statement?symbol=" + symbol + "&period=quarter&limit=5");
  return Array.isArray(d) ? d : [];
}

export async function getCashflowQuarterly(symbol) {
  const d = await fmpFetch("/cash-flow-statement?symbol=" + symbol + "&period=quarter&limit=5");
  return Array.isArray(d) ? d : [];
}

export async function getIncomeAnnual(symbol) {
  const d = await fmpFetch("/income-statement?symbol=" + symbol + "&period=annual&limit=5");
  return Array.isArray(d) ? d : [];
}

export async function getBalanceAnnual(symbol) {
  const d = await fmpFetch("/balance-sheet-statement?symbol=" + symbol + "&period=annual&limit=5");
  return Array.isArray(d) ? d : [];
}

export async function getCashflowAnnual(symbol) {
  const d = await fmpFetch("/cash-flow-statement?symbol=" + symbol + "&period=annual&limit=5");
  return Array.isArray(d) ? d : [];
}

export async function searchSymbol(query) {
  const d = await fmpFetch("/search?query=" + encodeURIComponent(query) + "&limit=10");
  return Array.isArray(d) ? d : [];
}

export async function getHistoricalPrice(symbol, from, to) {
  const d = await fmpFetch("/historical-price-eod/full?symbol=" + symbol + "&from=" + from + "&to=" + to);
  return Array.isArray(d) ? d : (d && d.historical ? d.historical : []);
}
