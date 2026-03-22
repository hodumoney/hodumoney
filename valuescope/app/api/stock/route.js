import {
  getProfile, getQuote, getIncomeQuarterly, getBalanceQuarterly,
  getCashflowQuarterly, getKeyMetrics, getRatios,
} from "@/lib/fmp";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
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
      return Response.json({ error: symbol + " not found" }, { status: 404 });
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
      return y + "Q" + q;
    };

    const labels = incR.map(r => makeLabel(r.date || r.fillingDate));

    return Response.json({
      name: profile?.companyName || quote?.name || symbol,
      ticker: symbol,
      exchange: profile?.exchange || "",
      description: profile?.description ? profile.description.split(".")[0] + "." : "",
      sector: profile?.sector || "",
      industry: profile?.industry || "",
      price: safe(quote?.price || profile?.price),
      marketCap: safe(quote?.marketCap || profile?.marketCap),
      dailyChange: safe(quote?.changePercentage || profile?.changePercentage) / 100,
      yearHigh: safe(profile?.range ? parseFloat(profile.range.split("-")[1]) : 0),
      yearLow: safe(profile?.range ? parseFloat(profile.range.split("-")[0]) : 0),
      volume: safe(quote?.volume || profile?.volume),
      beta: safe(profile?.beta),
      labels,
      coreMetrics: {
        per: { value: safe(ratR[ratR.length-1]?.priceEarningsRatio || metR[metR.length-1]?.peRatio), trend: ratR.map(m => safe(m.priceEarningsRatio || 0)), meaning: "1\ub144 \uc774\uc775 \ub300\ube44 \uc8fc\uac00 \uc218\uc900" },
        pbr: { value: safe(ratR[ratR.length-1]?.priceToBookRatio), trend: ratR.map(m => safe(m.priceToBookRatio)), meaning: "\uc21c\uc790\uc0b0 \ub300\ube44 \uc8fc\uac00 \uc218\uc900" },
        eps: { value: safe(incR[incR.length-1]?.epsdiluted || incR[incR.length-1]?.eps), trend: incR.map(m => safe(m.epsdiluted || m.eps)), meaning: "\uc8fc\ub2f9 \uc21c\uc774\uc775" },
        de: { value: safe(metR[metR.length-1]?.debtToEquity), trend: metR.map(m => safe(m.debtToEquity)), meaning: "\uc790\uae30\uc790\ubcf8 \ub300\ube44 \ubd80\ucc44 \ube44\uc728" },
        roe: { value: safe(ratR[ratR.length-1]?.returnOnEquity) * 100, trend: ratR.map(m => safe(m.returnOnEquity) * 100), meaning: "\uc790\uae30\uc790\ubcf8 \ub300\ube44 \uc774\uc775\ub960" },
        div: { value: safe(ratR[ratR.length-1]?.dividendYield) * 100, trend: ratR.map(m => safe(m.dividendYield) * 100), meaning: "\ubc30\ub2f9 \uc218\uc775\ub960" },
        ebitda: { value: safe(incR[incR.length-1]?.ebitda) / 1e6, trend: incR.map(m => safe(m.ebitda) / 1e6), meaning: "\uc601\uc5c5 \ud604\uae08 \ucc3d\ucd9c\ub825" },
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
          quarterly: incR.map(r => Math.round(safe(r.weightedAverageShsOutDil || r.weightedAverageShsOut) / 1e6)),
          yearly: incR.map(r => Math.round(safe(r.weightedAverageShsOutDil || r.weightedAverageShsOut) / 1e6)),
        }
      }
    });
  } catch (err) {
    return Response.json({ error: "Data fetch error: " + err.message }, { status: 500 });
  }
}