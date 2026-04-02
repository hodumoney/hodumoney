// app/api/market/route.js — Real-time market & macro data
export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };

async function fetchYahoo(symbol) {
  try {
    // 메인 페이지용: 1일봉만 가져옴 (현재가 + 등락)
    // 1년 히스토리는 차트 클릭 시 /api/market/chart에서 별도 로드
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
    const res = await fetch(url, { headers: UA, cache: "no-store" }).catch(() => null);

    if (!res?.ok) return null;

    const r = (await res.json())?.chart?.result?.[0];
    if (!r) return null;

    const m = r.meta || {};
    const closes = (r.indicators?.quote?.[0]?.close || []).filter((v) => typeof v === "number" && isFinite(v));
    const last = closes.length ? closes[closes.length - 1] : 0;

    const price = m.regularMarketPrice || last || 0;
    const prevClose = m.chartPreviousClose || m.previousClose || 0;
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    // 인라인 미니 차트용: 1일봉 데이터에서 간단한 포인트 추출
    const ts = r.timestamp || [];
    const history = [];
    const step = Math.max(1, Math.floor(closes.length / 12));
    for (let i = 0; i < closes.length; i += step) {
      if (closes[i] && ts[i]) {
        const d = new Date(ts[i] * 1000 + 9 * 60 * 60 * 1000);
        history.push({
          label: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
          value: Math.round(closes[i] * 100) / 100,
        });
      }
    }

    return { price, prevClose, change, changePct, history, yearHigh: 0, yearLow: 0 };
  } catch {
    return null;
  }
}

