import {
  getProfile, getQuote, getIncomeQuarterly, getBalanceQuarterly,
  getCashflowQuarterly,
} from "@/lib/fmp";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const [profile, quote, income, balance, cashflow] =
      await Promise.all([
        getProfile(symbol),
        getQuote(symbol),
        getIncomeQuarterly(symbol),
        getBalanceQuarterly(symbol),
        getCashflowQuarterly(symbol),
      ]);

    if (!profile && !quote) {
      return Response.json({ error: symbol + " not found" }, { status: 404 });
    }

    const safe = (v) => (typeof v === "number" && isFinite(v)) ? v : 0;

    const incR = (income || []).slice(0, 5).reverse();
    const balR = (balance || []).slice(0, 5).reverse();
    const cfR = (cashflow || []).slice(0, 5).reverse();

    const makeLabel = (dateStr) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const y = String(d.getFullYear()).slice(-2);
      const q = Math.ceil((d.getMonth() + 1) / 3);
      return y + "Q" + q;
    };

    const labels = incR.map(r => makeLabel(r.date || r.fillingDate));

    const price = safe(quote?.price || profile?.price);
    const mktCap = safe(quote?.marketCap || profile?.marketCap);

    const calcPER = (inc, p) => {
      const eps = safe(inc?.epsdiluted || inc?.eps);
      return eps !== 0 ? p / (eps * 4) : 0;
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

    const calcROE = (inc, bal) => {
      const ni = safe(inc?.netIncome);
      const eq = safe(bal?.totalStockholdersEquity);
      return eq !== 0 ? (ni * 4 / eq) * 100 : 0;
    };

    const calcOpMargin = (inc) => {
      const rev = safe(inc?.revenue);
      const op = safe(inc?.operatingIncome);
      return rev !== 0 ? op / rev : 0;
    };

    const calcNetMargin = (inc) => {
      const rev = safe(inc?.revenue);
      const ni = safe(inc?.netIncome);
      return rev !== 0 ? ni / rev : 0;
    };

    const lastInc = incR[incR.length - 1] || {};
    const lastBal = balR[balR.length - 1] || {};
    const divYield = safe(profile?.lastDividend) / (price || 1) * 100;

    return Response.json({
      name: profile?.companyName || quote?.name || symbol,
      ticker: symbol,
      exchange: profile?.exchange || "",
      description: profile?.description ? profile.description.split(".")[0] + "." : "",
      sector: profile?.sector || "",
      industry: profile?.industry || "",
      price: price,
      marketCap: mktCap,
      dailyChange: safe(quote?.changePercentage || profile?.changePercentage) / 100,
      yearHigh: profile?.range ? safe(parseFloat(profile.range.split("-")[1])) : 0,
      yearLow: profile?.range ? safe(parseFloat(profile.range.split("-")[0])) : 0,
      volume: safe(quote?.volume || profile?.volume),
      beta: safe(profile?.beta),
      labels,
      coreMetrics: {
        per: {
          value: calcPER(lastInc, price),
          trend: incR.map(m => calcPER(m, price)),
          meaning: "1\ub144 \uc774\uc775 \ub300\ube44 \uc8fc\uac00 \uc218\uc900"
        },
        pbr: {
          value: calcPBR(lastBal, mktCap),
          trend: balR.map(m => calcPBR(m, mktCap)),
          meaning: "\uc21c\uc790\uc0b0 \ub300\ube44 \uc8fc\uac00 \uc218\uc900"
        },
        eps: {
          value: safe(lastInc.epsdiluted || lastInc.eps),
          trend: incR.map(m => safe(m.epsdiluted || m.eps)),
          meaning: "\uc8fc\ub2f9 \uc21c\uc774\uc775"
        },
        de: {
          value: calcDE(lastBal),
          trend: balR.map(m => calcDE(m)),
          meaning: "\uc790\uae30\uc790\ubcf8 \ub300\ube44 \ubd80\ucc44"
        },
        roe: {
          value: calcROE(lastInc, lastBal),
          trend: incR.map((m, i) => calcROE(m, balR[i] || {})),
          meaning: "\uc790\uae30\uc790\ubcf8 \ub300\ube44 \uc774\uc775\ub960"
        },
        div: {
          value: divYield,
          trend: incR.map(() => divYield),
          meaning: "\ubc30\ub2f9 \uc218\uc775\ub960"
        },
        ebitda: {
          value: safe(lastInc.ebitda) / 1e6,
          trend: incR.map(m => safe(m.ebitda) / 1e6),
          meaning: "\uc601\uc5c5 \ud604\uae08 \ucc3d\ucd9c\ub825"
        },
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
          evEbitda: incR.map(m => {
            const eb = safe(m.ebitda);
            return eb !== 0 ? mktCap / (eb * 4) : 0;
          }),
          pe: incR.map(m => calcPER(m, price)),
          peg: incR.map(() => 0),
          opMargin: incR.map(m => calcOpMargin(m)),
          netMargin: incR.map(m => calcNetMargin(m)),
        },
        shares: {
          quarterly: incR.map(r => Math.round(safe(r.weightedAverageShsOutDil || r.weightedAverageShsOut) / 1e6)),
          yearly: incR.map(r => Math.round(safe(r.weightedAverageShsOutDil || r.weightedAverageShsOut) / 1e6)),
        }
      }
    });
  } catch (err) {
    return Response.json({ error: "Error: " + err.message }, { status: 500 });
  }
}