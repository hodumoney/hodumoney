// app/api/market/route.js — Real-time market data from Yahoo Finance
export const dynamic = "force-dynamic";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

async function fetchYahooQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
    const res = await fetch(url, { headers: UA, cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta || {};
    const closes = result.indicators?.quote?.[0]?.close || [];
    const timestamps = result.timestamp || [];

    const price = meta.regularMarketPrice || 0;
    const prevClose = meta.chartPreviousClose || meta.previousClose || 0;
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    // Build history for inline charts (sample ~12 points)
    const history = [];
    if (closes.length > 0) {
      const step = Math.max(1, Math.floor(closes.length / 12));
      for (let i = 0; i < closes.length; i += step) {
        if (closes[i] && timestamps[i]) {
          const d = new Date(timestamps[i] * 1000);
          const label = `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, "0")}`;
          history.push({ label, value: Math.round(closes[i] * 100) / 100 });
        }
      }
      const lastClose = closes[closes.length - 1];
      if (lastClose && timestamps[timestamps.length - 1]) {
        const d = new Date(timestamps[timestamps.length - 1] * 1000);
        const label = `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (history.length === 0 || history[history.length - 1].label !== label) {
          history.push({ label, value: Math.round(lastClose * 100) / 100 });
        }
      }
    }

    // 52-week high/low from data
    const validCloses = closes.filter(v => typeof v === "number" && isFinite(v));
    const yearHigh = validCloses.length > 0 ? Math.max(...validCloses) : 0;
    const yearLow = validCloses.length > 0 ? Math.min(...validCloses) : 0;

    return { price, change, changePct, history, yearHigh, yearLow };
  } catch {
    return null;
  }
}

function fmtNum(v, decimals = 2) {
  if (v === null || v === undefined) return "0";
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export async function GET() {
  try {
    const symbolDefs = [
      // US indices
      { sym: "^GSPC", name: "S&P 500", group: "idxUS" },
      { sym: "^IXIC", name: "나스닥", group: "idxUS" },
      { sym: "^DJI", name: "다우존스", group: "idxUS" },
      { sym: "^RUT", name: "러셀 2000", group: "idxUS" },
      // KR indices
      { sym: "^KS11", name: "코스피", group: "idxKR" },
      { sym: "^KQ11", name: "코스닥", group: "idxKR" },
      // Economic US
      { sym: "^TNX", name: "10년물 국채금리", group: "econUS", suffix: "%" },
      { sym: "DX-Y.NYB", name: "달러 인덱스 (DXY)", group: "econUS" },
      // Economic KR
      { sym: "USDKRW=X", name: "원/달러 환율", group: "econKR" },
      { sym: "JPYKRW=X", name: "원/엔 환율 (100엔)", group: "econKR", mult: 100 },
      // Sentiment
      { sym: "^VIX", name: "VIX 공포 지수", group: "vix" },
    ];

    const results = await Promise.all(symbolDefs.map(d => fetchYahooQuote(d.sym)));

    const buildItem = (def, data) => {
      if (!data) return { name: def.name, value: "-", change: "-", pct: "-", up: false, history: [] };
      
      let price = data.price;
      let change = data.change;
      let changePct = data.changePct;

      if (def.mult) {
        price *= def.mult;
        change *= def.mult;
      }

      const up = change >= 0;
      const valStr = def.suffix 
        ? `${price.toFixed(3)}${def.suffix}` 
        : fmtNum(price, 2);
      const chgStr = def.suffix
        ? `${up ? "+" : ""}${change.toFixed(3)}${def.suffix}`
        : `${up ? "+" : ""}${fmtNum(change, 2)}`;

      let hist = data.history || [];
      if (def.mult && hist.length > 0) {
        hist = hist.map(h => ({ ...h, value: Math.round(h.value * def.mult * 100) / 100 }));
      }

      return {
        name: def.name,
        value: valStr,
        numValue: price,
        change: chgStr,
        pct: `${up ? "+" : ""}${changePct.toFixed(1)}%`,
        up,
        history: hist,
        yearHigh: def.mult ? (data.yearHigh || 0) * def.mult : data.yearHigh || 0,
        yearLow: def.mult ? (data.yearLow || 0) * def.mult : data.yearLow || 0,
        yahooSymbol: def.sym,
        chartMult: def.mult || 1,
      };
    };

    const grouped = { idxUS: [], idxKR: [], econUS: [], econKR: [], vix: null };

    symbolDefs.forEach((def, i) => {
      const item = buildItem(def, results[i]);
      if (def.group === "vix") {
        grouped.vix = item;
      } else {
        grouped[def.group].push(item);
      }
    });

    // Exchange rate for badge
    const usdkrwData = results[symbolDefs.findIndex(d => d.sym === "USDKRW=X")];
    const exchangeRate = usdkrwData ? fmtNum(usdkrwData.price, 2) : "N/A";

    // VIX status
    let vixStatus = "보통";
    let vixColor = "#F59E0B";
    if (grouped.vix && grouped.vix.numValue) {
      const v = grouped.vix.numValue;
      if (v < 15) { vixStatus = "안정"; vixColor = "#03B26C"; }
      else if (v < 20) { vixStatus = "보통"; vixColor = "#F59E0B"; }
      else if (v < 30) { vixStatus = "불안"; vixColor = "#F59E0B"; }
      else { vixStatus = "공포"; vixColor = "#F04452"; }
    }

    return Response.json({
      indicesUS: grouped.idxUS,
      indicesKR: grouped.idxKR,
      econUS: grouped.econUS,
      econKR: grouped.econKR,
      vix: grouped.vix ? { ...grouped.vix, status: vixStatus, statusColor: vixColor } : null,
      exchangeRate,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
