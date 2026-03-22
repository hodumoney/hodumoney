// app/api/stock/route.js — 기업 분석 데이터 API
import {
  getProfile, getQuote, getIncomeQuarterly, getBalanceQuarterly,
  getCashflowQuarterly, getKeyMetrics, getRatios, getHistoricalPrice,
} from "@/lib/fmp";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return Response.json({ error: "symbol 파라미터가 필요합니다" }, { status: 400 });
  }

  try {
    // 병렬로 모든 데이터 가져오기 (속도 최적화)
    const [profile, quote, income, balance, cashflow, metrics, ratios] =
      await Promise.all([
        getProfile(symbol),
        getQuote(symbol),
        getIncomeQuarterly(symbol),
        getBalanceQuarterly(symbol),
        getCashflowQuarterly(symbol),
        getKeyMetrics(symbol),
        getRatios(symbol),
      ]);

    if (!profile) {
      return Response.json({ error: "종목을 찾을 수 없습니다" }, { status: 404 });
    }

    // 분기 데이터는 최신순으로 오므로 reverse (과거→최신)
    const incR = (income || []).slice(0, 5).reverse();
    const balR = (balance || []).slice(0, 5).reverse();
    const cfR = (cashflow || []).slice(0, 5).reverse();
    const metR = (metrics || []).slice(0, 5).reverse();
    const ratR = (ratios || []).slice(0, 5).reverse();

    // 분기 라벨 생성 (예: "24Q3")
    const makeLabel = (dateStr) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const y = String(d.getFullYear()).slice(-2);
      const q = Math.ceil((d.getMonth() + 1) / 3);
      return `${y}Q${q}`;
    };

    const labels = incR.map(r => makeLabel(r.date));

    const result = {
      // 기본 정보
      name: profile.companyName,
      ticker: profile.symbol,
      exchange: profile.exchangeShortName,
      description: profile.description?.split(".")[0] + ".",
      sector: profile.sector,
      industry: profile.industry,

      // 시세
      price: quote?.price || 0,
      marketCap: quote?.marketCap || 0,
      dailyChange: quote?.changesPercentage ? quote.changesPercentage / 100 : 0,
      yearHigh: quote?.yearHigh || 0,
      yearLow: quote?.yearLow || 0,
      volume: quote?.volume || 0,
      beta: profile.beta || 0,

      // 수익률 (간이 계산)
      labels,

      // 핵심 밸류에이션
      coreMetrics: {
        per: { value: quote?.pe || 0, trend: metR.map(m => m.peRatio || 0), meaning: "회사가 1년에 버는 돈에 비해 주가가 얼마나 비싼지" },
        pbr: { value: ratR[ratR.length - 1]?.priceToBookRatio || 0, trend: ratR.map(m => m.priceToBookRatio || 0), meaning: "회사의 순자산에 비해 주가가 얼마나 비싼지" },
        eps: { value: incR[incR.length - 1]?.epsdiluted || 0, trend: incR.map(m => m.epsdiluted || 0), meaning: "주식 한 주당 회사가 벌어들이는 이익" },
        de: { value: metR[metR.length - 1]?.debtToEquity || 0, trend: metR.map(m => m.debtToEquity || 0), meaning: "자기자본 대비 빚의 비율" },
        roe: { value: (ratR[ratR.length - 1]?.returnOnEquity || 0) * 100, trend: ratR.map(m => (m.returnOnEquity || 0) * 100), meaning: "자기자본으로 얼마나 효율적으로 이익을 냈는지" },
        div: { value: (ratR[ratR.length - 1]?.dividendYield || 0) * 100, trend: ratR.map(m => (m.dividendYield || 0) * 100), meaning: "배당으로 받는 수익률" },
        ebitda: { value: incR[incR.length - 1]?.ebitda ? incR[incR.length - 1].ebitda / 1e6 : 0, trend: incR.map(m => m.ebitda ? m.ebitda / 1e6 : 0), meaning: "실제로 벌어들인 현금 흐름" },
      },

      // 재무제표
      financials: {
        income: {
          labels,
          revenue: incR.map(r => Math.round((r.revenue || 0) / 1e6)),
          grossProfit: incR.map(r => Math.round((r.grossProfit || 0) / 1e6)),
          operatingIncome: incR.map(r => Math.round((r.operatingIncome || 0) / 1e6)),
          netIncome: incR.map(r => Math.round((r.netIncome || 0) / 1e6)),
        },
        balance: {
          labels,
          totalAssets: balR.map(r => Math.round((r.totalAssets || 0) / 1e6)),
          currentLiab: balR.map(r => Math.round((r.totalCurrentLiabilities || 0) / 1e6)),
          equity: balR.map(r => Math.round((r.totalStockholdersEquity || 0) / 1e6)),
        },
        cashflow: {
          labels,
          fcf: cfR.map(r => Math.round((r.freeCashFlow || 0) / 1e6)),
          opCash: cfR.map(r => Math.round((r.operatingCashFlow || 0) / 1e6)),
          invCash: cfR.map(r => Math.round((r.netCashUsedForInvestingActivites || 0) / 1e6)),
          finCash: cfR.map(r => Math.round((r.netCashUsedProvidedByFinancingActivities || 0) / 1e6)),
          netChange: cfR.map(r => Math.round((r.netChangeInCash || 0) / 1e6)),
        },
        advanced: {
          labels,
          evEbitda: metR.map(m => m.enterpriseValueOverEBITDA || 0),
          pe: metR.map(m => m.peRatio || 0),
          peg: metR.map(m => m.pegRatio || 0),
          opMargin: ratR.map(m => m.operatingProfitMargin || 0),
          netMargin: ratR.map(m => m.netProfitMargin || 0),
        },
        shares: {
          quarterly: incR.map(r => Math.round((r.weightedAverageShsOutDil || 0) / 1e6)),
        }
      }
    };

    return Response.json(result);
  } catch (err) {
    console.error("Stock API error:", err);
    return Response.json({ error: "데이터를 가져오는 중 오류가 발생했습니다" }, { status: 500 });
  }
}
