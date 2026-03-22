// app/api/stock/route.js — Hybrid: FMP (profile/quote) + StockAnalysis (financials)
import { getProfile, getQuote } from "@/lib/fmp";
import {
  getIncomeStatement, getBalanceSheet, getCashFlow, getRatios, getLabels
} from "@/lib/stockanalysis";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    // FMP: profile + quote (2 API calls only)
    const [profile, quote] = await Promise.all([
      getProfile(symbol),
      getQuote(symbol),
    ]);

    if (!profile && !quote) {
      return Response.json({ error: symbol + " not found" }, { status: 404 });
    }

    // StockAnalysis: all financials (no API limit!)
    const [incQ, balQ, cfQ, ratQ, labelsQ, incA, balA, cfA, ratA, labelsA] =
      await Promise.all([
        getIncomeStatement(symbol, true),
        getBalanceSheet(symbol, true),
        getCashFlow(symbol, true),
        getRatios(symbol, true),
        getLabels(symbol, true),
        getIncomeStatement(symbol, false),
        getBalanceSheet(symbol, false),
        getCashFlow(symbol, false),
        getRatios(symbol, false),
        getLabels(symbol, false),
      ]);

    const safe = (v) => (typeof v === "number" && isFinite(v)) ? v : 0;
    const price = safe(quote?.price || profile?.price);
    const mktCap = safe(quote?.marketCap || profile?.marketCap);

    const rev = (arr) => (arr || [0,0,0,0,0]).slice(0, 5).reverse();

    const buildData = (inc, bal, cf, rat, labels) => ({
      labels: rev(labels.length > 0 ? labels : ["1","2","3","4","5"]),
      coreMetrics: {
        per: { value: rev(rat.pe)[4] || 0, trend: rev(rat.pe), meaning: "\ud68c\uc0ac\uac00 1\ub144\uc5d0 \ubc84\ub294 \ub3c8\uc5d0 \ube44\ud574 \uc8fc\uac00\uac00 \uc5bc\ub9c8\ub098 \ube44\uc2fc\uc9c0" },
        pbr: { value: rev(rat.pb)[4] || 0, trend: rev(rat.pb), meaning: "\ud68c\uc0ac\uc758 \uc21c\uc790\uc0b0(\uc790\ubcf8)\uc5d0 \ube44\ud574 \uc8fc\uac00\uac00 \uc5bc\ub9c8\ub098 \ube44\uc2fc\uc9c0" },
        eps: { value: rev(inc.eps)[4] || 0, trend: rev(inc.eps), meaning: "\uc8fc\uc2dd \ud55c \uc8fc\ub2f9 \ud68c\uc0ac\uac00 1\ub144\uac04 \ubc8c\uc5b4\ub4e4\uc774\ub294 \uc774\uc775" },
        de: { value: rev(rat.deRatio)[4] || 0, trend: rev(rat.deRatio), meaning: "\ud68c\uc0ac\uc758 \uc790\uae30\uc790\ubcf8\uc5d0 \ube44\ud574 \ube5a\uc774 \uc5bc\ub9c8\ub098 \uc788\ub294\uc9c0" },
        roe: { value: rev(rat.roe)[4] || 0, trend: rev(rat.roe), meaning: "\uc8fc\uc8fc\uc758 \ub3c8(\uc790\ubcf8)\uc744 \uc6b4\uc6a9\ud574 \uc5f0 \uba87%\uc758 \uc774\uc775\uc744 \ub0c8\ub294\uc9c0" },
        div: { value: rev(rat.divYield)[4] || 0, trend: rev(rat.divYield), meaning: "\ubc30\ub2f9\uc73c\ub85c \ubc1b\ub294 \uc218\uc775\ub960" },
        ebitda: { value: rev(inc.ebitda)[4] || 0, trend: rev(inc.ebitda), meaning: "\uc138\uae08\u00b7\uc774\uc790\u00b7\uac10\uac00\uc0c1\uac01\uc744 \ube7c\uae30 \uc804 \uc2e4\uc81c\ub85c \ubc8c\uc5b4\ub4e4\uc778 \ud604\uae08 \ud750\ub984" },
      },
      income: {
        labels: rev(labels.length > 0 ? labels : ["1","2","3","4","5"]),
        revenue: rev(inc.revenue),
        grossProfit: rev(inc.grossProfit),
        operatingIncome: rev(inc.operatingIncome),
        netIncome: rev(inc.netIncome),
      },
      balance: {
        labels: rev(labels.length > 0 ? labels : ["1","2","3","4","5"]),
        totalAssets: rev(bal.totalAssets),
        currentLiab: rev(bal.currentLiab),
        equity: rev(bal.equity),
      },
      cashflow: {
        labels: rev(labels.length > 0 ? labels : ["1","2","3","4","5"]),
        fcf: rev(cf.fcf),
        opCash: rev(cf.opCash),
        invCash: rev(cf.invCash),
        finCash: rev(cf.finCash),
        netChange: rev(cf.netChange),
      },
      advanced: {
        labels: rev(labels.length > 0 ? labels : ["1","2","3","4","5"]),
        evEbitda: rev(rat.evEbitda),
        pe: rev(rat.pe),
        peg: rev(rat.peg),
        opMargin: rev(rat.opMargin),
        netMargin: rev(rat.netMargin),
      },
      shares: {
        quarterly: rev(inc.sharesOut),
        yearly: rev(inc.sharesOut),
      },
    });

    // Cap classification
    const capClass = (mc) => {
      if (mc >= 200e9) return "Mega Cap";
      if (mc >= 10e9) return "Large Cap";
      if (mc >= 2e9) return "Mid Cap";
      if (mc >= 300e6) return "Small Cap";
      if (mc >= 50e6) return "Micro Cap";
      return "Nano Cap";
    };

    return Response.json({
      name: profile?.companyName || quote?.name || symbol,
      ticker: symbol,
      exchange: profile?.exchange || "",
      description: profile?.description ? profile.description.split(".")[0] + "." : "",
      sector: profile?.sector || "",
      industry: profile?.industry || "",
      price,
      marketCap: mktCap,
      capClass: capClass(mktCap),
      dailyChange: safe(quote?.changePercentage || profile?.changePercentage) / 100,
      yearHigh: profile?.range ? safe(parseFloat(profile.range.split("-")[1])) : 0,
      yearLow: profile?.range ? safe(parseFloat(profile.range.split("-")[0])) : 0,
      volume: safe(quote?.volume || profile?.volume),
      beta: safe(profile?.beta),
      quarterly: buildData(incQ, balQ, cfQ, ratQ, labelsQ),
      annual: buildData(incA, balA, cfA, ratA, labelsA),
    });
  } catch (err) {
    return Response.json({ error: "Error: " + err.message }, { status: 500 });
  }
}
