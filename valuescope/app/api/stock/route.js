import {
  getProfile, getQuote,
  getIncomeQuarterly, getBalanceQuarterly, getCashflowQuarterly,
  getIncomeAnnual, getBalanceAnnual, getCashflowAnnual,
} from "@/lib/fmp";

export const dynamic = "force-dynamic";

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

    const incQR = (incQ || []).slice(0, 5).reverse();
    const balQR = (balQ || []).slice(0, 5).reverse();
    const cfQR = (cfQ || []).slice(0, 5).reverse();
    const incAR = (incA || []).slice(0, 5).reverse();
    const balAR = (balA || []).slice(0, 5).reverse();
    const cfAR = (cfA || []).slice(0, 5).reverse();

    const qLabel = (d) => { if (!d) return ""; const x = new Date(d); return String(x.getFullYear()).slice(-2) + "Q" + Math.ceil((x.getMonth()+1)/3); };
    const yLabel = (d) => { if (!d) return ""; return String(new Date(d).getFullYear()); };

    const labelsQ = incQR.map(r => qLabel(r.date));
    const labelsA = incAR.map(r => yLabel(r.date));

    const calcPER = (inc, p, ann) => { const e = safe(inc?.epsdiluted || inc?.eps); return e !== 0 ? p / (ann ? e : e * 4) : 0; };
    const calcPBR = (bal, mc) => { const eq = safe(bal?.totalStockholdersEquity); return eq !== 0 ? mc / eq : 0; };
    const calcDE = (bal) => { const eq = safe(bal?.totalStockholdersEquity); const d = safe(bal?.totalDebt || bal?.longTermDebt); return eq !== 0 ? d / eq : 0; };
    const calcROE = (inc, bal, ann) => { const ni = safe(inc?.netIncome); const eq = safe(bal?.totalStockholdersEquity); return eq !== 0 ? (ni * (ann?1:4) / eq) * 100 : 0; };
    const calcOM = (inc) => { const r = safe(inc?.revenue); return r !== 0 ? safe(inc?.operatingIncome) / r : 0; };
    const calcNM = (inc) => { const r = safe(inc?.revenue); return r !== 0 ? safe(inc?.netIncome) / r : 0; };
    const calcEVE = (inc, mc, ann) => { const e = safe(inc?.ebitda); return e !== 0 ? mc / (e * (ann?1:4)) : 0; };

    const build = (incArr, balArr, cfArr, labels, ann) => ({
      labels,
      coreMetrics: {
        per: { value: calcPER(incArr[incArr.length-1], price, ann), trend: incArr.map(m => calcPER(m, price, ann)), meaning: "1\ub144 \uc774\uc775 \ub300\ube44 \uc8fc\uac00 \uc218\uc900" },
        pbr: { value: calcPBR(balArr[balArr.length-1], mktCap), trend: balArr.map(m => calcPBR(m, mktCap)), meaning: "\uc21c\uc790\uc0b0 \ub300\ube44 \uc8fc\uac00 \uc218\uc900" },
        eps: { value: safe((incArr[incArr.length-1]||{}).epsdiluted||(incArr[incArr.length-1]||{}).eps), trend: incArr.map(m => safe(m.epsdiluted||m.eps)), meaning: "\uc8fc\ub2f9 \uc21c\uc774\uc775" },
        de: { value: calcDE(balArr[balArr.length-1]), trend: balArr.map(m => calcDE(m)), meaning: "\uc790\uae30\uc790\ubcf8 \ub300\ube44 \ubd80\ucc44" },
        roe: { value: calcROE(incArr[incArr.length-1], balArr[balArr.length-1], ann), trend: incArr.map((m,i) => calcROE(m, balArr[i]||{}, ann)), meaning: "\uc790\uae30\uc790\ubcf8 \ub300\ube44 \uc774\uc775\ub960" },
        div: { value: divYield, trend: incArr.map(() => divYield), meaning: "\ubc30\ub2f9 \uc218\uc775\ub960" },
        ebitda: { value: safe((incArr[incArr.length-1]||{}).ebitda)/1e6, trend: incArr.map(m => safe(m.ebitda)/1e6), meaning: "\uc601\uc5c5 \ud604\uae08 \ucc3d\ucd9c\ub825" },
      },
      income: {
        labels,
        revenue: incArr.map(r => Math.round(safe(r.revenue)/1e6)),
        grossProfit: incArr.map(r => Math.round(safe(r.grossProfit)/1e6)),
        operatingIncome: incArr.map(r => Math.round(safe(r.operatingIncome)/1e6)),
        netIncome: incArr.map(r => Math.round(safe(r.netIncome)/1e6)),
      },
      balance: {
        labels,
        totalAssets: balArr.map(r => Math.round(safe(r.totalAssets)/1e6)),
        currentLiab: balArr.map(r => Math.round(safe(r.totalCurrentLiabilities)/1e6)),
        equity: balArr.map(r => Math.round(safe(r.totalStockholdersEquity)/1e6)),
      },
      cashflow: {
        labels,
        fcf: cfArr.map(r => Math.round(safe(r.freeCashFlow)/1e6)),
        opCash: cfArr.map(r => Math.round(safe(r.operatingCashFlow)/1e6)),
        invCash: cfArr.map(r => Math.round(safe(r.netCashUsedForInvestingActivites)/1e6)),
        finCash: cfArr.map(r => Math.round(safe(r.netCashUsedProvidedByFinancingActivities)/1e6)),
        netChange: cfArr.map(r => Math.round(safe(r.netChangeInCash)/1e6)),
      },
      advanced: {
        labels,
        evEbitda: incArr.map(m => calcEVE(m, mktCap, ann)),
        pe: incArr.map(m => calcPER(m, price, ann)),
        peg: incArr.map(() => 0),
        opMargin: incArr.map(m => calcOM(m)),
        netMargin: incArr.map(m => calcNM(m)),
      },
      shares: {
        quarterly: incArr.map(r => Math.round(safe(r.weightedAverageShsOutDil||r.weightedAverageShsOut)/1e6)),
        yearly: incArr.map(r => Math.round(safe(r.weightedAverageShsOutDil||r.weightedAverageShsOut)/1e6)),
      },
    });

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
      volume: safe(quote?.volume || profile?.volume),
      beta: safe(profile?.beta),
      quarterly: build(incQR, balQR, cfQR, labelsQ, false),
      annual: build(incAR, balAR, cfAR, labelsA, true),
    });
  } catch (err) {
    return Response.json({ error: "Error: " + err.message }, { status: 500 });
  }
}
