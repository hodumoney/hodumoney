// app/api/market/yesterday/route.js
// 호두레터 에디터용: 어제(직전 거래일) 종가 + 전전일 대비 등락
export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };

/**
 * Yahoo Finance에서 최근 5거래일 일봉을 가져와서
 * 마지막 완료된 거래일(=어제) 종가와 그 전 거래일 종가를 비교
 */
async function fetchYesterdayClose(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    let res = await fetch(url, { headers: UA, cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      res = await fetch(url.replace("query1.", "query2."), { headers: UA, cache: "no-store" }).catch(() => null);
    }
    if (!res?.ok) return null;

    const r = (await res.json())?.chart?.result?.[0];
    if (!r) return null;

    const closes = r.indicators?.quote?.[0]?.close || [];
    const timestamps = r.timestamp || [];

    // 유효한 (종가가 있는) 데이터만 필터링
    const valid = [];
    for (let i = 0; i < closes.length; i++) {
      if (typeof closes[i] === "number" && isFinite(closes[i]) && timestamps[i]) {
        valid.push({ close: closes[i], ts: timestamps[i] });
      }
    }

    if (valid.length < 2) return null;

    // 마지막 = 오늘(장중) 또는 가장 최근 완료된 거래일
    // 그 전 = 전전일
    // Yahoo의 range=5d는 오늘 장이 열려있으면 오늘 데이터도 포함함
    // 그래서 마지막이 "오늘"인지 "어제"인지 판단 필요

    const now = new Date();
    const lastTs = new Date(valid[valid.length - 1].ts * 1000);
    const isSameDay = (a, b) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();

    let yesterdayIdx, dayBeforeIdx;

    if (isSameDay(lastTs, now)) {
      // 마지막 데이터가 오늘 → 어제 = [끝-2], 전전일 = [끝-3]
      if (valid.length < 3) return null;
      yesterdayIdx = valid.length - 2;
      dayBeforeIdx = valid.length - 3;
    } else {
      // 마지막 데이터가 어제(장 마감 후) → 어제 = [끝-1], 전전일 = [끝-2]
      yesterdayIdx = valid.length - 1;
      dayBeforeIdx = valid.length - 2;
    }

    const yesterdayClose = valid[yesterdayIdx].close;
    const dayBeforeClose = valid[dayBeforeIdx].close;
    const change = yesterdayClose - dayBeforeClose;
    const changePct = dayBeforeClose ? (change / dayBeforeClose) * 100 : 0;

    const yd = new Date(valid[yesterdayIdx].ts * 1000);
    const dateStr = `${yd.getUTCFullYear()}-${String(yd.getUTCMonth() + 1).padStart(2, "0")}-${String(yd.getUTCDate()).padStart(2, "0")}`;

    return {
      close: yesterdayClose,
      prevClose: dayBeforeClose,
      change,
      changePct,
      date: dateStr,
    };
  } catch {
    return null;
  }
}

function fmtN(v, d = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "0";
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export async function GET() {
  try {
    const defs = [
      { sym: "^GSPC", name: "S&P 500", group: "us" },
      { sym: "^IXIC", name: "나스닥 100", group: "us" },
      { sym: "^DJI", name: "다우존스", group: "us" },
      { sym: "DX-Y.NYB", name: "달러인덱스", group: "us" },
      { sym: "^KS11", name: "코스피", group: "kr" },
      { sym: "^KQ11", name: "코스닥", group: "kr" },
      { sym: "USDKRW=X", name: "원/달러 환율", group: "kr" },
    ];

    const results = await Promise.all(defs.map(d => fetchYesterdayClose(d.sym)));

    const build = (def, data) => {
      if (!data) return { name: def.name, value: "-", change: "-", pct: "-", up: false };

      const up = data.change >= 0;
      const val = fmtN(data.close, 2);
      const chg = `${up ? "+" : ""}${fmtN(data.change, 2)}`;
      const pct = `${up ? "+" : ""}${data.changePct.toFixed(1)}%`;

      return { name: def.name, value: val, change: chg, pct, up, date: data.date };
    };

    const us = [];
    const kr = [];
    let tradingDate = "";

    defs.forEach((def, i) => {
      const item = build(def, results[i]);
      if (results[i]?.date) tradingDate = results[i].date;
      if (def.group === "us") us.push(item);
      else kr.push(item);
    });

    return Response.json({ us, kr, tradingDate });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