function fmtN(v, d = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "0";
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function toYm(dateStr) {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 기준금리는 거의 안 바뀌므로 하드코딩 (FOMC/금통위 결정 후 수동 업데이트)
// 미국: 3.50% - 3.75% (2026.03 동결), 한국: 2.50% (2026.02 동결)
const FALLBACK_RATES = {
  us: { value: "3.50% - 3.75%", status: "2026.03 동결" },
  kr: { value: "2.50%", status: "2026.02 동결" },
};

async function fetchFredSeries(seriesId) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const text = await res.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    return lines
      .slice(1)
      .map((line) => {
        const [date, value] = line.split(",");
        const n = Number(value);
        if (!date || !Number.isFinite(n)) return null;
        return { date, value: n };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function latestPoint(series) {
  return series.length ? series[series.length - 1] : null;
}

async function fetchKrBaseRateFromBok() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://www.bok.or.kr/eng/main/main.do", {
      headers: UA,
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();
    const rateMatch = html.match(/BOK\s*Base\s*Rate\s*([0-9]+(?:\.[0-9]+)?)\s*%/i)
      || html.match(/Base\s*Rate[^0-9]{0,40}([0-9]+(?:\.[0-9]+)?)\s*%/i);

    const dateMatch = html.match(/Monetary\s*Policy\s*Decision\(([^)]+)\)/i);

    if (!rateMatch) return null;
    const value = `${Number(rateMatch[1]).toFixed(2)}%`;

    let status = "BOK 실시간";
    if (dateMatch?.[1]) {
      const d = new Date(dateMatch[1]);
      if (Number.isFinite(d.getTime())) {
        status = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")} 발표`;
      }
    }

    return { value, status };
  } catch {
    return null;
  }
}

async function buildMacroIndicators() {
  const [
    usRateLowSeries,
    usRateHighSeries,
    usRateFallback,
    krRateLive,
  ] = await Promise.all([
    fetchFredSeries("DFEDTARL"),
    fetchFredSeries("DFEDTARU"),
    fetchFredSeries("DFF"),
    fetchKrBaseRateFromBok(),
  ]);

  const usLow = latestPoint(usRateLowSeries);
  const usHigh = latestPoint(usRateHighSeries);
  const usFallback = latestPoint(usRateFallback);

  // FRED에서 가져오되, 실패하면 fallback 값 사용
  const usRateValue = (usLow && usHigh)
    ? `${usLow.value.toFixed(2)}% - ${usHigh.value.toFixed(2)}%`
    : (usFallback ? `${usFallback.value.toFixed(2)}%` : FALLBACK_RATES.us.value);
  const usRateDate = usHigh?.date || usLow?.date || usFallback?.date || "";

  // 그래프용 히스토리: FRED 상한 금리 시리즈에서 최근 12개 포인트 추출
  const usRateHistory = [];
  const histSource = usRateHighSeries.length > 0 ? usRateHighSeries : (usRateFallback.length > 0 ? usRateFallback : usRateLowSeries);
  if (histSource.length > 0) {
    const step = Math.max(1, Math.floor(histSource.length / 12));
    for (let i = 0; i < histSource.length; i += step) {
      usRateHistory.push({ label: toYm(histSource[i].date), value: histSource[i].value });
    }
    const last = histSource[histSource.length - 1];
    const lastLabel = toYm(last.date);
    if (!usRateHistory.length || usRateHistory[usRateHistory.length - 1].label !== lastLabel) {
      usRateHistory.push({ label: lastLabel, value: last.value });
    }
  }

  return {
    us: [
      {
        name: "미국 기준금리 (FFR)",
        value: usRateValue,
        status: usRateDate ? `${toYm(usRateDate)} 발표` : FALLBACK_RATES.us.status,
        statusColor: "var(--text-tertiary)",
        isStatic: true,
        history: usRateHistory,
      },
    ],
    kr: [
      {
        name: "한국 기준금리",
        value: krRateLive?.value || FALLBACK_RATES.kr.value,
        status: krRateLive?.status || FALLBACK_RATES.kr.status,
        statusColor: "var(--text-tertiary)",
        isStatic: true,
        history: [],
      },
    ],
  };
}

export async function GET() {
  try {
    const defs = [
      { sym: "^GSPC", name: "S&P 500", group: "idxUS" },
      { sym: "^IXIC", name: "나스닥", group: "idxUS" },
      { sym: "^DJI", name: "다우존스", group: "idxUS" },
      { sym: "^KS11", name: "코스피", group: "idxKR" },
      { sym: "^KQ11", name: "코스닥", group: "idxKR" },
      { sym: "^TNX", name: "10년물 국채금리", group: "econUS", suffix: "%", dec: 3 },
      { sym: "^FVX", name: "2년물 국채금리", group: "econUS", suffix: "%", dec: 3 },
      { sym: "DX-Y.NYB", name: "달러 인덱스 (DXY)", group: "econUS" },
      { sym: "USDKRW=X", name: "원/달러 환율", group: "econKR" },
      { sym: "JPYKRW=X", name: "원/엔 환율 (100엔)", group: "econKR", mult: 100 },
      { sym: "^VIX", name: "VIX 공포 지수", group: "vix" },
    ];

    const [results, macro] = await Promise.all([
      Promise.all(defs.map((d) => fetchYahoo(d.sym))),
      buildMacroIndicators(),
    ]);

    const build = (def, data) => {
      if (!data) {
        return {
          name: def.name,
          value: "-",
          change: "-",
          pct: "-",
          up: false,
          history: [],
          yahooSymbol: def.sym,
          chartMult: def.mult || 1,
        };
      }

      let p = data.price;
      let c = data.change;
      const cp = data.changePct;
      if (def.mult) {
        p *= def.mult;
        c *= def.mult;
      }

      const up = c >= 0;
      const dec = def.dec || 2;
      const val = def.suffix ? `${p.toFixed(dec)}${def.suffix}` : fmtN(p, dec);
      const chg = def.suffix ? `${up ? "+" : ""}${c.toFixed(dec)}${def.suffix}` : `${up ? "+" : ""}${fmtN(c, dec)}`;

      let hist = data.history || [];
      if (def.mult) {
        hist = hist.map((h) => ({ ...h, value: Math.round(h.value * def.mult * 100) / 100 }));
      }

      return {
        name: def.name,
        value: val,
        numValue: p,
        change: chg,
        pct: `${up ? "+" : ""}${cp.toFixed(1)}%`,
        up,
        history: hist,
        yearHigh: def.mult ? (data.yearHigh || 0) * def.mult : data.yearHigh || 0,
        yearLow: def.mult ? (data.yearLow || 0) * def.mult : data.yearLow || 0,
        yahooSymbol: def.sym,
        chartMult: def.mult || 1,
      };
    };

    const g = { idxUS: [], idxKR: [], econUS: [], econKR: [], vix: null };
    defs.forEach((def, i) => {
      const item = build(def, results[i]);
      if (def.group === "vix") g.vix = item;
      else g[def.group].push(item);
    });

    const usdkrw = results[defs.findIndex((d) => d.sym === "USDKRW=X")];
    const exchangeRate = usdkrw ? fmtN(usdkrw.price, 2) : "N/A";

    let vixStatus = "보통", vixColor = "#F59E0B";
    if (g.vix?.numValue) {
      const v = g.vix.numValue;
      if (v < 15) {
        vixStatus = "안정";
        vixColor = "#03B26C";
      } else if (v < 20) {
        vixStatus = "보통";
        vixColor = "#F59E0B";
      } else if (v < 30) {
        vixStatus = "불안";
        vixColor = "#F59E0B";
      } else {
        vixStatus = "공포";
        vixColor = "#F04452";
      }
    }

    return new Response(JSON.stringify({
      indicesUS: g.idxUS,
      indicesKR: g.idxKR,
      econUS: [...g.econUS, ...macro.us],
      econKR: [...g.econKR, ...macro.kr],
      vix: g.vix ? { ...g.vix, status: vixStatus, statusColor: vixColor } : null,
      exchangeRate,
      updatedAt: new Date().toISOString(),
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
