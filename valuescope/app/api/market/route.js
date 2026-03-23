// app/api/market/route.js — Real-time market data (1D changes)
export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };

async function fetchYahoo(symbol) {
  try {
    const [res5d, res1y] = await Promise.all([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, { headers: UA, cache: "no-store" }),
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`, { headers: UA, cache: "no-store" }),
    ]);
    let price=0, prevClose=0, change=0, changePct=0;
    if (res5d.ok) {
      const r = (await res5d.json())?.chart?.result?.[0];
      if (r) { const m=r.meta||{}; price=m.regularMarketPrice||0; prevClose=m.chartPreviousClose||m.previousClose||0; change=price-prevClose; changePct=prevClose?(change/prevClose)*100:0; }
    }
    let history=[], yearHigh=0, yearLow=0;
    if (res1y.ok) {
      const r = (await res1y.json())?.chart?.result?.[0];
      if (r) {
        if (!price) { const m=r.meta||{}; price=m.regularMarketPrice||0; prevClose=m.chartPreviousClose||m.previousClose||0; change=price-prevClose; changePct=prevClose?(change/prevClose)*100:0; }
        const c=r.indicators?.quote?.[0]?.close||[], ts=r.timestamp||[];
        const v=c.filter(x=>typeof x==="number"&&isFinite(x));
        yearHigh=v.length?Math.max(...v):0; yearLow=v.length?Math.min(...v):0;
        const step=Math.max(1,Math.floor(c.length/12));
        for(let i=0;i<c.length;i+=step) { if(c[i]&&ts[i]){const d=new Date(ts[i]*1000); history.push({label:`${String(d.getFullYear()).slice(-2)}.${String(d.getMonth()+1).padStart(2,"0")}`,value:Math.round(c[i]*100)/100});} }
        if(c[c.length-1]&&ts[ts.length-1]){const d=new Date(ts[ts.length-1]*1000);const l=`${String(d.getFullYear()).slice(-2)}.${String(d.getMonth()+1).padStart(2,"0")}`;if(!history.length||history[history.length-1].label!==l)history.push({label:l,value:Math.round(c[c.length-1]*100)/100});}
      }
    }
    return { price, prevClose, change, changePct, history, yearHigh, yearLow };
  } catch { return null; }
}

function fmtN(v,d=2){if(v===null||v===undefined)return"0";return v.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});}

export async function GET() {
  try {
    const defs = [
      { sym:"^GSPC", name:"S&P 500", group:"idxUS" },
      { sym:"^IXIC", name:"나스닥", group:"idxUS" },
      { sym:"^DJI", name:"다우존스", group:"idxUS" },
      { sym:"^KS11", name:"코스피", group:"idxKR" },
      { sym:"^KQ11", name:"코스닥", group:"idxKR" },
      { sym:"^TNX", name:"10년물 국채금리", group:"econUS", suffix:"%", dec:3 },
      { sym:"^FVX", name:"2년물 국채금리", group:"econUS", suffix:"%", dec:3 },
      { sym:"DX-Y.NYB", name:"달러 인덱스 (DXY)", group:"econUS" },
      { sym:"USDKRW=X", name:"원/달러 환율", group:"econKR" },
      { sym:"JPYKRW=X", name:"원/엔 환율 (100엔)", group:"econKR", mult:100 },
      { sym:"^VIX", name:"VIX 공포 지수", group:"vix" },
    ];

    const results = await Promise.all(defs.map(d=>fetchYahoo(d.sym)));

    const build=(def,data)=>{
      if(!data)return{name:def.name,value:"-",change:"-",pct:"-",up:false,history:[],yahooSymbol:def.sym,chartMult:def.mult||1};
      let p=data.price,c=data.change,cp=data.changePct;
      if(def.mult){p*=def.mult;c*=def.mult;}
      const up=c>=0,dec=def.dec||2;
      const val=def.suffix?`${p.toFixed(dec)}${def.suffix}`:fmtN(p,dec);
      const chg=def.suffix?`${up?"+":""}${c.toFixed(dec)}${def.suffix}`:`${up?"+":""}${fmtN(c,dec)}`;
      let hist=data.history||[];
      if(def.mult)hist=hist.map(h=>({...h,value:Math.round(h.value*def.mult*100)/100}));
      return{name:def.name,value:val,numValue:p,change:chg,pct:`${up?"+":""}${cp.toFixed(1)}%`,up,history:hist,yearHigh:def.mult?(data.yearHigh||0)*def.mult:data.yearHigh||0,yearLow:def.mult?(data.yearLow||0)*def.mult:data.yearLow||0,yahooSymbol:def.sym,chartMult:def.mult||1};
    };

    const g={idxUS:[],idxKR:[],econUS:[],econKR:[],vix:null};
    defs.forEach((def,i)=>{const item=build(def,results[i]);if(def.group==="vix")g.vix=item;else g[def.group].push(item);});

    // Static indicators
    const staticEconUS=[
      {name:"미국 기준금리 (FFR)",value:"4.25 ~ 4.50%",status:"2025.01 인하",statusColor:"var(--text-tertiary)",isStatic:true},
      {name:"CPI (전년비)",value:"2.8%",status:"2025.02 발표",statusColor:"var(--text-tertiary)",isStatic:true},
      {name:"실업률",value:"4.1%",status:"2025.03 발표",statusColor:"var(--text-tertiary)",isStatic:true},
    ];
    const staticEconKR=[
      {name:"한국 기준금리",value:"2.75%",status:"2025.02 인하",statusColor:"var(--text-tertiary)",isStatic:true},
      {name:"한국 CPI (전년비)",value:"2.2%",status:"2025.02 발표",statusColor:"var(--text-tertiary)",isStatic:true},
    ];

    const usdkrw=results[defs.findIndex(d=>d.sym==="USDKRW=X")];
    const exchangeRate=usdkrw?fmtN(usdkrw.price,2):"N/A";

    let vixStatus="보통",vixColor="#F59E0B";
    if(g.vix?.numValue){const v=g.vix.numValue;if(v<15){vixStatus="안정";vixColor="#03B26C";}else if(v<20){vixStatus="보통";vixColor="#F59E0B";}else if(v<30){vixStatus="불안";vixColor="#F59E0B";}else{vixStatus="공포";vixColor="#F04452";}}

    return Response.json({
      indicesUS:g.idxUS,indicesKR:g.idxKR,
      econUS:[...g.econUS,...staticEconUS],
      econKR:[...g.econKR,...staticEconKR],
      vix:g.vix?{...g.vix,status:vixStatus,statusColor:vixColor}:null,
      exchangeRate,updatedAt:new Date().toISOString(),
    });
  }catch(err){return Response.json({error:err.message},{status:500});}
}
