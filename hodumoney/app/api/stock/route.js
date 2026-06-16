// app/api/stock/route.js — StockAnalysis + Yahoo price hybrid (dot-ticker: __data.json fallback)
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

    const fyEnd = overview.fiscalYearEndMonth || 12; // 결산월

    // 상대 시점 라벨 생성 (현재 기준) + 실제 연월 병기
    // 분기: "1Q 전 (25.11~26.01)" / "최근 (26.02~04)" / "다음 분기 (예상)"
    // 연간: "1년 전 (25년)" / "최근 (26년)" / "다음 해 (예상)"
    function buildRelativeLabels(rawLabels, isQuarterly) {
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth() + 1;

      const parsed = rawLabels.map(l => {
        if (!l || typeof l !== "string") return null;
        const isEst = l.includes("(예상)") || /E$/i.test(l.replace(" (예상)", "").trim());
        const clean = l.replace(" (예상)", "").trim();

        if (isQuarterly) {
          const qm = clean.match(/Q(\d)\s*(\d{4})/);
          if (!qm) return { isEst };
          const q = parseInt(qm[1]);
          const fy = parseInt(qm[2]);
          const fyStartMonth = (fyEnd % 12) + 1;
          const startMonthIdx = (fyStartMonth - 1) + (q - 1) * 3;
          const startMonth = (startMonthIdx % 12) + 1;
          const endMonthIdx = startMonthIdx + 2;
          const endMonth = (endMonthIdx % 12) + 1;
          const fyStartYear = fy - 1;
          const startYear = fyStartYear + Math.floor(startMonthIdx / 12);
          const endYear = fyStartYear + Math.floor(endMonthIdx / 12);
          const midMonthIdx = startMonthIdx + 1;
          const calYear = fyStartYear + Math.floor(midMonthIdx / 12);
          const calMonth = (midMonthIdx % 12) + 1;
          const quartersFromNow = Math.round(((curYear - calYear) * 12 + (curMonth - calMonth)) / 3);
          const sy = String(startYear).slice(-2);
          const ey = String(endYear).slice(-2);
          const sm = String(startMonth).padStart(2, "0");
          const em = String(endMonth).padStart(2, "0");
          const range = startYear === endYear ? `${sy}.${sm}~${em}` : `${sy}.${sm}~${ey}.${em}`;
          return { isEst, dist: quartersFromNow, range };
        } else {
          const fm = clean.match(/FY\s*(\d{4})/);
          if (!fm) return { isEst };
          const fy = parseInt(fm[1]);
          const fyStartMonth = (fyEnd % 12) + 1;
          const mainYear = fyStartMonth <= 6 ? fy - 1 : fy;
          return { isEst, dist: curYear - mainYear, range: `${String(mainYear).slice(-2)}년` };
        }
      });

      const realDists = parsed.filter(p => p && !p.isEst && typeof p.dist === "number").map(p => p.dist);
      let baseDist = 0;
      if (realDists.length > 0) {
        baseDist = realDists.reduce((best, d) => Math.abs(d) < Math.abs(best) ? d : best, realDists[0]);
      }

      const unit = isQuarterly ? "Q" : "년";
      return parsed.map(p => {
        if (!p || typeof p.dist !== "number") return "-";
        const rel = p.dist - baseDist; // 0 = 최근(기준)
        const range = p.range ? ` (${p.range})` : "";
        if (rel === 0) return `최근${range}`;
        if (rel > 0) return `${rel}${unit} 전${range}`;
        // 미래 → 예상
        const ahead = -rel;
        if (isQuarterly) return ahead === 1 ? "다음 분기 (예상)" : `${ahead}분기 후 (예상)`;
        return ahead === 1 ? "다음 해 (예상)" : `${ahead}년 후 (예상)`;
      });
    }


    const rev = (arr) => {
      const a = arr || [];
      if (a.length === 0) return [null, null, null, null, null];
      const sliced = a.slice(0, 5).reverse();
      // Pad to 5 elements with null if shorter
      while (sliced.length < 5) sliced.unshift(null);
      return sliced;
    };

    const buildData = (inc, bal, cf, rat, isQuarterly) => {
      const rawLabels = rev(inc.labels || ["1","2","3","4","5"]);
      const labels = buildRelativeLabels(rawLabels, isQuarterly);
      const revArr = rev(inc.revenue);
      const opArr = rev(inc.operatingIncome);
      const niArr = rev(inc.netIncome);

      return {
        labels,
        coreMetrics: {
          per: { value: rev(rat.pe)[4] ?? null, trend: rev(rat.pe), meaning: "회사가 1년에 버는 돈에 비해 주가가 얼마나 비싼지" },
          pbr: { value: rev(rat.pb)[4] ?? null, trend: rev(rat.pb), meaning: "회사의 순자산(자본)에 비해 주가가 얼마나 비싼지" },
          eps: { value: rev(inc.eps)[4] ?? null, trend: rev(inc.eps), meaning: "주식 한 주당 회사가 1년간 벌어들이는 이익" },
          de: { value: rev(rat.deRatio)[4] ?? null, trend: rev(rat.deRatio), meaning: "회사의 자기자본에 비해 빚이 얼마나 있는지" },
          roe: { value: rev(rat.roe)[4] ?? null, trend: rev(rat.roe), meaning: "주주의 돈(자본)을 운용해 연 몇%의 이익을 냈는지" },
          div: { value: rev(rat.divYield)[4] ?? null, trend: rev(rat.divYield), meaning: "배당으로 받는 수익률" },
          ebitda: { value: rev(inc.ebitda)[4] ?? null, trend: rev(inc.ebitda), meaning: "세금·이자·감가상각을 빼기 전 실제로 벌어들인 현금 흐름" },
        },
        income: {
          labels,
          revenue: revArr,
          grossProfit: rev(inc.grossProfit),
          operatingIncome: opArr,
          netIncome: niArr,
        },
        balance: {
          labels,
          totalAssets: rev(bal.totalAssets),
          currentLiab: rev(bal.currentLiab),
          equity: rev(bal.equity),
        },
        cashflow: {
          labels,
          fcf: rev(cf.fcf),
          opCash: rev(cf.opCash),
          invCash: rev(cf.invCash),
          finCash: rev(cf.finCash),
          netChange: rev(cf.netChange),
        },
        advanced: {
          labels,
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
      if (mc >= 200e9) return "Mega Cap";
      if (mc >= 10e9) return "Large Cap";
      if (mc >= 2e9) return "Mid Cap";
      if (mc >= 300e6) return "Small Cap";
      if (mc >= 50e6) return "Micro Cap";
      return "Nano Cap";
    };

    // Dynamic global market cap rank — StockAnalysis 데이터로 상위 종목 시총 비교
    // 시총 $500B 이상 종목만 순위 표시 (응답 속도를 위해 상위 5개만 비교)
    let capRank = null;
    if (overview.marketCap && overview.marketCap >= 500e9) {
      try {
        const topSymbols = ["AAPL", "MSFT", "NVDA", "GOOG", "AMZN"].filter(s => s !== symbol);
        const overviews = await Promise.all(
          topSymbols.map(s => getOverview(s).catch(() => null))
        );

        const caps = [{ symbol, marketCap: overview.marketCap }];
        topSymbols.forEach((s, i) => {
          if (overviews[i]?.marketCap) caps.push({ symbol: s, marketCap: overviews[i].marketCap });
        });

        caps.sort((a, b) => b.marketCap - a.marketCap);
        const idx = caps.findIndex(c => c.symbol === symbol);
        if (idx >= 0 && idx < 5) capRank = `글로벌 ${idx + 1}위`;
      } catch {}
    }

    // 한국 종목 판별
    const isKrx = /^\d{6}$/.test(symbol);
    let yahooSymbol = isKrx ? `${symbol}.KS` : symbol;
    const currency = overview.currency || (isKrx ? "KRW" : "USD");

    // 한국 종목: kr_stocks.json에서 한글 이름 + 거래소 조회
    let krName = null;
    let krExchange = "KRX";
    if (isKrx) {
      try {
        const { readFileSync } = await import("fs");
        const { join } = await import("path");
        const filePath = join(process.cwd(), "public", "kr_stocks.json");
        const raw = readFileSync(filePath, "utf-8");
        const krStocks = JSON.parse(raw);
        const found = krStocks.find(s => s.s === symbol);
        if (found) {
          krName = found.n;
          krExchange = found.e || "KRX";
        }
      } catch {}

      // 코스닥 종목은 .KQ
      if (krExchange === "KOSDAQ") yahooSymbol = `${symbol}.KQ`;

      // 한국 시총 상위 30 순위 (2026 기준, 주기적 업데이트)
      const KR_CAP_RANK = {
        "005930": 1,  // 삼성전자
        "000660": 2,  // SK하이닉스
        "373220": 3,  // LG에너지솔루션
        "207940": 4,  // 삼성바이오로직스
        "005380": 5,  // 현대자동차
        "068270": 6,  // 셀트리온
        "000270": 7,  // 기아
        "196170": 8,  // 알테오젠
        "006400": 8,  // 삼성SDI
        "051910": 10, // LG화학
        "035420": 11, // NAVER
        "012450": 12, // 한화에어로스페이스
        "035720": 13, // 카카오
        "105560": 14, // KB금융
        "055550": 15, // 신한지주
        "086790": 16, // 하나금융지주
        "329180": 17, // HD현대중공업
        "009150": 18, // 삼성전기
        "028260": 19, // 삼성물산
        "003670": 20, // 포스코홀딩스
        "012330": 21, // 현대모비스
        "034020": 22, // 두산에너빌리티
        "042660": 23, // 한화오션
        "066570": 24, // LG전자
        "096770": 25, // SK이노베이션
        "032830": 26, // 삼성생명
        "259960": 27, // 크래프톤
        "018260": 28, // 삼성에스디에스
        "316140": 29, // 우리금융지주
        "352820": 30, // 하이브
      };

      const rank = KR_CAP_RANK[symbol];
      if (rank) {
        capRank = `국내 ${rank}위`;
      } else {
        const mc = overview.marketCap || 0;
        if (mc >= 50e12) capRank = "국내 대형주 (시총 50조+)";
        else if (mc >= 10e12) capRank = "국내 대형주 (시총 10조+)";
        else if (mc >= 1e12) capRank = "국내 중형주 (시총 1조+)";
        else if (mc >= 500e9) capRank = "국내 중소형주";
        else capRank = "국내 소형주";
      }
    }

    return Response.json({
      name: krName || overview.name,
      nameEn: isKrx ? overview.name : undefined,
      ticker: overview.ticker,
      exchange: overview.exchange,
      description: overview.description,
      sector: overview.sector,
      industry: overview.industry,
      price: overview.price,
      marketCap: overview.marketCap,
      capClass: capClass(overview.marketCap),
      capRank: capRank,
      dailyChange: overview.dailyChange,
      yearHigh: overview.yearHigh,
      yearLow: overview.yearLow,
      volume: overview.volume,
      beta: overview.beta,
      currency,
      yahooSymbol,
      isKrx,
      quarterly: buildData(incQ, balQ, cfQ, ratQ, true),
      annual: buildData(incA, balA, cfA, ratA, false),
    });
  } catch (err) {
    return Response.json({ error: "Error: " + err.message }, { status: 500 });
  }
}
