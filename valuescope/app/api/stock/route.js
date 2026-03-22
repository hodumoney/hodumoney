// app/api/stock/route.js — 100% StockAnalysis (no API key needed!)
import {
  getOverview, getIncome, getBalance, getCashFlow, getRatios
} from "@/lib/stockanalysis";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return Response.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const [overview, incQ, balQ, cfQ, ratQ, incA, balA, cfA, ratA] =
      await Promise.all([
        getOverview(symbol),
        getIncome(symbol, true),
        getBalance(symbol, true),
        getCashFlow(symbol, true),
        getRatios(symbol, true),
        getIncome(symbol, false),
        getBalance(symbol, false),
        getCashFlow(symbol, false),
        getRatios(symbol, false),
      ]);

    if (!overview) {
      return Response.json({ error: symbol + " not found" }, { status: 404 });
    }

    const rev = (arr) => (arr || [0,0,0,0,0]).slice(0, 5).reverse();

    const buildData = (inc, bal, cf, rat) => ({
      labels: rev(inc.labels || ["1","2","3","4","5"]),
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
        labels: rev(inc.labels || []),
        revenue: rev(inc.revenue),
        grossProfit: rev(inc.grossProfit),
        operatingIncome: rev(inc.operatingIncome),
        netIncome: rev(inc.netIncome),
      },
      balance: {
        labels: rev(inc.labels || []),
        totalAssets: rev(bal.totalAssets),
        currentLiab: rev(bal.currentLiab),
        equity: rev(bal.equity),
      },
      cashflow: {
        labels: rev(inc.labels || []),
        fcf: rev(cf.fcf),
        opCash: rev(cf.opCash),
        invCash: rev(cf.invCash),
        finCash: rev(cf.finCash),
        netChange: rev(cf.netChange),
      },
      advanced: {
        labels: rev(inc.labels || []),
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

    const capClass = (mc) => {
      if (mc >= 200e9) return "Mega Cap";
      if (mc >= 10e9) return "Large Cap";
      if (mc >= 2e9) return "Mid Cap";
      if (mc >= 300e6) return "Small Cap";
      if (mc >= 50e6) return "Micro Cap";
      return "Nano Cap";
    };

    return Response.json({
      name: overview.name,
      ticker: overview.ticker,
      exchange: overview.exchange,
      description: overview.description,
      sector: overview.sector,
      industry: overview.industry,
      price: overview.price,
      marketCap: overview.marketCap,
      capClass: capClass(overview.marketCap),
      dailyChange: overview.dailyChange,
      yearHigh: overview.yearHigh,
      yearLow: overview.yearLow,
      volume: overview.volume,
      beta: overview.beta,
      quarterly: buildData(incQ, balQ, cfQ, ratQ),
      annual: buildData(incA, balA, cfA, ratA),
    });
  } catch (err) {
    return Response.json({ error: "Error: " + err.message }, { status: 500 });
  }
}
