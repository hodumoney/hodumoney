// lib/stockanalysis.js — StockAnalysis.com HTML 스크래핑
// 원래 앱스크립트의 fetchStockAnalysis + parseHTMLTable 방식과 동일

const SA_BASE = "https://stockanalysis.com/stocks";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };

async function fetchSAPage(ticker, path, quarterly) {
  const q = quarterly ? "?p=quarterly" : "";
  const url = `${SA_BASE}/${ticker.toLowerCase()}/${path}/${q}`;
  try {
    const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    return null;
  }
}

function parseHTMLTable(html) {
  if (!html) return {};
  const dataMap = {};
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return dataMap;
  const rows = tbodyMatch[1].split("</tr>");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.includes("<td")) continue;
    const nameMatch = row.match(/<td[^>]*>(.*?)<\/td>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
    const values = [];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    for (let j = 1; j < cells.length; j++) {
      let valStr = cells[j][1].replace(/<[^>]*>/g, "").trim();
      let val = 0;
      if (valStr !== "-" && valStr !== "" && valStr !== "n/a") {
        valStr = valStr.replace(/,/g, "").replace("%", "");
        val = parseFloat(valStr);
        if (isNaN(val)) val = 0;
      }
      values.push(val);
    }
    dataMap[name] = values;
  }
  return dataMap;
}

function getRowData(map, aliases) {
  const keys = Object.keys(map);
  for (const alias of aliases) {
    const target = alias.toLowerCase();
    for (const k of keys) {
      if (k.toLowerCase() === target) return map[k];
    }
    for (const k of keys) {
      if (k.toLowerCase().includes(target)) return map[k];
    }
  }
  return [0, 0, 0, 0, 0];
}

// ── 손익계산서 ──
export async function getIncomeStatement(ticker, quarterly = true) {
  const html = await fetchSAPage(ticker, "financials", quarterly);
  const data = parseHTMLTable(html);
  return {
    revenue: getRowData(data, ["Revenue", "Total Revenue"]),
    grossProfit: getRowData(data, ["Gross Profit"]),
    operatingIncome: getRowData(data, ["Operating Income"]),
    netIncome: getRowData(data, ["Net Income"]),
    ebitda: getRowData(data, ["EBITDA"]),
    eps: getRowData(data, ["EPS (Diluted)", "EPS (Basic)", "EPS"]),
    sharesOut: getRowData(data, ["Shares Outstanding (Diluted)", "Shares Outstanding (Basic)", "Shares Outstanding"]),
    _raw: data,
  };
}

// ── 재무상태표 ──
export async function getBalanceSheet(ticker, quarterly = true) {
  const html = await fetchSAPage(ticker, "financials/balance-sheet", quarterly);
  const data = parseHTMLTable(html);
  return {
    totalAssets: getRowData(data, ["Total Assets"]),
    currentLiab: getRowData(data, ["Total Current Liabilities"]),
    equity: getRowData(data, ["Total Equity", "Shareholders' Equity", "Total Shareholders' Equity"]),
    totalDebt: getRowData(data, ["Total Debt"]),
    _raw: data,
  };
}

// ── 현금흐름표 ──
export async function getCashFlow(ticker, quarterly = true) {
  const html = await fetchSAPage(ticker, "financials/cash-flow-statement", quarterly);
  const data = parseHTMLTable(html);
  return {
    fcf: getRowData(data, ["Free Cash Flow"]),
    opCash: getRowData(data, ["Operating Cash Flow"]),
    invCash: getRowData(data, ["Investing Cash Flow"]),
    finCash: getRowData(data, ["Financing Cash Flow"]),
    netChange: getRowData(data, ["Net Change in Cash", "Net Cash Flow"]),
    _raw: data,
  };
}

// ── 밸류에이션 비율 ──
export async function getRatios(ticker, quarterly = true) {
  const html = await fetchSAPage(ticker, "financials/ratios", quarterly);
  const data = parseHTMLTable(html);
  return {
    pe: getRowData(data, ["PE Ratio"]),
    pb: getRowData(data, ["PB Ratio"]),
    deRatio: getRowData(data, ["Debt / Equity Ratio"]),
    roe: getRowData(data, ["Return on Equity (ROE)"]),
    divYield: getRowData(data, ["Dividend Yield"]),
    evEbitda: getRowData(data, ["EV / EBITDA", "EV/EBITDA"]),
    peg: getRowData(data, ["PEG Ratio"]),
    opMargin: getRowData(data, ["Operating Margin"]),
    netMargin: getRowData(data, ["Net Profit Margin", "Profit Margin"]),
    marketCap: getRowData(data, ["Market Capitalization", "Market Cap"]),
    _raw: data,
  };
}

// ── 날짜 라벨 추출 ──
export function extractLabels(html, quarterly = true) {
  if (!html) return [];
  // 테이블 헤더에서 날짜 추출
  const theadMatch = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/);
  if (!theadMatch) return [];
  const headerCells = [...theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)];
  const labels = [];
  for (let i = 1; i < headerCells.length; i++) {
    const text = headerCells[i][1].replace(/<[^>]*>/g, "").trim();
    if (text && text !== "TTM" && text !== "Current") labels.push(text);
  }
  return labels;
}

export async function getLabels(ticker, quarterly = true) {
  const html = await fetchSAPage(ticker, "financials", quarterly);
  return extractLabels(html, quarterly);
}
