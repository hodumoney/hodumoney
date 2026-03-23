// app/api/market/route.js — Real-time market & macro data
export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };

async function fetchYahoo(symbol) {
  try {
    const [res5d, res1y] = await Promise.all([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, { headers: UA, cache: "no-store" }),
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`, { headers: UA, cache: "no-store" }),
    ]);

    let price = 0, prevClose = 0, change = 0, changePct = 0;
    if (res5d.ok) {
      const r = (await res5d.json())?.chart?.result?.[0];
      if (r) {
        const m = r.meta || {};
        price = m.regularMarketPrice || 0;
        prevClose = m.chartPreviousClose || m.previousClose || 0;
        change = price - prevClose;
        changePct = prevClose ? (change / prevClose) * 100 : 0;
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
        const v = c.filter((x) => typeof x === "number" && isFinite(x));

        yearHigh = v.length ? Math.max(...v) : 0;
        yearLow = v.length ? Math.min(...v) : 0;

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

function findPointAtOrBefore(series, targetDate) {
  if (!series.length) return null;
  const t = new Date(targetDate).getTime();
  if (!Number.isFinite(t)) return null;
  for (let i = series.length - 1; i >= 0; i--) {
    const dt = new Date(series[i].date).getTime();
    if (Number.isFinite(dt) && dt <= t) return series[i];
  }
  return null;
}

async function buildMacroIndicators() {
  const [
    usRateSeries,
    usCpiIndex,
    usUnempSeries,
    krRateSeries,
    krCpiIndex,
    krUnempSeries,
  ] = await Promise.all([
    fetchFredSeries("DFF"), // Effective Federal Funds Rate
    fetchFredSeries("CPIAUCSL"),
    fetchFredSeries("UNRATE"),
    fetchFredSeries("INTDSRKRM193N"), // Korea Discount Rate
    fetchFredSeries("KORCPIALLMINMEI"),
    fetchFredSeries("LRHUTTTTKRM156S"),
  ]);

  const usRate = latestPoint(usRateSeries);
  const usUnemp = latestPoint(usUnempSeries);
  const krRate = latestPoint(krRateSeries);
  const krUnemp = latestPoint(krUnempSeries);

  const usCpiNow = latestPoint(usCpiIndex);
  const krCpiNow = latestPoint(krCpiIndex);

  const usCpiPrevYear = usCpiNow
    ? findPointAtOrBefore(usCpiIndex, `${new Date(usCpiNow.date).getFullYear() - 1}-${String(new Date(usCpiNow.date).getMonth() + 1).padStart(2, "0")}-28`)
    : null;
  const krCpiPrevYear = krCpiNow
    ? findPointAtOrBefore(krCpiIndex, `${new Date(krCpiNow.date).getFullYear() - 1}-${String(new Date(krCpiNow.date).getMonth() + 1).padStart(2, "0")}-28`)
    : null;

  const usCpiYoY = usCpiNow && usCpiPrevYear && usCpiPrevYear.value > 0
    ? ((usCpiNow.value - usCpiPrevYear.value) / usCpiPrevYear.value) * 100
    : null;
  const krCpiYoY = krCpiNow && krCpiPrevYear && krCpiPrevYear.value > 0
    ? ((krCpiNow.value - krCpiPrevYear.value) / krCpiPrevYear.value) * 100
    : null;

  return {
    us: [
      {
        name: "미국 기준금리 (FFR)",
        value: usRate ? `${usRate.value.toFixed(2)}%` : "N/A",
        status: usRate ? `${toYm(usRate.date)} 발표` : "데이터 없음",
        statusColor: "var(--text-tertiary)",
        isStatic: true,
      },
      {
        name: "CPI (전년비)",
        value: usCpiYoY !== null ? `${usCpiYoY.toFixed(1)}%` : "N/A",
        status: usCpiNow ? `${toYm(usCpiNow.date)} 발표` : "데이터 없음",
        statusColor: "var(--text-tertiary)",
        isStatic: true,
      },
      {
        name: "실업률",
        value: usUnemp ? `${usUnemp.value.toFixed(1)}%` : "N/A",
        status: usUnemp ? `${toYm(usUnemp.date)} 발표` : "데이터 없음",
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
      {
        name: "한국 CPI (전년비)",
        value: krCpiYoY !== null ? `${krCpiYoY.toFixed(1)}%` : "N/A",
        status: krCpiNow ? `${toYm(krCpiNow.date)} 발표` : "데이터 없음",
        statusColor: "var(--text-tertiary)",
        isStatic: true,
      },
      {
        name: "한국 실업률",
        value: krUnemp ? `${krUnemp.value.toFixed(1)}%` : "N/A",
        status: krUnemp ? `${toYm(krUnemp.date)} 발표` : "데이터 없음",
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
