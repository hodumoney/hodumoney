// app/api/stock/route.js
import {
  getProfile, getQuote, getIncomeQuarterly, getBalanceQuarterly,
  getCashflowQuarterly, getKeyMetrics, getRatios,
} from "@/lib/fmp";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return Response.json({ error: "symbol 파라미터가 필요합니다" }, { status: 400 });
  }

  try {
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

    if (!profile && !quote) {
      return Response.json({ error: `${symbol} 종목을 찾을 수 없습니다` }, { status: 404 });
    }

    const safe = (v) => (typeof v === "number" && isFinite(v)) ? v : 0;

    const incR = (income || []).slice(0, 5).reverse();
    const balR = (balance || []).slice(0, 5).reverse();
    const cfR = (cashflow || []).slice(0, 5).reverse();
    const metR = (metrics || []).slice(0, 5).reverse();
    const ratR = (ratios || []).slice(0, 5).reverse();

    const makeLabel = (dateStr) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const y = String(d.getFullYear()).slice(-2);
      const q = Math.ceil((d.getMonth() + 1) / 3);
      return `${y}Q${q}`;
    };

    const labels = incR.map(r => makeLabel(r.date));

    const result = {
      name: profile?.companyName || quote?.name || symbol,
      ticker: symbol,
      exchange: profile?.exchangeShortName || "",
      description: profile?.description ? profile.description.split(".")[0] + "." : "",
      sector: profile?.sector || "",
      industry: profile?.industry || "",

      price: safe(quote?.price),
      marketCap: safe(quote?.marketCap),
      dailyChange: quote?.changesPercentage ? safe(quote.changesPercentage) / 100 : 0,
      yearHigh: safe(quote?.yearHigh),
      yearLow: safe(quote?.yearLow),
      volume: safe(quote?.volume),
      beta: safe(profile?.beta),

      labels,

      coreMetrics: {
        per: { value: safe(quote?.pe), trend: metR.map(m => safe(m.peRatio)), meaning: "회사가 1년에 버는 돈에 비해 주가가 얼마나 비싼지" },
        pbr: { value: safe(ratR[ratR.length - 1]?.priceToBookRatio), trend: ratR.map(m => safe(m.priceToBookRatio)), meaning: "회사의 순자산에 비해 주가가 얼마나 비싼지" },
        eps: { value: safe(incR[incR.length - 1]?.epsdiluted), trend: incR.map(m => safe(m.epsdiluted)), meaning: "주식 한 주당 회사가 벌어들이는 이익" },
        de: { value: safe(metR[metR.length - 1]?.debtToEquity), trend: metR.map(m => safe(m.debtToEquity)), meaning: "자기자본 대비 빚의 비율" },
        roe: { value: safe(ratR[ratR.length - 1]?.returnOnEquity) * 100, trend: ratR.map(m => safe(m.returnOnEquity) * 100), meaning: "자기자본으로 얼마나 효율적으로 이익을 냈는지" },
        div: { value: safe(ratR[ratR.length - 1]?.dividendYield) * 100, trend: ratR.map(m => safe(m.dividendYield) * 100), meaning: "배당으로 받는 수익률" },
        ebitda: { value: safe(incR[incR.length - 1]?.ebitda) / 1e6, trend: incR.map(m => safe(m.ebitda) / 1e6), meaning: "실제로 벌어들인 현금 흐름" },
      },

      financials: {
        income: {
          labels,
          revenue: incR.map(r => Math.round(safe(r.revenue) / 1e6)),
          grossProfit: incR.map(r => Math.round(safe(r.grossProfit) / 1e6)),
          operatingIncome: incR.map(r => Math.round(safe(r.operatingIncome) / 1e6)),
          netIncome: incR.map(r => Math.round(safe(r.netIncome) / 1e6)),
        },
        balance: {
          labels,
          totalAssets: balR.map(r => Math.round(safe(r.totalAssets) / 1e6)),
          currentLiab: balR.map(r => Math.round(safe(r.totalCurrentLiabilities) / 1e6)),
          equity: balR.map(r => Math.round(safe(r.totalStockholdersEquity) / 1e6)),
        },
        cashflow: {
          labels,
          fcf: cfR.map(r => Math.round(safe(r.freeCashFlow) / 1e6)),
          opCash: cfR.map(r => Math.round(safe(r.operatingCashFlow) / 1e6)),
          invCash: cfR.map(r => Math.round(safe(r.netCashUsedForInvestingActivites) / 1e6)),
          finCash: cfR.map(r => Math.round(safe(r.netCashUsedProvidedByFinancingActivities) / 1e6)),
          netChange: cfR.map(r => Math.round(safe(r.netChangeInCash) / 1e6)),
        },
        advanced: {
          labels,
          evEbitda: metR.map(m => safe(m.enterpriseValueOverEBITDA)),
          pe: metR.map(m => safe(m.peRatio)),
          peg: metR.map(m => safe(m.pegRatio)),
          opMargin: ratR.map(m => safe(m.operatingProfitMargin)),
          netMargin: ratR.map(m => safe(m.netProfitMargin)),
        },
        shares: {
          quarterly: incR.map(r => Math.round(safe(r.weightedAverageShsOutDil) / 1e6)),
          yearly: incR.map(r => Math.round(safe(r.weightedAverageShsOutDil) / 1e6)),
        }
      }
    };

    return Response.json(result);
  } catch (err) {
    console.error("Stock API error:", err);
    return Response.json({ error: "데이터를 가져오는 중 오류가 발생했습니다: " + err.message }, { status: 500 });
  }
}
