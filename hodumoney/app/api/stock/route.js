// app/api/stock/route.js — 100% StockAnalysis
import {
  getOverview, getIncome, getBalance, getCashFlow, getRatios
} from "@/lib/stockanalysis";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  if (!symbol) return Response.json({ error: "symbol required" }, { status: 400 });

  try {
    const [overview, incQ, balQ, cfQ, ratQ, incA, balA, cfA, ratA] =
      await Promise.all([
        getOverview(symbol),
        getIncome(symbol, true),  getBalance(symbol, true),
        getCashFlow(symbol, true), getRatios(symbol, true),
        getIncome(symbol, false), getBalance(symbol, false),
        getCashFlow(symbol, false), getRatios(symbol, false),
      ]);

    if (!overview) return Response.json({ error: symbol + " not found" }, { status: 404 });

    const rev = (arr) => (arr || [0,0,0,0,0]).slice(0, 5).reverse();

    const buildData = (inc, bal, cf, rat) => {
      const revArr = rev(inc.revenue);
      const opArr = rev(inc.operatingIncome);
      const niArr = rev(inc.netIncome);

      return {
        labels: rev(inc.labels || ["1","2","3","4","5"]),
        coreMetrics: {
          per: { value: rev(rat.pe)[4] || 0, trend: rev(rat.pe), meaning: "회사가 1년에 버는 돈에 비해 주가가 얼마나 비싼지" },
          pbr: { value: rev(rat.pb)[4] || 0, trend: rev(rat.pb), meaning: "회사의 순자산(자본)에 비해 주가가 얼마나 비싼지" },
          eps: { value: rev(inc.eps)[4] || 0, trend: rev(inc.eps), meaning: "주식 한 주당 회사가 1년간 벌어들이는 이익" },
          de: { value: rev(rat.deRatio)[4] || 0, trend: rev(rat.deRatio), meaning: "회사의 자기자본에 비해 빚이 얼마나 있는지" },
          roe: { value: rev(rat.roe)[4] || 0, trend: rev(rat.roe), meaning: "주주의 돈(자본)을 운용해 연 몇%의 이익을 냈는지" },
          div: { value: rev(rat.divYield)[4] || 0, trend: rev(rat.divYield), meaning: "배당으로 받는 수익률" },
          ebitda: { value: rev(inc.ebitda)[4] || 0, trend: rev(inc.ebitda), meaning: "세금·이자·감가상각을 빼기 전 실제로 벌어들인 현금 흐름" },
        },
        income: {
          labels: rev(inc.labels || []),
          revenue: revArr,
          grossProfit: rev(inc.grossProfit),
          operatingIncome: opArr,
          netIncome: niArr,
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
          opMargin: revArr.map((r, i) => r > 0 ? opArr[i] / r : 0),
          netMargin: revArr.map((r, i) => r > 0 ? niArr[i] / r : 0),
        },
        shares: {
          quarterly: rev(inc.sharesOut),
          yearly: rev(inc.sharesOut),
        },
      };
    };

    const capClass = (mc) => {
      if (mc >= 200e9) return "Mega Cap : 초대형주";
      if (mc >= 10e9) return "Large Cap : 대형주";
      if (mc >= 2e9) return "Mid Cap : 중형주";
      if (mc >= 300e6) return "Small Cap : 소형주";
      return "Small Cap : 소형주";
    };

    const capRank = await (async () => {
      try {
        const res = await fetch(
          `https://stockanalysis.com/api/search?q=${encodeURIComponent(symbol)}`,
          {
            headers: { "User-Agent": "Mozilla/5.0" },
            cache: "no-store",
          }
        );
        if (!res.ok) return null;
        const results = await res.json();
        if (!Array.isArray(results)) return null;

        const matched = results.find((item) => {
          const itemSymbol = (item?.s || item?.symbol || "").toUpperCase();
          return itemSymbol === symbol;
        });
        if (!matched) return null;

        const rankRaw =
          matched.rank ??
          matched.marketCapRank ??
          matched.market_cap_rank ??
          null;
        const rankNum = Number(rankRaw);
        return Number.isFinite(rankNum) && rankNum > 0 ? `${Math.round(rankNum)}위` : null;
      } catch {
        return null;
      }
    })();

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
      capRank,
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
