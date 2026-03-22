import {
  getProfile, getQuote,
  getIncomeQuarterly, getBalanceQuarterly, getCashflowQuarterly,
  getIncomeAnnual, getBalanceAnnual, getCashflowAnnual,
} from "@/lib/fmp";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const [profile, quote, incQ, balQ, cfQ, incA, balA, cfA] =
      await Promise.all([
        getProfile(symbol),
        getQuote(symbol),
        getIncomeQuarterly(symbol),
        getBalanceQuarterly(symbol),
        getCashflowQuarterly(symbol),
        getIncomeAnnual(symbol),
        getBalanceAnnual(symbol),
        getCashflowAnnual(symbol),
      ]);

    if (!profile && !quote) {
      return Response.json({ error: symbol + " not found" }, { status: 404 });
    }

    const safe = (v) => (typeof v === "number" && isFinite(v)) ? v : 0;
    const price = safe(quote?.price || profile?.price);
    const mktCap = safe(quote?.marketCap || profile?.marketCap);
    const divYield = safe(profile?.lastDividend) / (price || 1) * 100;

    // reverse: oldest first
    const incQR = (incQ || []).slice(0, 5).reverse();
    const balQR = (balQ || []).slice(0, 5).reverse();
    const cfQR = (cfQ || []).slice(0, 5).reverse();
    const incAR = (incA || []).slice(0, 5).reverse();
    const balAR = (balA || []).slice(0, 5).reverse();
    const cfAR = (cfA || []).slice(0, 5).reverse();

    const qLabel = (dateStr) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return String(d.getFullYear()).slice(-2) + "Q" + Math.ceil((d.getMonth() + 1) / 3);
    };

    const yLabel = (dateStr) => {
      if (!dateStr) return "";
      return String(new Date(dateStr).getFullYear());
    };

    const labelsQ = incQR.map(r => qLabel(r.date || r.fillingDate));
    const labelsA = incAR.map(r => yLabel(r.date || r.fillingDate));

    // helper functions
    const calcPER = (inc, p) => {
      const eps = safe(inc?.epsdiluted || inc?.eps);
      return eps !== 0 ? p / (eps * 4) : 0;
    };
    const calcPERAnnual = (inc, p) => {
      const eps = safe(inc?.epsdiluted || inc?.eps);
      return eps !== 0 ? p / eps : 0;
    };
    const calcPBR = (bal, mc) => {
      const eq = safe(bal?.totalStockholdersEquity);
      return eq !== 0 ? mc / eq : 0;
    };
    const calcDE = (bal) => {
      const eq = safe(bal?.totalStockholdersEquity);
      const debt = safe(bal?.totalDebt || bal?.longTermDebt);
      return eq !== 0 ? debt / eq : 0;
    };
    const calcROE = (inc, bal, annual) => {
      const ni = safe(inc?.netIncome);
      const eq = safe(bal?.totalStockholdersEquity);
      const multiplier = annual ? 1 : 4;
      return eq !== 0 ? (ni * multiplier / eq) * 100 : 0;
    };
    const calcOpMargin = (inc) => {
      const rev = safe(inc?.revenue);
      return rev !== 0 ? safe(inc?.operatingIncome) / rev : 0;
    };
    const calcNetMargin = (inc) => {
      const rev = safe(inc?.revenue);
      return rev !== 0 ? safe(inc?.netIncome) / rev : 0;
    };
    const calcEvEbitda = (inc, mc, annual) => {
      const eb = safe(inc?.ebitda);
      const multiplier = annual ? 1 : 4;
      return eb !== 0 ? mc / (eb * multiplier) : 0;
    };

    const lastIncQ = incQR[incQR.length - 1] || {};
    const lastBalQ = balQR[balQR.length - 1] || {};
    const lastIncA = incAR[incAR.length - 1] || {};
    const lastBalA = balAR[balAR.length - 1] || {};

    const buildFinancials = (incArr, balArr, cfArr, labels, annual) => ({
      labels,
      income: {
        labels,
        revenue: incArr.map(r => Math.round(safe(r.revenue) / 1e6)),
        grossProfit: incArr.map(r => Math.round(safe(r.grossProfit) / 1e6)),
        operatingIncome: incArr.map(r => Math.round(safe(r.operatingIncome) / 1e6)),
        netIncome: incArr.map(r => Math.round(safe(r.netIncome) / 1e6)),
      },
      balance: {
        labels,
        totalAssets: balArr.map(r => Math.round(safe(r.totalAssets) / 1e6)),
        currentLiab: balArr.map(r => Math.round(safe(r.totalCurrentLiabilities) / 1e6)),
        equity: balArr.map(r => Math.round(safe(r.totalStockholdersEquity) / 1e6)),
      },
      cashflow: {
        labels,
        fcf: cfArr.map(r => Math.round(safe(r.freeCashFlow) / 1e6)),
        opCash: cfArr.map(r => Math.round(safe(r.operatingCashFlow) / 1e6)),
        invCash: cfArr.map(r => Math.round(safe(r.netCashUsedForInvestingActivites) / 1e6)),
        finCash: cfArr.map(r => Math.round(safe(r.netCashUsedProvidedByFinancingActivities) / 1e6)),
        netChange: cfArr.map(r => Math.round(safe(r.netChangeInCash) / 1e6)),
      },
      advanced: {
        labels,
        evEbitda: incArr.map(m => calcEvEbitda(m, mktCap, annual)),
        pe: incArr.map(m => annual ? calcPERAnnual(m, price) : calcPER(m, price)),
        peg: incArr.map(() => 0),
        opMargin: incArr.map(m => calcOpMargin(m)),
        netMargin: incArr.map(m => calcNetMargin(m)),
      },
      shares: {
        quarterly: incArr.map(r => Math.round(safe(r.weightedAverageShsOutDil || r.weightedAverageShsOut) / 1e6)),
        yearly: incArr.map(r => Math.round(safe(r.weightedAverageShsOutDil || r.weightedAverageShsOut) / 1e6)),
      },
      coreMetrics: {
        per: {
          value: annual ? calcPERAnnual(incArr[incArr.length-1]||{}, price) : calcPER(incArr[incArr.length-1]||{}, price),
          trend: incArr.map(m => annual ? calcPERAnnual(m, price) : calcPER(m, price)),
        },
        pbr: {
          value: calcPBR(balArr[balArr.length-1]||{}, mktCap),
          trend: balArr.map(m => calcPBR(m, mktCap)),
        },
        eps: {
          value: safe((incArr[incArr.length-1]||{}).epsdiluted || (incArr[incArr.length-1]||{}).eps),
          trend: incArr.map(m => safe(m.epsdiluted || m.eps)),
        },
        de: {
          value: calcDE(balArr[balArr.length-1]||{}),
          trend: balArr.map(m => calcDE(m)),
        },
        roe: {
          value: calcROE(incArr[incArr.length-1]||{}, balArr[balArr.length-1]||{}, annual),
          trend: incArr.map((m, i) => calcROE(m, balArr[i]||{}, annual)),
        },
        div: {
          value: divYield,
          trend: incArr.map(() => divYield),
        },
        ebitda: {
          value: safe((incArr[incArr.length-1]||{}).ebitda) / 1e6,
          trend: incArr.map(m => safe(m.ebitda) / 1e6),
        },
      }
    });

    const meanings = {
      per: "1\ub144 \uc774\uc775 \ub300\ube44 \uc8fc\uac00 \uc218\uc900",
      pbr: "\uc21c\uc790\uc0b0 \ub300\ube44 \uc8fc\uac00 \uc218\uc900",
      eps: "\uc8fc\ub2f9 \uc21c\uc774\uc775",
      de: "\uc790\uae30\uc790\ubcf8 \ub300\ube44 \ubd80\ucc44",
      roe: "\uc790\uae30\uc790\ubcf8 \ub300\ube44 \uc774\uc775\ub960",
      div: "\ubc30\ub2f9 \uc218\uc775\ub960",
      ebitda: "\uc601\uc5c5 \ud604\uae08 \ucc3d\ucd9c\ub825",
    };

    const quarterly = buildFinancials(incQR, balQR, cfQR, labelsQ, false);
    const annual = buildFinancials(incAR, balAR, cfAR, labelsA, true);

    // Add meanings
    for (const key of Object.keys(meanings)) {
      quarterly.coreMetrics[key].meaning = meanings[key];
      annual.coreMetrics[key].meaning = meanings[key];
    }

    return Response.json({
      name: profile?.companyName || quote?.name || symbol,
      ticker: symbol,
      exchange: profile?.exchange || "",
      description: profile?.description ? profile.description.split(".")[0] + "." : "",
      sector: profile?.sector || "",
      industry: profile?.industry || "",
      price,
      marketCap: mktCap,
      dailyChange: safe(quote?.changePercentage || profile?.changePercentage) / 100,
      yearHigh: profile?.range ? safe(parseFloat(profile.range.split("-")[1])) : 0,
      yearLow: profile?.range ? safe(parseFloat(profile.range.split("-")[0])) : 0,
      volume: safe(quote?.volume || profile?.vol