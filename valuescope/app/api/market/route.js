// app/api/market/route.js — Real-time market & macro data
export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };

async function fetchYahoo(symbol) {
  try {
    const [res1d, res1y] = await Promise.all([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`, { headers: UA, cache: "no-store" }),
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`, { headers: UA, cache: "no-store" }),
    ]);

    let price = 0, prevClose = 0, change = 0, changePct = 0;

    if (res1d.ok) {
      const r = (await res1d.json())?.chart?.result?.[0];
      if (r) {
        const m = r.meta || {};
        const closes = (r.indicators?.quote?.[0]?.close || []).filter((v) => typeof v === "number" && isFinite(v));
        const first = closes.length ? closes[0] : 0;
        const last = closes.length ? closes[closes.length - 1] : 0;

        price = m.regularMarketPrice || last || 0;
        prevClose = first || m.chartPreviousClose || m.previousClose || 0;

        if (first && last) {
          change = last - first;
          changePct = first ? (change / first) * 100 : 0;
        } else {
          const base = m.chartPreviousClose || m.previousClose || 0;
          change = price - base;
          changePct = base ? (change / base) * 100 : 0;
        }
      }
    }

    let history = [], yearHigh = 0, yearLow = 0;
    if (res1y.ok) {
      const r = (await res1y.json())?.chart?.result?.[0];
      if (r) {
        if (!price) {
          const m = r.meta || {};
          price = m.regularMarketPrice || 0;
          prevClose = m.chartPreviousClose || m.previousClose || 0;
          change = price - prevClose;
          changePct = prevClose ? (change / prevClose) * 100 : 0;
        }

        const c = r.indicators?.quote?.[0]?.close || [];
        const ts = r.timestamp || [];
        const valid = c.filter((x) => typeof x === "number" && isFinite(x));

        yearHigh = valid.length ? Math.max(...valid) : 0;
        yearLow = valid.length ? Math.min(...valid) : 0;

        const step = Math.max(1, Math.floor(c.length / 12));
        for (let i = 0; i < c.length; i += step) {
          if (c[i] && ts[i]) {
            const d = new Date(ts[i] * 1000);
            history.push({
              label: `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, "0")}`,
              value: Math.round(c[i] * 100) / 100,
            });
          }
        }

        if (c[c.length - 1] && ts[ts.length - 1]) {
          const d = new Date(ts[ts.length - 1] * 1000);
          const l = `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (!history.length || history[history.length - 1].label !== l) {
            history.push({ label: l, value: Math.round(c[c.length - 1] * 100) / 100 });
          }
        }
      }
    }

    return { price, prevClose, change, changePct, history, yearHigh, yearLow };
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

async function fetchFredSeries(seriesId) {
  try {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
    const res = await fetch(url, { cache: "no-store" });
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

async function fetchGoldSpotFromFred() {
  const series = await fetchFredSeries("GOLDAMGBD228NLBM");
  if (!series.length) return null;

  const latest = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : latest;
  const change = latest.value - prev.value;
  const changePct = prev.value ? (change / prev.value) * 100 : 0;

  const recent = series.slice(-365);
  const step = Math.max(1, Math.floor(recent.length / 12));
  const history = [];
  for (let i = 0; i < recent.length; i += step) {
    const point = recent[i];
    if (!point) continue;
    const d = new Date(point.date);
    history.push({
      label: `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, "0")}`,
      value: Math.round(point.value * 100) / 100,
    });
  }
  const lastPoint = recent[recent.length - 1];
  if (lastPoint) {
    const d = new Date(lastPoint.date);
    const label = `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!history.length || history[history.length - 1].label !== label) {
      history.push({ label, value: Math.round(lastPoint.value * 100) / 100 });
    }
  }

  const values = series.map((p) => p.value);
  return {
    price: latest.value,
    prevClose: prev.value,
    change,
    changePct,
    history,
    yearHigh: Math.max(...values),
    yearLow: Math.min(...values),
  };
}

async function buildMacroIndicators() {
  const [
    usRateLowSeries,
    usRateHighSeries,
    usRateFallback,
    krRateSeries,
  ] = await Promise.all([
    fetchFredSeries("DFEDTARL"), // Fed Target Lower Bound
    fetchFredSeries("DFEDTARU"), // Fed Target Upper Bound
    fetchFredSeries("DFF"),
    fetchFredSeries("INTDSRKRM193N"),
  ]);

  const usLow = latestPoint(usRateLowSeries);
  const usHigh = latestPoint(usRateHighSeries);
  const usFallback = latestPoint(usRateFallback);
  const krRate = latestPoint(krRateSeries);

  const usRateValue = (usLow && usHigh)
    ? `${usLow.value.toFixed(2)}% - ${usHigh.value.toFixed(2)}%`
    : (usFallback ? `${usFallback.value.toFixed(2)}%` : "N/A");
  const usRateDate = usHigh?.date || usLow?.date || usFallback?.date || "";

  return {
    us: [
      {
        name: "미국 기준금리 (FFR)",
        value: usRateValue,
        status: usRateDate ? `${toYm(usRateDate)} 발표` : "데이터 없음",
        statusColor: "var(--text-tertiary)",
        isStatic: true,
      },
    ],
    kr: [
      {
        name: "한국 기준금리",
        value: krRate ? `${krRate.value.toFixed(2)}%` : "N/A",
        status: krRate ? `${toYm(krRate.date)} 발표` : "데이터 없음",
        statusColor: "var(--text-tertiary)",
        isStatic: true,
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
      { sym: "FRED:GOLD", name: "금 현물 (XAU/USD)", group: "econUS", source: "fred_gold" },
      { sym: "USDKRW=X", name: "원/달러 환율", group: "econKR" },
      { sym: "JPYKRW=X", name: "원/엔 환율 (100엔)", group: "econKR", mult: 100 },
      { sym: "^VIX", name: "VIX 공포 지수", group: "vix" },
    ];

    const [results, macro] = await Promise.all([
      Promise.all(defs.map((d) => (d.source === "fred_gold" ? fetchGoldSpotFromFred() : fetchYahoo(d.sym)))),
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

    return Response.json({
      indicesUS: g.idxUS,
      indicesKR: g.idxKR,
      econUS: [...g.econUS, ...macro.us],
      econKR: [...g.econKR, ...macro.kr],
      vix: g.vix ? { ...g.vix, status: vixStatus, statusColor: vixColor } : null,
      exchangeRate,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
