import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── Firebase 설정 (lazy load — 빌드 시 실행 안 됨) ─────────────
// 이 값들을 본인의 Firebase 프로젝트 설정으로 교체하세요
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyABrvoetmfs4pFYMR2IFjBXKhxeYa_eZbs",
  authDomain: "hodumoney-1e015.firebaseapp.com",
  projectId: "hodumoney-1e015",
  storageBucket: "hodumoney-1e015.firebasestorage.app",
  messagingSenderId: "674599618160",
  appId: "1:674599618160:web:2492e68229f14d4324d6b5",
};

let _firebaseAuth = null;
async function getFirebaseAuth() {
  if (_firebaseAuth) return _firebaseAuth;
  const { initializeApp, getApps } = await import("firebase/app");
  const { getAuth } = await import("firebase/auth");
  const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
  _firebaseAuth = getAuth(app);
  return _firebaseAuth;
}

const ADMIN_EMAIL = "qkrgkdus2017@gmail.com";

let _firebaseStorage = null;
async function getFirebaseStorage() {
  if (_firebaseStorage) return _firebaseStorage;
  const { initializeApp, getApps } = await import("firebase/app");
  const { getStorage } = await import("firebase/storage");
  const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
  _firebaseStorage = getStorage(app);
  return _firebaseStorage;
}

let _firebaseFirestore = null;
async function getFirebaseFirestore() {
  if (_firebaseFirestore) return _firebaseFirestore;
  const { initializeApp, getApps } = await import("firebase/app");
  const { getFirestore } = await import("firebase/firestore");
  const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
  _firebaseFirestore = getFirestore(app);
  return _firebaseFirestore;
}

// ─── Helper: generate fake historical data ───────────────────────
function genHistory(current, months = 12, volatility = 0.02, trend = 0) {
  const pts = [];
  let val = current * (1 - trend * months * 0.6);
  const labels = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  for (let i = 0; i < months; i++) {
    val = val * (1 + trend + (Math.random() - 0.48) * volatility);
    pts.push({ label: labels[i], value: Math.round(val * 100) / 100 });
  }
  return pts;
}

// ─── Constants & Data ────────────────────────────────────────────
const MENU_ITEMS = [
  { id: "market", label: "시장 동향", icon: "📊", ready: true },
  { id: "company", label: "기업 분석", icon: "🔍", ready: true },
  { id: "briefing", label: "호두 브리핑", icon: "🗞️", ready: true },
  { id: "etf", label: "ETF 단일 분석", icon: "📦", ready: false },
  { id: "etf-compare", label: "ETF 비교 분석", icon: "⚖️", ready: false },
  { id: "correlation", label: "상관관계 분석", icon: "🔗", ready: false },
  { id: "backtest", label: "백테스트", icon: "⏪", ready: false },
  { id: "watchlist", label: "관심 종목", icon: "⭐", ready: true },
];

const INDICES_US = [
  { name: "S&P 500", value: "5,307.01", numValue: 5307.01, change: "-14.4", pct: "-0.2%", up: false, history: genHistory(5307, 12, 0.015, 0.008) },
  { name: "나스닥", value: "16,801.54", numValue: 16801.54, change: "-31.08", pct: "-0.1%", up: false, history: genHistory(16801, 12, 0.02, 0.012) },
  { name: "다우존스", value: "39,671.04", numValue: 39671.04, change: "-201.95", pct: "-0.5%", up: false, history: genHistory(39671, 12, 0.012, 0.006) },
];

const INDICES_KR = [
  { name: "코스피", value: "2,726.68", numValue: 2726.68, change: "+3.22", pct: "+0.1%", up: true, history: genHistory(2726, 12, 0.015, 0.002) },
  { name: "코스닥", value: "847.12", numValue: 847.12, change: "+1.40", pct: "+0.2%", up: true, history: genHistory(847, 12, 0.02, 0.001) },
];

const ECON_INDICATORS_US = [
  { name: "기준금리 (FFR)", value: "5.25 ~ 5.50%", status: "동결", statusColor: "var(--text-tertiary)", history: [{label:"23.07",value:5.25},{label:"23.09",value:5.25},{label:"23.11",value:5.25},{label:"24.01",value:5.25},{label:"24.03",value:5.25},{label:"24.05",value:5.25},{label:"24.07",value:5.50},{label:"24.09",value:5.50},{label:"24.11",value:5.50},{label:"25.01",value:5.50},{label:"25.03",value:5.50},{label:"25.05",value:5.50}] },
  { name: "10년물 국채금리", value: "4.284%", change: "+0.032%", up: true, history: genHistory(4.284, 12, 0.04, -0.005) },
  { name: "2년물 국채금리", value: "4.731%", change: "-0.018%", up: false, history: genHistory(4.731, 12, 0.035, -0.008) },
  { name: "달러 인덱스 (DXY)", value: "104.32", change: "-0.15", pct: "-0.1%", up: false, history: genHistory(104.32, 12, 0.01, 0.001) },
  { name: "CPI (전년비)", value: "3.4%", status: "최신: 2024.05", statusColor: "var(--text-tertiary)", history: [{label:"23.06",value:3.0},{label:"23.08",value:3.2},{label:"23.10",value:3.2},{label:"23.12",value:3.4},{label:"24.02",value:3.1},{label:"24.04",value:3.4},{label:"24.06",value:3.3},{label:"24.08",value:3.5},{label:"24.10",value:3.2},{label:"24.12",value:3.4},{label:"25.02",value:3.3},{label:"25.04",value:3.4}] },
  { name: "실업률", value: "3.9%", status: "최신: 2024.05", statusColor: "var(--text-tertiary)", history: [{label:"23.06",value:3.6},{label:"23.08",value:3.8},{label:"23.10",value:3.9},{label:"23.12",value:3.7},{label:"24.02",value:3.7},{label:"24.04",value:3.9},{label:"24.06",value:3.8},{label:"24.08",value:4.0},{label:"24.10",value:3.8},{label:"24.12",value:3.9},{label:"25.02",value:3.8},{label:"25.04",value:3.9}] },
];

const ECON_INDICATORS_KR = [
  { name: "기준금리", value: "3.50%", status: "동결", statusColor: "var(--text-tertiary)", history: [{label:"23.07",value:3.50},{label:"23.09",value:3.50},{label:"23.11",value:3.50},{label:"24.01",value:3.50},{label:"24.03",value:3.50},{label:"24.05",value:3.50},{label:"24.07",value:3.50},{label:"24.09",value:3.50},{label:"24.11",value:3.50},{label:"25.01",value:3.50},{label:"25.03",value:3.50},{label:"25.05",value:3.50}] },
  { name: "원/달러 환율", value: "1,386.93", change: "+5.43", pct: "+0.4%", up: true, history: genHistory(1386.93, 12, 0.012, 0.003) },
  { name: "원/엔 환율 (100엔)", value: "884.21", change: "-2.15", pct: "-0.2%", up: false, history: genHistory(884.21, 12, 0.015, -0.002) },
  { name: "CPI (전년비)", value: "2.7%", status: "최신: 2024.05", statusColor: "var(--text-tertiary)", history: [{label:"23.06",value:2.7},{label:"23.08",value:3.1},{label:"23.10",value:3.3},{label:"23.12",value:3.2},{label:"24.02",value:2.8},{label:"24.04",value:2.9},{label:"24.06",value:2.6},{label:"24.08",value:2.8},{label:"24.10",value:2.5},{label:"24.12",value:2.7},{label:"25.02",value:2.6},{label:"25.04",value:2.7}] },
];

const SENTIMENT_FEARGREED = {
  name: "CNN Fear & Greed Index", value: "15", change: "-2", pct: "-11.8%", up: false,
  history: [{label:"23.07",value:72},{label:"23.09",value:55},{label:"23.11",value:48},{label:"24.01",value:62},{label:"24.03",value:58},{label:"24.05",value:45},{label:"24.07",value:51},{label:"24.09",value:38},{label:"24.11",value:42},{label:"25.01",value:35},{label:"25.03",value:28},{label:"25.05",value:15}]
};

const SENTIMENT_VIX = {
  name: "VIX 공포 지수", value: "26.78", change: "+2.72", pct: "+11.31%", up: true,
  history: [{label:"23.07",value:13.5},{label:"23.09",value:17.2},{label:"23.11",value:14.8},{label:"24.01",value:13.1},{label:"24.03",value:14.3},{label:"24.05",value:12.9},{label:"24.07",value:16.4},{label:"24.09",value:19.8},{label:"24.11",value:15.1},{label:"25.01",value:18.2},{label:"25.03",value:24.1},{label:"25.05",value:26.8}]
};

// ─── Styles ──────────────────────────────────────────────────────
const styles = `
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');

  :root {
    --bg-primary: #F5F6F8;
    --bg-card: #FFFFFF;
    --bg-hover: #F8F9FA;
    --text-primary: #191F28;
    --text-secondary: #6B7684;
    --text-tertiary: #8B95A1;
    --accent-blue: #3182F6;
    --accent-blue-light: #EBF3FE;
    --accent-red: #F04452;
    --accent-red-light: #FFF0F1;
    --accent-green: #03B26C;
    --accent-green-light: #E8FAF3;
    --border: #E5E8EB;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
    --shadow-lg: 0 8px 24px rgba(0,0,0,0.08);
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    -webkit-font-smoothing: antialiased;
  }

  .app-container { display: flex; min-height: 100vh; }

  .sidebar {
    width: 240px; background: var(--bg-card); border-right: 1px solid var(--border);
    padding: 24px 0; position: fixed; top: 0; left: 0; height: 100vh;
    overflow-y: auto; z-index: 100; transition: transform 0.3s ease;
  }
  .sidebar-logo {
    padding: 32px 24px 24px; display: flex; flex-direction: column; align-items: center; gap: 0;
    margin: 0; border-bottom: 1px solid var(--border); cursor: pointer; text-align: center;
  }
  .sidebar-logo::before { display: none; }
  .sidebar-logo::after { display: none; }
  .logo-icon { font-size: 36px; margin-bottom: 8px; }
  .logo-text { font-size: 28px; font-weight: 900; color: #5D4037; letter-spacing: -0.5px; line-height: 1; }
  .logo-sub { font-size: 12px; color: var(--text-tertiary); font-weight: 500; margin-top: 8px; letter-spacing: 0.3px; }
  .sidebar-section { padding: 0 12px; margin-bottom: 8px; }
  .sidebar-section-label { font-size: 11px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; padding: 0 12px; margin-bottom: 6px; }
  .sidebar-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s ease; font-size: 14px; font-weight: 500; color: var(--text-secondary); position: relative; }
  .sidebar-item:hover { background: var(--bg-hover); color: var(--text-primary); }
  .sidebar-item.active { background: var(--accent-blue-light); color: var(--accent-blue); font-weight: 600; }
  .sidebar-item .item-icon { font-size: 16px; width: 24px; text-align: center; }
  .sidebar-item .badge-soon { font-size: 10px; background: #F2F3F5; color: var(--text-tertiary); padding: 2px 6px; border-radius: 4px; margin-left: auto; font-weight: 600; }
  .sidebar-divider { height: 1px; background: var(--border); margin: 12px 24px; }

  .main-content { flex: 1; margin-left: 240px; padding: 0; min-height: 100vh; }

  .top-bar {
    position: sticky; top: 0; background: rgba(255,255,255,0.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border); padding: 0 32px; height: 60px;
    display: flex; align-items: center; justify-content: space-between; z-index: 50;
  }
  .top-bar-title { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }

  /* ── Search Box with Autocomplete ── */
  .search-wrapper { position: relative; width: 400px; }
  .search-box {
    display: flex; align-items: center; gap: 8px; background: var(--bg-primary);
    border: 1px solid var(--border); border-radius: 10px; padding: 8px 14px;
    width: 100%; transition: all 0.2s ease;
  }
  .search-box:focus-within { border-color: var(--accent-blue); box-shadow: 0 0 0 3px rgba(49,130,246,0.12); background: white; }
  .search-box input { flex: 1; border: none; outline: none; background: transparent; font-size: 14px; color: var(--text-primary); font-family: inherit; }
  .search-box input::placeholder { color: var(--text-tertiary); }
  .search-icon { color: var(--text-tertiary); font-size: 16px; }

  .search-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    background: white; border: 1px solid var(--border); border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12); overflow: hidden; z-index: 200;
    max-height: 360px; overflow-y: auto;
  }
  .search-dropdown-item {
    display: flex; align-items: center; gap: 12px; padding: 12px 16px;
    cursor: pointer; transition: background 0.1s ease; border-bottom: 1px solid #F5F6F8;
  }
  .search-dropdown-item:last-child { border-bottom: none; }
  .search-dropdown-item:hover, .search-dropdown-item.highlighted { background: var(--accent-blue-light); }
  .search-dropdown-symbol {
    font-size: 14px; font-weight: 700; color: var(--text-primary);
    min-width: 70px; font-variant-numeric: tabular-nums;
  }
  .search-dropdown-name { font-size: 13px; color: var(--text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .search-dropdown-type { font-size: 10px; font-weight: 600; color: var(--text-tertiary); background: #F2F3F5; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; }
  .search-dropdown-empty { padding: 20px 16px; text-align: center; color: var(--text-tertiary); font-size: 13px; }
  .search-dropdown-loading { padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 13px; }
  .search-clear-btn {
    background: none; border: none; color: var(--text-tertiary); cursor: pointer;
    font-size: 14px; padding: 2px 4px; display: flex; align-items: center; transition: color 0.15s;
  }
  .search-clear-btn:hover { color: var(--text-primary); }

  .content-area { padding: 28px 32px 60px; max-width: 1200px; }

  .index-strip { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 28px; }
  .index-card { flex: 1 1 0; min-width: 200px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px 24px; cursor: pointer; transition: all 0.2s ease; }
  .index-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
  .index-card-lg { min-width: 200px; padding: 18px 22px; }
  .index-card-lg .index-name { font-size: 13px; margin-bottom: 8px; }
  .index-card-lg .index-value { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
  .index-card-lg .index-change { font-size: 13px; }
  .index-strip-three { justify-content: flex-start; }
  .index-card-fixed { flex: 0 0 calc((100% - 32px) / 3); max-width: calc((100% - 32px) / 3); }
  .index-name { font-size: 13px; color: var(--text-tertiary); font-weight: 500; margin-bottom: 8px; }
  .index-value { font-size: 24px; font-weight: 700; letter-spacing: -0.3px; margin-bottom: 4px; }
  .index-change { font-size: 13px; font-weight: 600; }
  .index-change.up { color: var(--accent-red); }
  .index-change.down { color: var(--accent-blue); }

  .section-header { margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
  .section-title { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
  .section-subtitle { font-size: 13px; color: var(--text-tertiary); margin-top: 4px; }

  .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 20px; transition: box-shadow 0.2s ease; }
  .card:hover { box-shadow: var(--shadow-sm); }
  .card-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
  .card-description { font-size: 13px; color: var(--text-tertiary); margin-bottom: 20px; }

  .company-hero { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 28px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; }
  .company-info h2 { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 2px; }
  .company-ticker { font-size: 14px; color: var(--text-tertiary); font-weight: 500; margin-bottom: 8px; }
  .company-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; max-width: 500px; }
  .price-block { text-align: right; min-width: 200px; }
  .price-current { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; }
  .price-change { font-size: 14px; font-weight: 600; margin-top: 2px; }
  .price-change.negative { color: var(--accent-blue); }
  .price-change.positive { color: var(--accent-red); }

  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .stat-item { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px 18px; }
  .stat-label { font-size: 12px; color: var(--text-tertiary); font-weight: 500; margin-bottom: 6px; }
  .stat-value { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
  .stat-sub { font-size: 11px; color: var(--text-tertiary); margin-top: 3px; }

  .metric-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px 20px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s ease; position: relative; }
  .metric-card:hover { box-shadow: var(--shadow-sm); }
  .metric-card.expanded { border-color: var(--accent-blue); box-shadow: 0 0 0 2px rgba(49,130,246,0.1); }
  .metric-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .metric-card-left { display: flex; align-items: center; gap: 16px; min-width: 0; }
  .metric-card-name { font-size: 14px; font-weight: 700; color: var(--text-primary); min-width: 120px; flex-shrink: 0; }
  .metric-card-value { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.3px; color: var(--text-primary); min-width: 90px; text-align: right; }
  .metric-card-desc { font-size: 12px; color: var(--text-tertiary); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 12px; }
  .metric-card-mini { display: flex; align-items: flex-end; gap: 3px; height: 56px; min-width: 72px; flex-shrink: 0; }
  .metric-card-mini .m-bar { flex: 1; background: var(--accent-blue); border-radius: 3px; min-width: 9px; opacity: 0.45; transition: height 0.3s ease; }
  .metric-card-mini .m-bar:last-child { opacity: 1; }
  .metric-card-arrow { font-size: 12px; color: var(--text-tertiary); transition: transform 0.2s ease; margin-left: 8px; flex-shrink: 0; }
  .metric-card.expanded .metric-card-arrow { transform: rotate(180deg); }

  @keyframes expandMetric { from { opacity: 0; max-height: 0; padding-top: 0; } to { opacity: 1; max-height: 340px; padding-top: 14px; } }
  .metric-card-expand { overflow: hidden; animation: expandMetric 0.3s cubic-bezier(0.16,1,0.3,1) forwards; border-top: 1px solid #F2F3F5; margin-top: 14px; }
  .metric-card-expand-body { padding-top: 4px; }

  @media (max-width: 768px) { .metric-card-desc { display: none; } .metric-card-name { min-width: 90px; } }

  .tab-group { display: flex; gap: 4px; background: var(--bg-primary); border-radius: var(--radius-sm); padding: 3px; margin-bottom: 20px; width: fit-content; }
  .tab-btn { padding: 7px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: transparent; color: var(--text-tertiary); transition: all 0.15s ease; font-family: inherit; }
  .tab-btn.active { background: var(--bg-card); color: var(--text-primary); box-shadow: var(--shadow-sm); }
  .tab-btn:hover:not(.active) { color: var(--text-secondary); }

  .toggle-group { display: flex; gap: 0; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; width: fit-content; }
  .toggle-btn { padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: var(--bg-card); color: var(--text-tertiary); transition: all 0.15s ease; font-family: inherit; border-right: 1px solid var(--border); }
  .toggle-btn:last-child { border-right: none; }
  .toggle-btn.active { background: var(--accent-blue); color: white; }

  .coming-soon { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; text-align: center; }
  .coming-soon-icon { font-size: 48px; margin-bottom: 16px; }
  .coming-soon h3 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
  .coming-soon p { font-size: 14px; color: var(--text-tertiary); line-height: 1.6; }

  .empty-state { text-align: center; padding: 60px 20px; }
  .empty-state-icon { font-size: 56px; margin-bottom: 16px; opacity: 0.6; }
  .empty-state h3 { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: var(--text-primary); }
  .empty-state p { font-size: 14px; color: var(--text-tertiary); line-height: 1.6; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .fade-up { animation: fadeUp 0.4s ease forwards; }
  .fade-up-d1 { animation-delay: 0.05s; opacity: 0; }
  .fade-up-d2 { animation-delay: 0.1s; opacity: 0; }
  .fade-up-d3 { animation-delay: 0.15s; opacity: 0; }
  .fade-up-d4 { animation-delay: 0.2s; opacity: 0; }

  .mobile-menu-btn { display: none; background: none; border: none; font-size: 22px; cursor: pointer; padding: 4px; color: var(--text-primary); }
  .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 99; }

  @media (max-width: 768px) {
    .sidebar { transform: translateX(-100%); }
    .sidebar.open { transform: translateX(0); }
    .sidebar-overlay.open { display: block; }
    .main-content { margin-left: 0; }
    .mobile-menu-btn { display: block; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .index-card-fixed { flex: 1 1 0; max-width: none; }
    .company-hero { flex-direction: column; }
    .price-block { text-align: left; }
    .search-wrapper { width: 220px; }
    .content-area { padding: 20px 16px 60px; }
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D5D8DC; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #B0B8C1; }

  .exchange-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 20px; padding: 5px 12px; font-size: 12px; color: var(--text-secondary); font-weight: 500; }

  .news-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
  @media (max-width: 768px) { .news-grid { grid-template-columns: 1fr; } }
  .news-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; cursor: pointer; transition: all 0.2s ease; }
  .news-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
  .news-thumb { height: 140px; background: linear-gradient(135deg, #E8EAED 0%, #D1D5DB 100%); display: flex; align-items: center; justify-content: center; font-size: 32px; color: var(--text-tertiary); }
  .news-body { padding: 14px 16px; }
  .news-tag { font-size: 11px; font-weight: 600; color: var(--accent-blue); margin-bottom: 6px; }
  .news-title-text { font-size: 14px; font-weight: 600; line-height: 1.5; color: var(--text-primary); }

  .market-tabs { display: flex; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 0; }
  .market-tab { padding: 8px 4px 12px; font-size: 15px; font-weight: 600; cursor: pointer; border: none; background: none; color: var(--text-tertiary); position: relative; font-family: inherit; transition: color 0.15s ease; }
  .market-tab.active { color: var(--text-primary); }
  .market-tab.active::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: var(--text-primary); border-radius: 1px; }
  .market-tab:hover { color: var(--text-primary); }

  .econ-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  @media (max-width: 768px) { .econ-grid { grid-template-columns: repeat(2, 1fr); } }
  .econ-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px 18px; transition: box-shadow 0.2s ease; }
  .econ-card:hover { box-shadow: var(--shadow-sm); }
  .econ-name { font-size: 12px; color: var(--text-tertiary); font-weight: 500; margin-bottom: 8px; }
  .econ-value { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; margin-bottom: 3px; font-variant-numeric: tabular-nums; }
  .econ-change { font-size: 12px; font-weight: 600; }
  .econ-change.up { color: var(--accent-red); }
  .econ-change.down { color: var(--accent-blue); }
  .econ-status { font-size: 11px; font-weight: 600; display: inline-block; padding: 2px 8px; border-radius: 4px; background: #F2F3F5; }

  .country-label { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 14px; padding: 0; background: none; border-radius: 0; }
  .country-flag { font-size: 18px; }

  .sentiment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  @media (max-width: 768px) { .sentiment-grid { grid-template-columns: 1fr; } }
  .sentiment-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; text-align: center; }
  .sentiment-card-label { font-size: 13px; font-weight: 600; color: var(--text-tertiary); margin-bottom: 12px; letter-spacing: -0.2px; }
  .sentiment-gauge { position: relative; width: 180px; height: 100px; margin: 0 auto 12px; overflow: hidden; }
  .sentiment-gauge-bg { position: absolute; bottom: 0; left: 0; right: 0; height: 90px; border-radius: 90px 90px 0 0; overflow: hidden; }
  .sentiment-gauge-needle { position: absolute; bottom: 4px; left: 50%; width: 3px; height: 70px; background: var(--text-primary); border-radius: 2px; transform-origin: bottom center; transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); z-index: 2; margin-left: -1.5px; }
  .sentiment-gauge-center { position: absolute; bottom: 0; left: 50%; width: 12px; height: 12px; background: var(--text-primary); border-radius: 50%; transform: translateX(-50%); z-index: 3; }
  .sentiment-value { font-size: 36px; font-weight: 800; letter-spacing: -1px; line-height: 1; }
  .sentiment-status { font-size: 14px; font-weight: 700; margin-top: 4px; letter-spacing: -0.3px; }
  .sentiment-desc { font-size: 12px; color: var(--text-tertiary); margin-top: 8px; line-height: 1.5; }
  .sentiment-sub-values { display: flex; justify-content: center; gap: 20px; margin-top: 12px; font-size: 12px; color: var(--text-secondary); }
  .sentiment-sub-values span { display: flex; align-items: center; gap: 4px; }

  @keyframes expandDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 400px; } }
  .inline-chart-panel { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-top: 12px; margin-bottom: 8px; overflow: hidden; animation: expandDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .inline-chart-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0; }
  .inline-chart-left { display: flex; align-items: baseline; gap: 12px; }
  .inline-chart-title { font-size: 16px; font-weight: 700; letter-spacing: -0.3px; }
  .inline-chart-val { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; }
  .inline-chart-chg { font-size: 13px; font-weight: 600; }
  .inline-chart-close { background: var(--bg-primary); border: none; width: 28px; height: 28px; border-radius: 50%; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); transition: background 0.15s ease; }
  .inline-chart-close:hover { background: var(--border); }
  .inline-chart-periods { display: flex; gap: 4px; padding: 10px 20px 0; }
  .inline-chart-body { padding: 8px 8px 16px; }

  .chart-period-btn { padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: transparent; color: var(--text-tertiary); font-family: inherit; transition: all 0.15s ease; }
  .chart-period-btn.active { background: var(--accent-blue-light); color: var(--accent-blue); }
  .chart-period-btn:hover:not(.active) { background: var(--bg-hover); }

  .index-card.clickable, .econ-card.clickable { cursor: pointer; position: relative; }
  .index-card.clickable:active, .econ-card.clickable:active { transform: scale(0.98); }
  .index-card.selected, .econ-card.selected { border-color: var(--accent-blue); box-shadow: 0 0 0 2px rgba(49,130,246,0.15); }
    .card-chart-btn {
    position: absolute; top: 50%; right: 14px; transform: translateY(-50%); width: 32px; height: 32px;
    border: 1px solid var(--border); border-radius: 8px; background: #fff;
    color: var(--text-tertiary); font-size: 15px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;
    opacity: 0; pointer-events: auto;
  }
  .index-card:hover .card-chart-btn, .econ-card:hover .card-chart-btn { opacity: 1; }
  .card-chart-btn:hover { border-color: var(--accent-blue); color: var(--accent-blue); background: var(--accent-blue-light); }

  .section-header-distinct {
    margin-bottom: 20px; padding: 0 0 12px;
    background: transparent; border: none; border-radius: 0;
    border-bottom: 2px solid var(--border);
  }
  .section-header-distinct .section-title { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: var(--text-primary); }
  .section-header-distinct .section-subtitle { font-size: 13px; color: var(--text-tertiary); font-weight: 400; margin-top: 3px; }
  .section-header-distinct.indices, .section-header-distinct.econ { border-left: none; }

  .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .data-table thead th { text-align: right; padding: 10px 12px; font-weight: 600; color: var(--text-tertiary); font-size: 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .data-table thead th:first-child { text-align: left; }
  .data-table tbody td { text-align: right; padding: 11px 12px; font-weight: 500; border-bottom: 1px solid #F2F3F5; font-variant-numeric: tabular-nums; }
  .data-table tbody td:first-child { text-align: left; color: var(--text-secondary); font-weight: 600; }
  .data-table tbody tr:hover { background: var(--bg-hover); }
  .data-table tbody tr:last-child td { border-bottom: none; }

  .paywall-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
    z-index: 300; display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .paywall-card {
    background: white; border-radius: 20px; padding: 36px 32px; max-width: 400px; width: 90%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15); text-align: center;
  }
  .paywall-card h3 { font-size: 20px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.4px; }
  .paywall-card p { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px; }
  .paywall-input {
    width: 100%; padding: 12px 16px; border: 1px solid var(--border); border-radius: 10px;
    font-size: 14px; font-family: inherit; outline: none; text-align: center;
    letter-spacing: 2px; font-weight: 600; transition: border-color 0.15s;
  }
  .paywall-input:focus { border-color: var(--accent-blue); box-shadow: 0 0 0 3px rgba(49,130,246,0.12); }
  .paywall-input.error { border-color: var(--accent-red); box-shadow: 0 0 0 3px rgba(240,68,82,0.12); }
  .paywall-submit {
    width: 100%; padding: 12px; margin-top: 12px; border: none; border-radius: 10px;
    background: var(--accent-blue); color: white; font-size: 15px; font-weight: 700;
    cursor: pointer; font-family: inherit; transition: background 0.15s;
  }
  .paywall-submit:hover { background: #1B64DA; }
  .paywall-counter { font-size: 12px; color: var(--text-tertiary); margin-top: 12px; }
  .paywall-error { font-size: 12px; color: var(--accent-red); margin-top: 8px; font-weight: 600; }
  .paywall-close {
    position: absolute; top: 16px; right: 16px; background: none; border: none;
    font-size: 18px; color: var(--text-tertiary); cursor: pointer;
  }
  .usage-badge {
    display: inline-flex; align-items: center; gap: 5px; font-size: 11px;
    color: var(--text-tertiary); font-weight: 500; padding: 3px 10px;
    background: var(--bg-primary); border-radius: 20px; border: 1px solid var(--border);
  }
  .usage-badge.warning { color: #F59E0B; border-color: #FEF3C7; background: #FFFBEB; }
  .usage-badge.unlimited { color: var(--accent-green); border-color: #D1FAE5; background: #ECFDF5; }

  .insight-panel { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border-top: 1px solid #E5E8EB; margin-top: 14px; }
  .insight-panel.two-col { grid-template-columns: 1fr 1fr; }
  .insight-col { padding: 14px 16px; border-right: 1px solid #E5E8EB; }
  .insight-col:last-child { border-right: none; }
  .insight-col-title { font-size: 12px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.2px; }
  .insight-col-title.up { color: #D32F2F; }
  .insight-col-title.down { color: #1565C0; }
  .insight-col-title.comment { color: #5D4037; }
  .insight-col-text { font-size: 13px; color: var(--text-primary); line-height: 1.65; font-weight: 500; }
  @media (max-width: 768px) { .insight-panel { grid-template-columns: 1fr; } .insight-col { border-right: none; border-bottom: 1px solid #E5E8EB; } .insight-col:last-child { border-bottom: none; } }

  /* ── Briefing Page ── */
  .briefing-hero { text-align: center; padding: 40px 20px 32px; }
  .briefing-hero h2 { font-size: 28px; font-weight: 800; letter-spacing: -0.8px; margin-bottom: 8px; }
  .briefing-hero p { font-size: 15px; color: var(--text-secondary); line-height: 1.6; }

  .subscribe-box {
    max-width: 480px; margin: 0 auto 40px; padding: 28px; background: var(--bg-card);
    border: 1px solid var(--border); border-radius: var(--radius-lg); text-align: center;
  }
  .subscribe-box h3 { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
  .subscribe-box p { font-size: 13px; color: var(--text-tertiary); margin-bottom: 16px; }
  .subscribe-form { display: flex; gap: 8px; }
  .subscribe-input {
    flex: 1; padding: 12px 16px; border: 1.5px solid var(--border); border-radius: 10px;
    font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.15s;
  }
  .subscribe-input:focus { border-color: var(--accent-blue); box-shadow: 0 0 0 3px rgba(49,130,246,0.12); }
  .subscribe-btn {
    padding: 12px 24px; border: none; border-radius: 10px; background: #5D4037; color: white;
    font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; white-space: nowrap;
    transition: background 0.15s;
  }
  .subscribe-btn:hover { background: #4E342E; }
  .subscribe-btn:disabled { background: #aaa; cursor: not-allowed; }
  .subscribe-msg { font-size: 13px; margin-top: 10px; font-weight: 600; }
  .subscribe-msg.success { color: var(--accent-green); }
  .subscribe-msg.error { color: var(--accent-red); }

  .briefing-tabs { display: flex; gap: 8px; margin-bottom: 24px; }
  .briefing-tab {
    padding: 8px 18px; border-radius: 20px; font-size: 13px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border); background: white;
    color: var(--text-secondary); font-family: inherit; transition: all 0.15s;
  }
  .briefing-tab.active { background: #5D4037; color: white; border-color: #5D4037; }
  .briefing-tab:hover:not(.active) { background: var(--bg-hover); }

  .newsletter-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  @media (max-width: 768px) { .newsletter-grid { grid-template-columns: 1fr; } }
  .newsletter-card {
    background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
    overflow: hidden; cursor: pointer; transition: all 0.2s ease;
  }
  .newsletter-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
  .newsletter-thumb {
    width: 100%; height: 200px; object-fit: cover; display: block;
    background: linear-gradient(135deg, #f5f0eb 0%, #e8ddd4 100%);
  }
  .newsletter-thumb-placeholder {
    width: 100%; height: 200px; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #f5f0eb 0%, #e8ddd4 100%); font-size: 48px;
  }
  .newsletter-body { padding: 16px 18px; }
  .newsletter-date { font-size: 12px; color: var(--text-tertiary); font-weight: 500; margin-bottom: 6px; }
  .newsletter-title { font-size: 15px; font-weight: 700; color: var(--text-primary); line-height: 1.4; margin-bottom: 8px; letter-spacing: -0.3px; }
  .newsletter-preview { font-size: 13px; color: var(--text-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  .newsletter-detail { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 0; overflow: hidden; }
  .newsletter-detail-back {
    display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600;
    color: var(--text-secondary); cursor: pointer; margin-bottom: 20px; padding: 6px 12px;
    border-radius: 8px; border: none; background: var(--bg-primary); font-family: inherit;
    transition: background 0.15s;
  }
  .newsletter-detail-back:hover { background: var(--border); }

  /* ── 호두레터 이메일 양식 디테일 ── */
  .nl-header { background: #5D4037; color: white; padding: 28px 32px; text-align: center; }
  .nl-header-logo { font-size: 28px; margin-bottom: 6px; }
  .nl-header-title { font-size: 20px; font-weight: 800; letter-spacing: -0.4px; margin-bottom: 4px; }
  .nl-header-date { font-size: 13px; opacity: 0.8; font-weight: 500; }
  .nl-body { padding: 28px 32px; }
  @media (max-width: 768px) { .nl-body { padding: 20px 16px; } .nl-header { padding: 24px 16px; } }

  .nl-section { margin-bottom: 28px; }
  .nl-section-title { font-size: 16px; font-weight: 800; color: #5D4037; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; letter-spacing: -0.3px; }
  .nl-section-title::after { content: ''; flex: 1; height: 1px; background: #E8DDD4; }

  /* 지수 현황 테이블 */
  .nl-index-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
  .nl-index-table th { background: #f1f3f5; padding: 10px 12px; font-weight: 700; font-size: 12px; text-align: center; border: 1px solid #E5E8EB; color: var(--text-secondary); }
  .nl-index-table td { padding: 10px 12px; text-align: center; border: 1px solid #E5E8EB; font-weight: 600; font-variant-numeric: tabular-nums; }
  .nl-index-table td:first-child { text-align: left; font-weight: 700; color: var(--text-primary); background: #FAFBFC; }
  .nl-index-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }

  /* 히트맵 */
  .nl-heatmap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .nl-index-side { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 768px) { .nl-heatmap-grid { grid-template-columns: 1fr; } .nl-index-side { grid-template-columns: 1fr; } }
  .nl-heatmap-item { border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
  .nl-heatmap-item img { width: 100%; display: block; }
  .nl-heatmap-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); padding: 8px 12px; background: #f8f9fa; text-align: center; }

  /* 인사이트 */
  .nl-insight-box { padding: 18px 22px; background: #FFF8F0; border-left: 4px solid #A67B5B; border-radius: 0 8px 8px 0; font-size: 15px; line-height: 1.8; color: #5D4037; font-weight: 500; }

  /* 만화 */
  .nl-comic { text-align: center; }
  .nl-comic img { max-width: 100%; border-radius: 12px; border: 1px solid var(--border); }

  /* 뉴스 아이템 */
  .nl-news-item { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #F2F3F5; }
  .nl-news-item:last-child { border-bottom: none; padding-bottom: 0; }
  .nl-news-num { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: #A67B5B; color: white; font-size: 13px; font-weight: 800; margin-right: 10px; flex-shrink: 0; vertical-align: middle; }
  .nl-news-title { font-size: 16px; font-weight: 700; color: var(--text-primary); line-height: 1.5; margin-bottom: 10px; display: inline; }
  .nl-news-summary { font-size: 14px; line-height: 1.75; color: var(--text-secondary); margin-bottom: 10px; }
  .nl-news-interp { padding: 14px 18px; background: #FFF8F0; border-left: 3px solid #A67B5B; border-radius: 0 6px 6px 0; font-size: 13px; line-height: 1.7; color: #6b4c2a; margin-bottom: 10px; }
  .nl-news-link { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #A67B5B; font-weight: 700; text-decoration: none; padding: 6px 14px; border: 1px solid #D7C4B0; border-radius: 6px; transition: all 0.15s; }
  .nl-news-link:hover { background: #FFF8F0; border-color: #A67B5B; }

  /* 관전 포인트 */
  .nl-watchpoint { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 14px; line-height: 1.7; color: var(--text-primary); }
  .nl-watchpoint:last-child { margin-bottom: 0; }
  .nl-watchpoint-icon { flex-shrink: 0; font-size: 16px; margin-top: 2px; }

  /* ── Enhanced Editor ── */
  .editor-section { background: #FAFBFC; border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .editor-section-title { font-size: 14px; font-weight: 700; color: #5D4037; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
  .editor-section-title .es-num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #A67B5B; color: white; font-size: 11px; font-weight: 800; }
  .editor-news-item { background: white; border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 10px; }
  .editor-news-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .editor-news-num { font-size: 13px; font-weight: 700; color: #A67B5B; }
  .editor-remove-btn { background: none; border: none; color: var(--accent-red); font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px; }
  .editor-remove-btn:hover { background: var(--accent-red-light); }
  .editor-add-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px; border: 2px dashed var(--border); border-radius: 10px; background: none; font-size: 13px; font-weight: 600; color: var(--text-tertiary); cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .editor-add-btn:hover { border-color: #A67B5B; color: #A67B5B; background: #FFF8F0; }
  .editor-watchpoint-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
  .editor-watchpoint-row input { flex: 1; }
  .editor-image-slot { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px; border: 2px dashed var(--border); border-radius: 10px; cursor: pointer; transition: all 0.15s; text-align: center; }
  .editor-image-slot:hover { border-color: #A67B5B; background: #FFF8F0; }
  .editor-image-slot img { max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 8px; }
  .editor-index-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  @media (max-width: 768px) { .editor-index-grid { grid-template-columns: 1fr 1fr; } }
  .editor-index-item { display: flex; flex-direction: column; gap: 4px; }
  .editor-index-item label { font-size: 11px; font-weight: 600; color: var(--text-tertiary); }
  .editor-index-item input { padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-family: inherit; outline: none; }
  .editor-index-item input:focus { border-color: var(--accent-blue); }

  .newsletter-detail-date { font-size: 13px; color: var(--text-tertiary); margin-bottom: 8px; }
  .newsletter-detail-title { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 20px; }
  .newsletter-detail-insight { padding: 16px 20px; background: #FFF8F0; border-left: 3px solid #A67B5B; border-radius: 6px; margin-bottom: 24px; font-size: 14px; line-height: 1.7; color: #5D4037; }
  .newsletter-article { margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #F2F3F5; }
  .newsletter-article:last-child { border-bottom: none; }
  .newsletter-article h4 { font-size: 16px; font-weight: 700; margin-bottom: 10px; color: var(--text-primary); }
  .newsletter-article p { font-size: 14px; line-height: 1.7; color: var(--text-secondary); margin-bottom: 8px; }
  .newsletter-article .interp { padding: 12px 16px; background: #FFF8F0; border-left: 3px solid #A67B5B; border-radius: 4px; font-size: 13px; line-height: 1.6; color: #6b4c2a; }

  /* ── Auth ── */
  .auth-trigger {
    display: flex; align-items: center; gap: 8px; padding: 10px 12px; margin: 0 12px 8px;
    border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 600;
    color: var(--text-secondary); transition: all 0.15s; border: none; background: none;
    font-family: inherit; width: calc(100% - 24px);
  }
  .auth-trigger:hover { background: var(--bg-hover); color: var(--text-primary); }
  .auth-user {
    display: flex; align-items: center; gap: 8px; padding: 10px 12px; margin: 0 12px 8px;
    border-radius: var(--radius-sm); font-size: 13px; background: var(--accent-blue-light);
    color: var(--accent-blue); font-weight: 600;
  }
  .auth-user-email { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .auth-logout {
    background: none; border: none; color: var(--text-tertiary); font-size: 11px;
    cursor: pointer; font-family: inherit; font-weight: 600; padding: 2px 6px;
    border-radius: 4px; transition: all 0.15s;
  }
  .auth-logout:hover { color: var(--accent-red); background: var(--accent-red-light); }
  .auth-modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
    z-index: 310; display: flex; align-items: center; justify-content: center;
  }
  .auth-modal {
    background: white; border-radius: 20px; padding: 36px 32px; max-width: 380px; width: 90%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  }
  .auth-modal h3 { font-size: 20px; font-weight: 800; text-align: center; margin-bottom: 4px; letter-spacing: -0.4px; }
  .auth-modal .auth-sub { font-size: 13px; color: var(--text-tertiary); text-align: center; margin-bottom: 20px; }
  .auth-modal .auth-field { margin-bottom: 12px; }
  .auth-modal .auth-field label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; }
  .auth-modal .auth-field input {
    width: 100%; padding: 11px 14px; border: 1.5px solid var(--border); border-radius: 10px;
    font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .auth-modal .auth-field input:focus { border-color: var(--accent-blue); box-shadow: 0 0 0 3px rgba(49,130,246,0.12); }
  .auth-modal .auth-submit {
    width: 100%; padding: 12px; margin-top: 8px; border: none; border-radius: 10px;
    background: #5D4037; color: white; font-size: 15px; font-weight: 700;
    cursor: pointer; font-family: inherit; transition: background 0.15s;
  }
  .auth-modal .auth-submit:hover { background: #4E342E; }
  .auth-modal .auth-toggle { text-align: center; margin-top: 16px; font-size: 13px; color: var(--text-tertiary); }
  .auth-modal .auth-toggle button { background: none; border: none; color: var(--accent-blue); font-weight: 600; cursor: pointer; font-family: inherit; font-size: 13px; }
  .auth-modal .auth-error { font-size: 12px; color: var(--accent-red); margin-top: 8px; text-align: center; font-weight: 600; }
  .auth-modal .auth-close { position: absolute; top: 14px; right: 14px; background: none; border: none; font-size: 18px; color: var(--text-tertiary); cursor: pointer; }

  /* ── Post Editor ── */
  .post-editor { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 28px; margin-bottom: 24px; }
  .post-editor h3 { font-size: 18px; font-weight: 700; margin-bottom: 16px; }
  .post-field { margin-bottom: 14px; }
  .post-field label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 5px; }
  .post-field input, .post-field textarea {
    width: 100%; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: 10px;
    font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.15s; box-sizing: border-box;
  }
  .post-field input:focus, .post-field textarea:focus { border-color: var(--accent-blue); box-shadow: 0 0 0 3px rgba(49,130,246,0.12); }
  .post-field textarea { min-height: 120px; resize: vertical; line-height: 1.6; }
  .post-image-upload {
    display: flex; align-items: center; gap: 12px; padding: 16px; border: 2px dashed var(--border);
    border-radius: 10px; cursor: pointer; transition: all 0.15s;
  }
  .post-image-upload:hover { border-color: var(--accent-blue); background: var(--accent-blue-light); }
  .post-image-preview { width: 100%; max-height: 300px; object-fit: cover; border-radius: 10px; margin-top: 8px; border: 1px solid var(--border); }
  .post-actions { display: flex; gap: 8px; margin-top: 16px; }
  .post-btn {
    padding: 10px 20px; border: none; border-radius: 10px; font-size: 14px; font-weight: 700;
    cursor: pointer; font-family: inherit; transition: all 0.15s;
  }
  .post-btn.primary { background: #5D4037; color: white; }
  .post-btn.primary:hover { background: #4E342E; }
  .post-btn.secondary { background: var(--bg-primary); color: var(--text-secondary); border: 1px solid var(--border); }
  .post-btn.danger { background: var(--accent-red-light); color: var(--accent-red); }
  .post-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .admin-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #5D4037; background: #EFEBE9; padding: 3px 8px; border-radius: 4px; }
`;

// ─── Format Helpers ──────────────────────────────────────────────
function fmt(val, type = "number") {
  if (val === null || val === undefined || val === "-") return "-";
  if (type === "pct") return `${(val * 100).toFixed(1)}%`;
  if (type === "money") {
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toLocaleString()}`;
  }
  return typeof val === "number" ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val;
}

// ─── Korean Company Descriptions (no API cost) ──────────────────
const COMPANY_DESC_KR = {
  AAPL: "아이폰, 맥, 아이패드 등을 만드는 세계 최대 소비자 전자기기 기업. 하드웨어와 서비스 생태계를 기반으로 한 강력한 브랜드 충성도를 보유하고 있습니다.",
  MSFT: "윈도우, 오피스 365, Azure 클라우드를 운영하는 글로벌 소프트웨어 기업. AI 인프라와 엔터프라이즈 솔루션에 대규모 투자를 진행하고 있습니다.",
  GOOG: "구글 검색, 유튜브, 안드로이드 운영체제를 보유한 알파벳의 티커. 전 세계 디지털 광고 시장을 선도하며, AI와 클라우드 사업을 확장 중입니다.",
  GOOGL: "구글 검색, 유튜브, 안드로이드 운영체제를 보유한 알파벳의 Class A 주식. 전 세계 디지털 광고 시장을 선도하며, AI와 클라우드 사업을 확장 중입니다.",
  AMZN: "세계 최대 이커머스 플랫폼이자 AWS 클라우드의 선두 주자. 물류 네트워크와 프라임 구독 서비스로 소비자 생태계를 구축하고 있습니다.",
  NVDA: "GPU와 AI 가속기 칩을 설계하는 반도체 기업. 데이터센터, 자율주행, 생성형 AI 시장에서 압도적인 점유율을 확보하고 있습니다.",
  META: "페이스북, 인스타그램, 왓츠앱을 운영하는 소셜 미디어 기업. 메타버스와 AI 기반 광고 기술에 집중 투자하고 있습니다.",
  TSLA: "전기차와 에너지 저장 시스템을 생산하는 기업. 자율주행 기술과 로보택시 사업을 통해 모빌리티 혁신을 추구하고 있습니다.",
  BRK: "워렌 버핏이 이끄는 세계 최대 투자 지주회사. 보험, 에너지, 철도 등 다양한 산업에 걸쳐 자회사를 보유하고 있습니다.",
  "BRK-B": "워렌 버핏이 이끄는 버크셔 해서웨이의 Class B 주식. 보험, 에너지, 철도 등 다양한 자회사를 보유한 투자 지주회사입니다.",
  "BRK-A": "워렌 버핏이 이끄는 버크셔 해서웨이의 Class A 주식. 세계 최대 투자 지주회사로, 다양한 산업에 걸쳐 투자하고 있습니다.",
  LLY: "당뇨병·비만 치료제 분야에서 글로벌 1위를 달리는 제약 기업. GLP-1 계열 신약으로 폭발적 성장을 기록하고 있습니다.",
  JPM: "미국 최대 상업·투자은행. 글로벌 금융 서비스 전반에서 시장 지배력을 갖추고 있습니다.",
  V: "전 세계 전자결제 네트워크를 운영하는 핀테크 대장주. 카드 결제 거래 처리에서 독보적인 위치를 차지하고 있습니다.",
  MA: "비자와 함께 글로벌 결제 인프라를 양분하는 기업. 전 세계 210개국 이상에서 결제 네트워크를 운영합니다.",
  WMT: "세계 최대 오프라인 유통 기업. 미국 내 5,000개 이상의 매장과 이커머스 사업을 함께 운영합니다.",
  UNH: "미국 최대 건강보험사이자 헬스케어 서비스 기업. 보험과 데이터 분석을 결합한 통합 헬스케어 모델을 구축하고 있습니다.",
  XOM: "세계 최대 석유·가스 상장기업. 업스트림부터 다운스트림까지 에너지 밸류체인 전반을 커버합니다.",
  HD: "미국 1위 홈 인테리어 소매 체인. 주택 리모델링과 건축 자재 시장에서 강력한 입지를 보유하고 있습니다.",
  COST: "회원제 창고형 매장을 운영하는 대형 유통 기업. 저마진·고회전 전략으로 높은 고객 충성도를 유지합니다.",
  PG: "세계 최대 생활용품 기업. 질레트, 팸퍼스, 다우니 등 소비재 브랜드 포트폴리오를 보유하고 있습니다.",
  JNJ: "제약, 의료기기, 소비자 건강 부문을 아우르는 헬스케어 대기업. 안정적인 배당으로 유명합니다.",
  ABBV: "면역학, 종양학 분야에 강점을 가진 글로벌 바이오 제약사. 휴미라 이후 차세대 파이프라인 전환에 집중하고 있습니다.",
  CRM: "기업용 클라우드 CRM 플랫폼의 글로벌 1위. 영업, 마케팅, 고객 서비스 자동화 솔루션을 제공합니다.",
  ORCL: "기업용 데이터베이스와 클라우드 인프라를 제공하는 IT 기업. AI 클라우드 수요 급증으로 데이터센터 사업이 빠르게 성장하고 있습니다.",
  AMD: "CPU와 GPU를 설계하는 반도체 기업. 서버용 EPYC 프로세서와 AI 가속기로 데이터센터 시장 점유율을 확대하고 있습니다.",
  NFLX: "전 세계 2억 명 이상의 가입자를 보유한 스트리밍 플랫폼. 오리지널 콘텐츠 제작과 광고 모델로 수익 다각화를 추진하고 있습니다.",
  INTC: "세계 최대 반도체 제조사 중 하나. 파운드리 사업 확대와 차세대 공정 기술 개발에 주력하고 있습니다.",
  DIS: "디즈니+, 마블, 픽사, 테마파크를 운영하는 글로벌 엔터테인먼트 기업. IP 기반 콘텐츠와 체험 사업의 시너지를 추구합니다.",
  BA: "세계 양대 항공기 제조사 중 하나. 민간 항공기와 방위산업 부문에서 사업을 영위하고 있습니다.",
  AVGO: "데이터센터, 네트워킹, 브로드밴드용 반도체를 설계하는 기업. VMware 인수로 소프트웨어 사업을 대폭 확대했습니다.",
  PLTR: "정부와 기업을 위한 빅데이터 분석 플랫폼을 제공하는 AI 기업. 국방·정보기관 및 상업 고객에게 데이터 통합 솔루션을 제공합니다.",
  TSM: "세계 최대 반도체 위탁 생산(파운드리) 기업. 애플, 엔비디아 등 주요 팹리스 기업의 최첨단 칩을 생산합니다.",
  ASML: "반도체 노광 장비(EUV) 분야 세계 유일의 공급사. 차세대 반도체 미세공정에 필수적인 장비를 독점 공급합니다.",
  COIN: "미국 최대 암호화폐 거래소. 비트코인, 이더리움 등 디지털 자산 거래 인프라와 커스터디 서비스를 제공합니다.",
  MSTR: "비트코인을 대규모로 보유한 소프트웨어 기업. 기업 분석 솔루션과 함께 비트코인 투자 전략으로 유명합니다.",
  SNOW: "클라우드 기반 데이터 웨어하우스 플랫폼을 제공하는 기업. 멀티 클라우드 환경에서 데이터 공유와 분석을 지원합니다.",
  SQ: "Block(구 Square)의 티커. 소상공인 결제 솔루션과 Cash App 개인 금융 서비스를 운영합니다.",
  SHOP: "이커머스 스토어 구축 플랫폼의 글로벌 리더. 중소 판매자부터 대기업까지 온라인 상점 인프라를 제공합니다.",
  UBER: "글로벌 1위 모빌리티·배달 플랫폼. 70개국 이상에서 라이드 셰어링과 음식 배달 서비스를 운영합니다.",
  NKE: "세계 최대 스포츠 브랜드. 운동화, 의류, 장비 분야에서 강력한 글로벌 브랜드 파워를 보유하고 있습니다.",
  SBUX: "전 세계 3만 5천 개 이상의 매장을 운영하는 커피 체인. 프리미엄 커피 문화를 대중화한 글로벌 식음료 기업입니다.",
  BABA: "중국 최대 이커머스·클라우드 기업 알리바바. 타오바오, 알리클라우드 등 중국 디지털 경제의 핵심 인프라를 운영합니다.",
  PDD: "테무(Temu)의 모기업인 중국 이커머스 기업. 초저가 전략으로 글로벌 시장에서 빠르게 성장하고 있습니다.",
  BIDU: "중국 최대 검색엔진 바이두. AI, 자율주행(아폴로), 클라우드 사업에 집중 투자하고 있습니다.",
  ARM: "스마트폰·IoT용 프로세서 아키텍처를 설계하는 영국 반도체 기업. 전 세계 모바일 칩의 대다수가 ARM 기반입니다.",
  SMCI: "AI 서버와 데이터센터 인프라를 제조하는 기업. GPU 서버 수요 급증으로 매출이 폭발적으로 성장하고 있습니다.",
  PANW: "클라우드·네트워크 보안 분야 글로벌 리더. AI 기반 통합 사이버보안 플랫폼을 제공합니다.",
  CRWD: "클라우드 기반 엔드포인트 보안 기업. 팔콘 플랫폼으로 실시간 위협 탐지 및 대응 서비스를 제공합니다.",
  MU: "DRAM, NAND 플래시 메모리를 제조하는 반도체 기업. AI와 데이터센터용 HBM 메모리 수요 확대의 수혜를 받고 있습니다.",
  QCOM: "모바일 통신용 칩(스냅드래곤)을 설계하는 반도체 기업. 5G, 자동차, IoT 분야로 사업을 확장하고 있습니다.",
  ADBE: "포토샵, 일러스트레이터 등 크리에이티브 소프트웨어의 글로벌 표준. AI 기능을 적극 통합한 구독형 SaaS 모델을 운영합니다.",
  NOW: "IT 서비스 관리(ITSM) 플랫폼의 글로벌 1위. 기업의 디지털 워크플로우 자동화를 지원합니다.",
  IBM: "기업용 클라우드, AI(왓슨X), 컨설팅 서비스를 제공하는 IT 대기업. 하이브리드 클라우드 전략에 집중하고 있습니다.",
  GS: "글로벌 투자은행 및 자산운용사. M&A 자문, 트레이딩, 자산관리 분야에서 월스트리트를 대표합니다.",
  MS: "투자은행, 자산운용, 웰스매니지먼트를 영위하는 글로벌 금융 그룹. 모건스탠리 캐피털 인터내셔널(MSCI)의 모체입니다.",
  BAC: "미국 2위 상업은행. 소비자 금융부터 기업 금융까지 종합 금융 서비스를 제공합니다.",
  KO: "코카콜라를 중심으로 200개 이상의 음료 브랜드를 보유한 세계 최대 음료 기업.",
  PEP: "펩시콜라와 프리토레이 스낵 브랜드를 보유한 글로벌 식음료 기업. 음료와 스낵의 균형 잡힌 포트폴리오가 강점입니다.",
  MCD: "전 세계 100개국 이상에서 4만 개 매장을 운영하는 글로벌 패스트푸드 체인.",
  CVX: "글로벌 에너지 메이저 기업. 석유·가스 탐사부터 정제, 화학까지 에너지 밸류체인을 통합 운영합니다.",
  LMT: "세계 최대 방위산업 기업. F-35 전투기를 비롯한 군사 장비와 우주 시스템을 개발합니다.",
  RTX: "레이시온 테크놀로지스. 미사일 시스템, 항공 엔진, 방위 전자장비를 제조하는 방산 기업입니다.",
  CAT: "건설·광산 장비 분야 세계 최대 기업. 인프라 투자 확대와 함께 안정적인 수요를 확보하고 있습니다.",
  DE: "존디어(John Deere). 농기계와 건설장비 분야의 글로벌 리더로 정밀 농업 기술을 선도하고 있습니다.",
  UPS: "세계 최대 택배·물류 기업 중 하나. 전자상거래 성장에 따른 배송 수요 확대의 수혜를 받습니다.",
  FDX: "페덱스. 글로벌 특송·물류 서비스를 제공하며, B2B 물류와 이커머스 배송에 강점이 있습니다.",
  T: "AT&T. 미국 대표 통신사로, 5G 네트워크와 광대역 인터넷 서비스를 제공합니다.",
  VZ: "버라이즌. 미국 최대 무선 통신사. 5G 인프라 구축과 기업용 솔루션에 투자하고 있습니다.",
  PYPL: "온라인 결제 플랫폼의 선구자. 벤모(Venmo)를 포함한 디지털 결제 생태계를 운영합니다.",
  "005930.KS": "삼성전자. 메모리 반도체, 스마트폰, 디스플레이 분야의 글로벌 리더. 파운드리와 AI 반도체 사업을 확대하고 있습니다.",
  "000660.KS": "SK하이닉스. DRAM과 NAND 메모리 세계 2위 기업. HBM 메모리 시장에서 선두를 달리고 있습니다.",
};

// ─── Market Cap Rank Lookup (global top companies) ──────────────
const MARKET_CAP_RANKS = {
  AAPL: 1, MSFT: 2, NVDA: 3, GOOG: 4, GOOGL: 4, AMZN: 5,
  META: 6, "BRK-B": 7, "BRK-A": 7, TSM: 8, AVGO: 9, LLY: 10,
  WMT: 11, JPM: 12, V: 13, TSLA: 14, MA: 15, UNH: 16,
  XOM: 17, COST: 18, ORCL: 19, HD: 20, PG: 21, JNJ: 22,
  ABBV: 23, NFLX: 24, CRM: 25, BAC: 26, KO: 27, AMD: 28,
  PLTR: 29, SAP: 30,
};

function getKrDescription(ticker, fallbackDesc) {
  const key = ticker?.toUpperCase();
  if (COMPANY_DESC_KR[key]) return COMPANY_DESC_KR[key];
  return fallbackDesc || null;
}

function getCapRankLabel(ticker, marketCap) {
  const key = ticker?.toUpperCase();
  if (MARKET_CAP_RANKS[key]) return `글로벌 ${MARKET_CAP_RANKS[key]}위`;
  if (marketCap >= 200e9) return "Mega Cap";
  if (marketCap >= 10e9) return "Large Cap";
  if (marketCap >= 2e9) return "Mid Cap";
  if (marketCap >= 300e6) return "Small Cap";
  return "Small Cap";
}

// ─── Insight Panel (below chart in expanded metrics) ─────────────
function InsightPanel({ metricKey }) {
  const insight = METRIC_INSIGHTS[metricKey];
  if (!insight) return null;
  const hasComment = insight.comment && insight.comment.length > 0;
  return (
    <div className={`insight-panel ${hasComment ? "" : "two-col"}`}>
      <div className="insight-col">
        <div className="insight-col-title up">▲ 증가 시 의미</div>
        <div className="insight-col-text">{insight.up}</div>
      </div>
      <div className="insight-col">
        <div className="insight-col-title down">▼ 감소 시 의미</div>
        <div className="insight-col-text">{insight.down}</div>
      </div>
      {hasComment && (
        <div className="insight-col">
          <div className="insight-col-title comment">🥜 호두머니 코멘트</div>
          <div className="insight-col-text">{insight.comment}</div>
        </div>
      )}
    </div>
  );
}

function SearchBox({ onSelect, large }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 1) { setResults([]); setIsOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setIsOpen(true);
      setHighlightIdx(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    // Debounce search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val.trim()), 250);
  };

  const handleSelect = (item) => {
    const ticker = (item.s || "").toUpperCase();
    setQuery(ticker);
    setIsOpen(false);
    setResults([]);
    if (ticker && onSelect) onSelect(ticker);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && results[highlightIdx]) {
        handleSelect(results[highlightIdx]);
      } else if (query.trim()) {
        // Direct ticker entry — check if it looks like a ticker
        const raw = query.trim().toUpperCase();
        if (/^[A-Z.\-]{1,10}$/.test(raw)) {
          setIsOpen(false);
          if (onSelect) onSelect(raw);
        } else if (results.length > 0) {
          handleSelect(results[0]);
        } else {
          // Force search then select first result
          doSearch(raw).then(() => {
            // Will be handled in next render
          });
          if (onSelect) onSelect(raw);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="search-wrapper" ref={wrapperRef} style={large ? { width: "100%", maxWidth: 520 } : {}}>
      <div className="search-box" style={large ? { padding: "14px 20px", borderRadius: 14, border: "2px solid var(--border)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", background: "white" } : {}}>
        <span className="search-icon" style={large ? { fontSize: 20 } : {}}>🔍</span>
        <input
          type="text"
          placeholder="티커 또는 기업명 검색 (예: NVDA, Apple)"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          style={large ? { fontSize: 16, fontWeight: 500 } : {}}
        />
        {query && (
          <button className="search-clear-btn" onClick={handleClear} type="button">✕</button>
        )}
      </div>

      {isOpen && (
        <div className="search-dropdown">
          {loading && <div className="search-dropdown-loading">검색 중...</div>}
          {!loading && results.length === 0 && query.length > 0 && (
            <div className="search-dropdown-empty">
              검색 결과가 없습니다. 티커를 직접 입력 후 Enter를 눌러보세요.
            </div>
          )}
          {!loading && results.map((item, idx) => (
            <div
              key={item.s || idx}
              className={`search-dropdown-item ${idx === highlightIdx ? "highlighted" : ""}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setHighlightIdx(idx)}
            >
              <span className="search-dropdown-symbol">{item.s}</span>
              <span className="search-dropdown-name">{item.n}</span>
              {item.t && <span className="search-dropdown-type">{item.t}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sentiment Gauge Visual ──────────────────────────────────────
function SentimentGaugeVisual({ value, reversed }) {
  const rotation = -90 + (value / 100) * 180;
  const gradBg = reversed
    ? "linear-gradient(to right, #03B26C, #F59E0B, #F04452)"
    : "linear-gradient(to right, #F04452, #F59E0B, #03B26C)";
  return (
    <div className="sentiment-gauge">
      <div className="sentiment-gauge-bg" style={{ background: gradBg, opacity: 0.15 }} />
      <div className="sentiment-gauge-needle" style={{ transform: `rotate(${rotation}deg)` }} />
      <div className="sentiment-gauge-center" />
    </div>
  );
}

// ─── Inline Chart Panel ──────────────────────────────────────────

// ─── Inline Chart Panel (period-aware) ───────────────────────────
function InlineChart({ item, onClose }) {
  const [period, setPeriod] = useState("1D");
  const [chartData, setChartData] = useState(item?.history || []);
  const [chartLoading, setChartLoading] = useState(false);
  const originalChange = { change: item?.change || "-", pct: item?.pct || "-", up: item?.up || false };
  const [periodChange, setPeriodChange] = useState(originalChange);

  useEffect(() => {
    if (!item?.yahooSymbol) {
      setChartData(item?.history || []);
      return;
    }
    const rangeMap = { "1D": "1d", "1W": "5d", "1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y", "5Y": "5y", "10Y": "10y", "MAX": "max" };
    const range = rangeMap[period] || "1y";
    const mult = item.chartMult || 1;

    setChartLoading(true);
    fetch(`/api/market/chart?symbol=${encodeURIComponent(item.yahooSymbol)}&range=${range}`)
      .then(r => r.json())
      .then(d => {
        if (d.points && d.points.length > 0) {
          const pts = d.points.map(p => ({ label: p.label, value: Math.round(p.value * mult * 100) / 100 }));
          setChartData(pts);
          // For 1D, always use the card's original change/pct to stay consistent
          if (period === "1D") {
            setPeriodChange(originalChange);
          } else {
            const first = pts[0].value;
            const last = pts[pts.length - 1].value;
            const chg = last - first;
            const pctVal = first !== 0 ? (chg / first) * 100 : 0;
            const up = chg >= 0;
            setPeriodChange({
              change: `${up ? "+" : ""}${Math.abs(chg) >= 100 ? Math.round(chg).toLocaleString() : chg.toFixed(2)}`,
              pct: `${up ? "+" : ""}${pctVal.toFixed(1)}%`,
              up,
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => setChartLoading(false));
  }, [period, item?.yahooSymbol]);

  if (!item) return null;
  const data = chartData;
  const values = data.map(d => d.value);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 1;
  const padding = (max - min) * 0.1 || 1;
  const color = periodChange.up ? "#F04452" : "#3182F6";
  const gradId = `grad-${item.name.replace(/[^a-zA-Z]/g, "")}-${period}-${periodChange.up ? "u" : "d"}`;

  return (
    <div className="inline-chart-panel">
      <div className="inline-chart-header">
        <div className="inline-chart-left">
          <div>
            <div className="inline-chart-title">{item.name}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
              <span className="inline-chart-val">{item.value}</span>
              <span className="inline-chart-chg" style={{ color }}>
                {periodChange.up ? "▲" : "▼"} {periodChange.change} ({periodChange.pct})
              </span>
            </div>
          </div>
        </div>
        <button className="inline-chart-close" onClick={onClose}>✕</button>
      </div>
      <div className="inline-chart-periods">
        {["1D", "1W", "1M", "3M", "6M", "1Y", "5Y", "10Y", "MAX"].map(p => (
          <button key={p} className={`chart-period-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>{p}</button>
        ))}
      </div>
      <div className="inline-chart-body">
        {chartLoading ? (
          <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13 }}>로딩중...</div>
        ) : data.length === 0 ? (
          <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13 }}>데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F5" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8B95A1" }} interval={Math.max(0, Math.floor(data.length / 6) - 1)} />
              <YAxis domain={[min - padding, max + padding]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8B95A1" }} tickFormatter={(v) => {
                if (Math.abs(v) >= 1000) {
                  return `${(v / 1000).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}k`;
                }
                return v.toFixed(v < 10 ? 2 : 1);
              }} width={58} />
              <Tooltip contentStyle={{ background: "white", border: "1px solid #E5E8EB", borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", padding: "8px 14px", fontSize: 13, fontWeight: 600 }} formatter={(val) => [typeof val === "number" ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val, ""]} labelStyle={{ color: "#8B95A1", fontSize: 11, marginBottom: 2 }} />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 5, stroke: color, strokeWidth: 2, fill: "white" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}


// ─── Core Valuations ─────────────────────────────────────────────
function CoreValuations({ data }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const safeVal = (v) => (typeof v === "number" && isFinite(v)) ? v : 0;
  const metrics = [
    { key: "per", label: "PER", fmt: v => safeVal(v).toFixed(2), desc: "회사가 1년에 버는 돈에 비해 주가가 얼마나 비싼지" },
    { key: "pbr", label: "PBR", fmt: v => safeVal(v).toFixed(2), desc: "회사의 순자산(자본)에 비해 주가가 얼마나 비싼지" },
    { key: "eps", label: "EPS ($)", fmt: v => safeVal(v).toFixed(2), desc: "주식 한 주당 회사가 1년간 벌어들이는 이익" },
    { key: "de", label: "부채비율 (D/E)", fmt: v => `${(safeVal(v) * 100).toFixed(0)}%`, desc: "회사의 자기자본에 비해 빚이 얼마나 있는지" },
    { key: "roe", label: "ROE (%)", fmt: v => `${safeVal(v).toFixed(1)}%`, desc: "주주의 돈(자본)을 운용해 연 몇%의 이익을 냈는지" },
    { key: "div", label: "배당수익률 (%)", fmt: v => `${safeVal(v).toFixed(2)}%`, desc: "배당으로 받는 수익률" },
    { key: "ebitda", label: "EBITDA ($M)", fmt: v => `$${Math.round(safeVal(v)).toLocaleString()}M`, desc: "세금·이자·감가상각을 빼기 전 실제로 벌어들인 현금 흐름" },
  ];
  const toggle = (key) => setExpandedKey(expandedKey === key ? null : key);
  const trendLabels = data.labels && data.labels.length > 0 ? data.labels : ["Q1", "Q2", "Q3", "Q4", "Q5"];

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <div className="card-title">핵심 밸류에이션</div>
        <div className="card-description">회사의 가치를 평가하는 핵심 지표들입니다</div>
      </div>
      {metrics.map(({ key, label, fmt: fmtFn, desc }) => {
        const metric = data.coreMetrics?.[key];
        if (!metric) return null;
        const trendData = metric.trend || [0, 0, 0, 0, 0];
        const isOpen = expandedKey === key;
        const trendMin = Math.min(...trendData.map(v => safeVal(v)));
        const trendMax = Math.max(...trendData.map(v => safeVal(v)));
        const trendRange = trendMax - trendMin || 1;
        const chartData = trendData.map((v, i) => ({ label: trendLabels[i] || `Q${i+1}`, value: safeVal(v) }));

        return (
          <div className={`metric-card ${isOpen ? "expanded" : ""}`} key={key} onClick={() => toggle(key)}>
            <div className="metric-card-top">
              <div className="metric-card-left">
                <div className="metric-card-name">{label}</div>
                <div className="metric-card-value">{fmtFn(metric.value)}</div>
              </div>
              <div className="metric-card-desc">{desc}</div>
              <div className="metric-card-mini">
                {trendData.map((v, i) => (
                  <div key={i} className="m-bar" style={{ height: `${Math.max(15, 15 + ((safeVal(v) - trendMin) / trendRange) * 85)}%` }} />
                ))}
              </div>
              <span className="metric-card-arrow">▼</span>
            </div>
            {isOpen && (
              <div className="metric-card-expand" onClick={e => e.stopPropagation()}>
                <div className="metric-card-expand-body">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <defs><linearGradient id={`mg-${key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3182F6" stopOpacity={0.15} /><stop offset="100%" stopColor="#3182F6" stopOpacity={0.02} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F5" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8B95A1" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8B95A1" }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(v < 10 ? 2 : 0)} width={52} />
                      <Tooltip contentStyle={{ background: "white", border: "1px solid #E5E8EB", borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", padding: "8px 14px", fontSize: 13, fontWeight: 600 }} formatter={(val) => [typeof val === "number" ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val, label]} labelStyle={{ color: "#8B95A1", fontSize: 11 }} />
                      <Area type="monotone" dataKey="value" stroke="#3182F6" strokeWidth={2.5} fill={`url(#mg-${key})`} dot={{ r: 4, stroke: "#3182F6", strokeWidth: 2, fill: "white" }} activeDot={{ r: 6, stroke: "#3182F6", strokeWidth: 2, fill: "white" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <InsightPanel metricKey={key} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Reusable Financial Row Card ─────────────────────────────────
function FinRowCard({ label, values, labels, expanded, onToggle, fmtFn, allowNeg, desc, metricKey }) {
  const lastVal = values[values.length - 1];
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const vRange = vMax - vMin || 1;
  const chartData = values.map((v, i) => ({ label: labels[i], value: v }));
  const isNeg = allowNeg && lastVal < 0;

  return (
    <div className={`metric-card ${expanded ? "expanded" : ""}`} onClick={onToggle}>
      <div className="metric-card-top">
        <div className="metric-card-left">
          <div className="metric-card-name">{label}</div>
          <div className="metric-card-value" style={isNeg ? { color: "var(--accent-blue)" } : {}}>
            {fmtFn ? fmtFn(lastVal) : (isNeg ? `-${Math.abs(lastVal).toLocaleString()}` : lastVal.toLocaleString())}
          </div>
        </div>
        {desc && <div className="metric-card-desc">{desc}</div>}
        <div className="metric-card-mini">
          {values.map((v, i) => (
            <div key={i} className="m-bar" style={{ height: `${Math.max(15, 15 + ((v - vMin) / vRange) * 85)}%`, background: (allowNeg && v < 0) ? "#F04452" : "var(--accent-blue)" }} />
          ))}
        </div>
        <span className="metric-card-arrow">▼</span>
      </div>
      {expanded && (
        <div className="metric-card-expand" onClick={e => e.stopPropagation()}>
          <div className="metric-card-expand-body" style={{ paddingTop: 14 }}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <defs><linearGradient id={`fg-${label.replace(/[^a-zA-Z]/g,"")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3182F6" stopOpacity={0.15} /><stop offset="100%" stopColor="#3182F6" stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F5" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8B95A1" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8B95A1" }} tickFormatter={v => Math.abs(v) >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(v < 10 && v > -10 ? 2 : 0)} width={52} />
                <Tooltip contentStyle={{ background: "white", border: "1px solid #E5E8EB", borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", padding: "8px 14px", fontSize: 13, fontWeight: 600 }} formatter={(val) => [typeof val === "number" ? (fmtFn ? fmtFn(val) : val.toLocaleString()) : val, ""]} labelStyle={{ color: "#8B95A1", fontSize: 11 }} />
                <Area type="monotone" dataKey="value" stroke="#3182F6" strokeWidth={2.5} fill={`url(#fg-${label.replace(/[^a-zA-Z]/g,"")})`} dot={{ r: 4, stroke: "#3182F6", strokeWidth: 2, fill: "white" }} activeDot={{ r: 6, stroke: "#3182F6", strokeWidth: 2, fill: "white" }} />
              </AreaChart>
            </ResponsiveContainer>
            <InsightPanel metricKey={metricKey} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Financial Statements ────────────────────────────────────────
function FinancialStatements({ data }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const toggle = (key) => setExpandedKey(expandedKey === key ? null : key);
  const labels = data.income.labels;
  const sections = [
    { title: "📋 손익 계산서", subtitle: "단위: 백만 달러 ($M)", desc: "회사가 얼마나 벌고, 얼마나 남겼는지 보여주는 성적표입니다",
      rows: [
        { key: "revenue", label: "총 매출", values: data.income.revenue, desc: "회사가 물건이나 서비스를 팔아서 벌어들인 총 수입" },
        { key: "grossProfit", label: "매출 총이익", values: data.income.grossProfit, desc: "매출에서 원가를 뺀 이익" },
        { key: "opIncome", label: "영업이익", values: data.income.operatingIncome, desc: "영업활동으로 벌어들인 순이익" },
        { key: "netIncome", label: "순이익", values: data.income.netIncome, desc: "최종 이익 (모든 비용, 세금, 이자 제외 후)" },
      ] },
    { title: "🏦 재무 상태표", subtitle: "단위: 백만 달러 ($M)", desc: "회사가 가진 자산과 빚, 순자산을 보여주는 재무 건강 진단서입니다",
      rows: [
        { key: "totalAssets", label: "총 자산", values: data.balance.totalAssets, desc: "회사가 소유한 모든 자산" },
        { key: "currentLiab", label: "유동 부채", values: data.balance.currentLiab, desc: "1년 이내로 갚아야 하는 부채" },
        { key: "equity", label: "자본 총계", values: data.balance.equity, desc: "회사의 순가치 (자산-부채)" },
      ] },
    { title: "💰 현금 흐름표", subtitle: "단위: 백만 달러 ($M)", desc: "실제로 현금이 어디서 들어오고 어디로 나갔는지 추적합니다",
      rows: [
        { key: "fcf", label: "자유현금흐름", values: data.cashflow.fcf, desc: "진짜 자유롭게 쓸 수 있는 돈" },
        { key: "opCash", label: "영업활동 현금흐름", values: data.cashflow.opCash, desc: "본업으로 실제 벌어들인 현금" },
        { key: "invCash", label: "투자활동 현금흐름", values: data.cashflow.invCash, allowNeg: true, desc: "설비 투자를 위해 지출한 돈" },
        { key: "finCash", label: "재무활동 현금흐름", values: data.cashflow.finCash, allowNeg: true, desc: "대출, 주식 발행, 배당 등" },
        { key: "netChange", label: "현금 증감액", values: data.cashflow.netChange, allowNeg: true, desc: "현금의 순증가/순감소" },
      ] },
  ];

  return (
    <div className="fade-up">
      {sections.map((sec, si) => (
        <div key={si} style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <div className="card-title">{sec.title} <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, marginLeft: 8 }}>{sec.subtitle}</span></div>
            <div className="card-description">{sec.desc}</div>
          </div>
          {sec.rows.map(row => (
            <FinRowCard key={row.key} label={row.label} values={row.values} labels={labels} expanded={expandedKey === row.key} onToggle={() => toggle(row.key)} allowNeg={row.allowNeg} desc={row.desc} metricKey={row.key} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Advanced Metrics ────────────────────────────────────────────
function AdvancedMetrics({ data }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const toggle = (key) => setExpandedKey(expandedKey === key ? null : key);
  const labels = data.advanced.labels;
  const sections = [
    { title: "📐 밸류에이션 심화", desc: "기업의 적정 가치를 다각도로 평가하는 심화 지표입니다",
      rows: [
        { key: "evEbitda", label: "EV/EBITDA", values: data.advanced.evEbitda, fmt: v => `${v.toFixed(1)}x`, desc: "현금으로 이 회사를 사려면 몇 년치 이익이 필요한지" },
        { key: "pe", label: "PER", values: data.advanced.pe, fmt: v => v.toFixed(1), desc: "주가 대비 이익 비율" },
        { key: "peg", label: "PEG", values: data.advanced.peg, fmt: v => v.toFixed(2), desc: "성장률을 감안한 밸류에이션" },
      ] },
    { title: "📊 수익성", desc: "매출 대비 얼마나 효율적으로 이익을 내고 있는지",
      rows: [
        { key: "opMargin", label: "영업이익률", values: data.advanced.opMargin, fmt: v => `${(v * 100).toFixed(1)}%`, desc: "핵심 영업의 효율성" },
        { key: "netMargin", label: "순이익률", values: data.advanced.netMargin, fmt: v => `${(v * 100).toFixed(1)}%`, desc: "최종 이익 비율" },
      ] },
    { title: "👥 주주환원", desc: "자사주 매입 등 주주 가치를 높이는 활동",
      rows: [
        { key: "sharesQ", label: "발행주식수 (분기)", values: data.shares.quarterly, fmt: v => `${v.toLocaleString()}M`, desc: "시장에 유통되는 총 주식 수" },
        { key: "sharesY", label: "발행주식수 (연간)", values: data.shares.yearly, fmt: v => `${v.toLocaleString()}M`, desc: "주식 수가 줄면 주주 친화적" },
      ] },
  ];

  return (
    <div className="fade-up">
      {sections.map((sec, si) => (
        <div key={si} style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <div className="card-title">{sec.title}</div>
            <div className="card-description">{sec.desc}</div>
          </div>
          {sec.rows.map(row => (
            <FinRowCard key={row.key} label={row.label} values={row.values} labels={labels} expanded={expandedKey === row.key} onToggle={() => toggle(row.key)} fmtFn={row.fmt} desc={row.desc} metricKey={row.key} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Market Overview Page ────────────────────────────────────────

// ─── Market Overview Page (live data) ────────────────────────────
function MarketPage() {
  const [marketTab, setMarketTab] = useState("전체");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/market")
      .then(r => r.json())
      .then(d => { if (!d.error) setMarketData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const showUS = marketTab === "전체" || marketTab === "해외";
  const showKR = marketTab === "전체" || marketTab === "국내";
  const toggle = (group, item) => {
    if (selectedIndex && selectedIndex.group === group && selectedIndex.name === item.name) setSelectedIndex(null);
    else setSelectedIndex({ group, ...item });
  };
  const isSelected = (group, name) => selectedIndex && selectedIndex.group === group && selectedIndex.name === name;

  const liveIdxUS = marketData?.indicesUS || [];
  const liveIdxKR = marketData?.indicesKR || [];
  const liveEconUS = marketData?.econUS || [];
  const liveEconKR = marketData?.econKR || [];
  const liveVix = marketData?.vix || null;
  const exchangeRate = marketData?.exchangeRate || "N/A";
  const vixGauge = liveVix ? Math.min(100, Math.round((liveVix.numValue / 80) * 100)) : 33;

  return (
    <div className="content-area">
      <div className="market-tabs">
        {["전체", "국내", "해외"].map(t => (
          <button key={t} className={`market-tab ${marketTab === t ? "active" : ""}`} onClick={() => { setMarketTab(t); setSelectedIndex(null); }}>{t}</button>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <span className="exchange-badge">💱 달러 환율 {exchangeRate} 원</span>
          {loading && <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 8 }}>로딩중...</span>}
        </div>
      </div>

      <div className="section-header section-header-distinct indices fade-up"><div className="section-title">주가지수</div><div className="section-subtitle">미국/한국 대표 지수</div></div>

      {showUS && liveIdxUS.length > 0 && (
        <div className="fade-up fade-up-d1">
          <div className="country-label">미국</div>
          <div className="index-strip">
            {liveIdxUS.map((idx, i) => (
              <div className={`index-card index-card-lg clickable ${isSelected("idxUS", idx.name) ? "selected" : ""}`} key={i} onClick={() => toggle("idxUS", idx)}>
                <button className="card-chart-btn" onClick={(e) => { e.stopPropagation(); toggle("idxUS", idx); }} title="차트 보기"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,12 5.5,7 8.5,9 14,3" /><polyline points="10,3 14,3 14,7" /></svg></button>
                <div className="index-name">{idx.name}</div>
                <div className="index-value">{idx.value}</div>
                <div className={`index-change ${idx.up ? "up" : "down"}`}>{idx.up ? "▲" : "▼"} {idx.change} ({idx.pct})</div>
              </div>
            ))}
          </div>
          {selectedIndex && selectedIndex.group === "idxUS" && <InlineChart item={selectedIndex} onClose={() => setSelectedIndex(null)} />}
        </div>
      )}

      {showKR && liveIdxKR.length > 0 && (
        <div className="fade-up fade-up-d1" style={{ marginTop: showUS ? 8 : 0 }}>
          <div className="country-label">한국</div>
          <div className="index-strip index-strip-three">
            {liveIdxKR.map((idx, i) => (
              <div className={`index-card index-card-lg index-card-fixed clickable ${isSelected("idxKR", idx.name) ? "selected" : ""}`} key={i} onClick={() => toggle("idxKR", idx)}>
                <button className="card-chart-btn" onClick={(e) => { e.stopPropagation(); toggle("idxKR", idx); }} title="차트 보기"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,12 5.5,7 8.5,9 14,3" /><polyline points="10,3 14,3 14,7" /></svg></button>
                <div className="index-name">{idx.name}</div>
                <div className="index-value">{idx.value}</div>
                <div className={`index-change ${idx.up ? "up" : "down"}`}>{idx.up ? "▲" : "▼"} {idx.change} ({idx.pct})</div>
              </div>
            ))}
          </div>
          {selectedIndex && selectedIndex.group === "idxKR" && <InlineChart item={selectedIndex} onClose={() => setSelectedIndex(null)} />}
        </div>
      )}

      <div className="section-header section-header-distinct econ fade-up fade-up-d2" style={{ marginTop: 20 }}>
        <div><div className="section-title">경제 지표</div><div className="section-subtitle">기준금리·채권·환율 중심 지표</div></div>
      </div>

      {showUS && liveEconUS.length > 0 && (
        <div className="fade-up fade-up-d2">
          <div className="country-label">미국</div>
          <div className="econ-grid">
            {liveEconUS.map((ind, i) => (
              <div className={`econ-card ${ind.isStatic ? "" : "clickable"} ${isSelected("econUS", ind.name) ? "selected" : ""}`} key={i} onClick={() => { if (!ind.isStatic) toggle("econUS", ind); }}>
                {!ind.isStatic && <button className="card-chart-btn" onClick={(e) => { e.stopPropagation(); toggle("econUS", ind); }} title="차트 보기"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,12 5.5,7 8.5,9 14,3" /><polyline points="10,3 14,3 14,7" /></svg></button>}
                <div className="econ-name">{ind.name}</div>
                <div className="econ-value">{ind.value}</div>
                {ind.change && !ind.isStatic && <div className={`econ-change ${ind.up ? "up" : "down"}`}>{ind.up ? "▲" : "▼"} {ind.change}{ind.pct ? ` (${ind.pct})` : ""}</div>}
                {ind.status && <span className="econ-status" style={{ color: ind.statusColor || "var(--text-tertiary)" }}>{ind.status}</span>}
              </div>
            ))}
          </div>
          {selectedIndex && selectedIndex.group === "econUS" && <InlineChart item={selectedIndex} onClose={() => setSelectedIndex(null)} />}
        </div>
      )}

      {showKR && liveEconKR.length > 0 && (
        <div className="fade-up fade-up-d3" style={{ marginTop: showUS ? 4 : 0 }}>
          <div className="country-label">한국</div>
          <div className="econ-grid">
            {liveEconKR.map((ind, i) => (
              <div className={`econ-card ${ind.isStatic ? "" : "clickable"} ${isSelected("econKR", ind.name) ? "selected" : ""}`} key={i} onClick={() => { if (!ind.isStatic) toggle("econKR", ind); }}>
                {!ind.isStatic && <button className="card-chart-btn" onClick={(e) => { e.stopPropagation(); toggle("econKR", ind); }} title="차트 보기"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,12 5.5,7 8.5,9 14,3" /><polyline points="10,3 14,3 14,7" /></svg></button>}
                <div className="econ-name">{ind.name}</div>
                <div className="econ-value">{ind.value}</div>
                {ind.change && !ind.isStatic && <div className={`econ-change ${ind.up ? "up" : "down"}`}>{ind.up ? "▲" : "▼"} {ind.change}{ind.pct ? ` (${ind.pct})` : ""}</div>}
                {ind.status && <span className="econ-status" style={{ color: ind.statusColor || "var(--text-tertiary)" }}>{ind.status}</span>}
              </div>
            ))}
          </div>
          {selectedIndex && selectedIndex.group === "econKR" && <InlineChart item={selectedIndex} onClose={() => setSelectedIndex(null)} />}
        </div>
      )}

      <div className="section-header fade-up fade-up-d3" style={{ marginTop: 20 }}>
        <div><div className="section-title">심리 지표</div><div className="section-subtitle">시장 공포·탐욕 수준을 한눈에</div></div>
      </div>
      <div className="sentiment-grid fade-up fade-up-d3">
        {liveVix && (
          <div className={`sentiment-card ${isSelected("sentiment", liveVix.name) ? "selected" : ""}`} style={{ cursor: "pointer", border: isSelected("sentiment", liveVix.name) ? "2px solid var(--accent-blue)" : undefined }} onClick={() => toggle("sentiment", liveVix)}>
            <div className="sentiment-card-label">VIX 공포 지수</div>
            <SentimentGaugeVisual value={vixGauge} reversed />
            <div className="sentiment-value" style={{ color: liveVix.statusColor || "#F59E0B" }}>{liveVix.value}</div>
            <div className="sentiment-status" style={{ color: liveVix.statusColor || "#F59E0B" }}>{liveVix.status || "보통"}</div>
            <div className="sentiment-desc">전일대비 변동폭을 기반으로 시장 불안 수준을 측정합니다</div>
            <div className="sentiment-sub-values">
              <span>전일대비: <strong style={{ color: liveVix.up ? "var(--accent-red)" : "var(--accent-blue)" }}>{liveVix.change} ({liveVix.pct})</strong></span>
              {liveVix.yearHigh > 0 && <span>52주 최고: <strong>{liveVix.yearHigh.toFixed(2)}</strong></span>}
              {liveVix.yearLow > 0 && <span>52주 최저: <strong>{liveVix.yearLow.toFixed(2)}</strong></span>}
            </div>
          </div>
        )}
      </div>
      {selectedIndex && selectedIndex.group === "sentiment" && <InlineChart item={selectedIndex} onClose={() => setSelectedIndex(null)} />}

      {marketData?.updatedAt && (
        <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>
          마지막 업데이트: {new Date(marketData.updatedAt).toLocaleString("ko-KR")}
        </div>
      )}
    </div>
  );
}


// ─── Price Chart ─────────────────────────────────────────────────
const PERIOD_LABELS = {
  "1D": "전일대비", "1M": "전월대비", "3M": "3개월 전 대비", "6M": "6개월 전 대비",
  "1Y": "전년대비", "3Y": "3년 전 대비", "5Y": "5년 전 대비", "10Y": "10년 전 대비", "MAX": "상장 이후",
};

// ─── Metric Insights (증가/감소 시 의미 + 호두머니 코멘트) ────────
const METRIC_INSIGHTS = {
  // 핵심 밸류에이션
  per: { up: "투자자들이 기업의 미래 성장을 높게 평가하고 있어, 주가가 이익 대비 비싸게 거래되고 있는 상태입니다.", down: "시장에서 기업의 성장성에 대한 기대가 낮아져, 주가가 이익 대비 저렴하게 거래되고 있는 상태입니다.", comment: "PER이 높게 형성되기도 하는 성장주(예:반도체)의 경우 PEG를 함께 보는 것이 좋습니다." },
  pbr: { up: "시장이 회사의 자산 가치를 높게 평가하고 있는 상태입니다. 우량 기업이거나 향후 성장에 대한 기대가 반영된 결과일 수 있습니다.", down: "보유 자산 대비 주가가 저렴하게 거래되고 있는 상태입니다. 저평가일 수도 있고, 수익성이 낮다는 시장의 판단일 수도 있습니다.", comment: "회사가 보유한 건물이나 기계 등 자산은 늘어도, 산업 자체가 사양이라면 PBR은 계속 1.0 미만에 머물 수 있습니다. PBR이 낮다고 곧바로 투자하지 말고, 성장성과 함께 보세요." },
  eps: { up: "기업이 주당 벌어들이는 순이익이 증가하고 있어, 실질적인 수익 개선이 이루어지고 있습니다.", down: "기업의 주당 순이익이 줄어들고 있어, 실적이 악화되고 있다는 신호입니다.", comment: "절대적인 수치보다는 과거 EPS와의 비교가 기업의 실적 개선 여부를 판단하는 기준이 됩니다. 동종 업계 평균 EPS와도 비교해보세요." },
  de: { up: "회사가 자기자본 대비 빚에 대한 의존도가 높아지고 있어, 재무 건전성에 주의가 필요합니다.", down: "부채를 줄이며 재무 구조가 안정적으로 개선되고 있는 상태입니다.", comment: "신규 산업에 투자하는 경우(ex. 인공지능) 빠른 시장 점유를 위해 투자하므로 부채 비율이 일시적으로 높아지기도 합니다. 제조업은 100~200%, 금융업은 400% 이상, IT 기업은 100% 정도의 부채비율이 일반적입니다." },
  roe: { up: "주주의 돈(자본)을 효율적으로 운용하여 높은 수익을 내고 있어, 경영 성과가 우수합니다.", down: "자본 대비 이익 창출 능력이 떨어지고 있어, 경영 효율이 저하되고 있는 상태입니다.", comment: "ROE는 부채가 많아져도 높아질 수 있기 때문에 부채비율과 함께 확인하세요." },
  div: { up: "안정적으로 현금을 창출하고 있는 상태입니다. 주주환원 의지도 강해지고 있습니다.", down: "배당을 축소하고 있는 상태입니다. 기업이 현금 보전을 우선시하고 있을 수 있습니다.", comment: "주가가 하락할 경우 상대적으로 배당수익률이 높아져 보이지만, 실제 배당 규모 유지 여부를 확인해야 합니다." },
  ebitda: { up: "본업에서 현금을 잘 창출하고 있는 상태입니다. 재무구조도 양호합니다.", down: "본업에서의 현금 창출 능력이 약해지고 있어 주의가 필요합니다.", comment: "EBITDA는 현금 창출 능력을 보여주지만, 장비 교체나 시설 투자 비용(CAPEX)은 반영하지 않습니다. 따라서 아래 자유현금흐름과 투자활동 현금흐름을 함께 보시는 것이 좋습니다." },
  // 손익계산서
  revenue: { up: "제품이나 서비스의 판매량이 늘어나고 있는 상태입니다. 시장 점유율이 확대되고 있을 수 있습니다.", down: "시장 수요가 줄고 있는 상태입니다. 경쟁 심화로 매출이 빠지고 있을 수도 있습니다.", comment: "매출이 꾸준히 성장하는 기업은 시장에서 경쟁력을 유지하고 있다는 뜻입니다. 다만 매출이 늘어도 이익이 줄면 '저수익 성장'일 수 있으니 영업이익과 함께 확인하세요." },
  grossProfit: { up: "원가 경쟁력이 좋아지고 있는 상태입니다. 고수익 제품의 판매 비중이 높아졌을 수도 있습니다.", down: "원재료비가 상승하고 있는 상태입니다. 저마진 제품의 비중이 늘어났을 수도 있습니다.", comment: "매출 총이익률(매출 총이익/매출)이 높을수록 원가 경쟁력이 뛰어난 기업입니다. 같은 업종 내에서 비교하면 어떤 회사가 더 효율적인지 한눈에 보입니다." },
  opIncome: { up: "핵심 영업활동의 효율성이 개선되어 본업에서 더 많은 이익을 내고 있습니다.", down: "인건비·마케팅비 등 비용이 늘어나 본업의 수익성이 악화되고 있는 상태입니다.", comment: "영업이익은 회사가 '본업'으로 얼마나 벌고 있는지를 보여주는 핵심 지표입니다. 매출은 늘어도 영업이익이 줄어드는 회사는 비용 관리에 문제가 있을 수 있습니다." },
  netIncome: { up: "모든 비용을 제외한 최종 이익이 늘어나고 있는 상태입니다. 회사의 전체 수익성이 개선되고 있습니다.", down: "세금·이자·일회성 비용 등으로 인해 최종 이익이 줄어들고 있는 상태입니다.", comment: "순이익은 세금, 이자 등 모든 비용을 뺀 최종 이익입니다. 영업이익은 좋은데 순이익이 급감했다면 일회성 손실이나 환차손 등 영업 외 요인을 의심해보세요." },
  // 재무상태표
  totalAssets: { up: "회사의 규모가 성장하고 있는 상태입니다. 사업 확장이나 신규 자산 취득이 원인일 수 있습니다.", down: "회사의 총 자산이 줄어들고 있는 상태입니다. 자산 매각이나 경영 축소가 원인일 수 있습니다.", comment: "총 자산이 커지는 것이 무조건 좋은 건 아닙니다. 부채로 자산을 늘린 건지, 이익 잉여금으로 쌓인 건지 자본 총계와 함께 확인해야 합니다." },
  currentLiab: { up: "단기 자금 조달이 증가하고 있는 상태입니다. 성장을 위한 투자 목적일 수 있습니다.", down: "단기 부채를 상환하고 있는 상태입니다. 재무 건전성이 개선되고 있습니다.", comment: "유동 부채가 유동 자산보다 크면 단기 지급 능력에 문제가 생길 수 있습니다. '유동비율(유동자산/유동부채)' 200% 이상이면 안정적이라 판단합니다." },
  equity: { up: "이익 잉여금이 쌓이고 있는 상태입니다. 회사의 재무 건전성과 순자산이 강화되고 있습니다.", down: "순자산이 줄어들고 있는 상태입니다. 순손실 누적이나 과도한 배당이 원인일 수 있으며, 자본 잠식 위험에 주의해야 합니다.", comment: "자본 총계가 꾸준히 늘어나는 기업은 매년 이익을 쌓아가며 체력이 강해지고 있다는 뜻입니다. 반대로 줄어들면 배당이나 손실로 체력이 빠지고 있는 것이니 주의하세요." },
  // 현금흐름표
  fcf: { up: "기업이 자유롭게 쓸 수 있는 현금이 늘어나고 있는 상태입니다. 배당이나 신규 투자 여력이 확대되고 있습니다.", down: "자유롭게 쓸 수 있는 현금이 줄어들고 있는 상태입니다. 설비 투자나 부채 상환이 원인일 수 있습니다.", comment: "자유현금흐름은 기업이 진짜로 자유롭게 쓸 수 있는 돈입니다. 이 숫자가 꾸준히 플러스인 기업은 주주환원(배당, 자사주 매입)에 여유가 있어 장기 투자에 유리합니다." },
  opCash: { up: "본업에서 안정적으로 현금을 벌어들이고 있어 현금 창출 능력이 우수합니다.", down: "본업의 현금 흐름이 악화되고 있는 상태입니다. 재고 증가나 매출채권 회수 지연이 원인일 수 있습니다.", comment: "순이익은 높은데 영업활동 현금흐름이 마이너스라면 '이익의 질'을 의심해야 합니다. 실제 현금이 들어오지 않는 이익은 회계상 숫자에 불과할 수 있습니다." },
  invCash: { up: "투자를 줄이고 있는 상태입니다. 자산 매각을 통해 단기적으로 현금을 확보하고 있을 수 있습니다.", down: "설비나 기술에 적극적으로 투자하고 있는 상태입니다. 미래 성장을 준비하고 있습니다.", comment: "투자활동 현금흐름이 마이너스(-)라고 나쁜 것이 아닙니다. 적극적으로 설비에 투자하는 기업은 미래 매출 성장을 준비하고 있는 것이니, 영업이익과 매출 추세를 함께 보세요." },
  finCash: { up: "외부에서 자금을 조달하고 있는 상태입니다. 대출이나 주식 발행이 원인일 수 있습니다.", down: "대출을 상환하고 있는 상태입니다. 배당이나 자사주 매입으로 주주에게 환원하고 있을 수도 있습니다.", comment: "재무활동에서 마이너스가 크다면 빚을 갚거나 주주에게 환원 중인 것입니다. 건전한 기업일수록 본업으로 번 돈을 재무활동에서 나눠주는 패턴을 보입니다." },
  netChange: { up: "일정 기간 동안 현금 보유량이 늘어나고 있는 상태입니다. 유동성이 확보되고 있습니다.", down: "현금 유출이 유입보다 큰 상태입니다. 단기적으로 유동성이 부족해질 수 있으니 주의가 필요합니다.", comment: "현금 증감이 마이너스여도 투자 때문이라면 걱정할 필요 없습니다. 문제는 영업에서도 돈을 못 벌면서 현금이 줄어드는 경우이니, 영업활동 현금흐름과 함께 판단하세요." },
  // 심화 밸류에이션
  evEbitda: { up: "기업 가치가 영업이익 대비 높아져, 시장에서 프리미엄을 받고 있는 상태입니다.", down: "기업 가치가 영업이익 대비 낮아져, 시장에서 저평가되고 있는 상태입니다.", comment: "보통 10~20 사이면 적정 수준으로 보지만, 동종 업계 경쟁사들과 비교해 적절한가 여부를 판단하는 것이 정확합니다." },
  pe: { up: "이익 대비 주가가 높게 거래되고 있어, 시장의 기대가 반영된 고평가 상태입니다.", down: "이익 대비 주가가 낮게 거래되고 있어, 시장의 관심이 줄어든 저평가 상태입니다.", comment: "심화 PER 추세는 핵심 밸류에이션의 PER과 동일한 지표입니다. 추세가 급격히 변했다면 이익 변동보다 주가 변동이 원인일 수 있으니 주가 차트와 함께 확인하세요." },
  peg: { up: "성장률 대비 주가가 비싸게 거래되고 있는 상태입니다. 기대가 과도하게 반영되어 있을 수 있습니다.", down: "성장률에 비해 주가가 저렴하게 거래되고 있는 상태입니다. 저평가된 성장주일 가능성이 있습니다.", comment: "성장주의 경우 높은 PER을 정당화시켜주는 지표입니다. 성장 기업이라면 투자 전 꼭 확인해야 할 지표입니다." },
  opMargin: { up: "매출 대비 영업이익의 비중이 늘어나고 있는 상태입니다. 본업의 운영 효율성이 개선되고 있습니다.", down: "매출 대비 영업이익 비중이 줄어들고 있는 상태입니다. 경쟁 심화나 비용 증가가 원인일 수 있습니다.", comment: "비율이 높을수록 업계에서 독점적인 지위를 가졌거나 비용 관리를 잘 하고 있다는 뜻입니다. 동종 경쟁사와 한번 비교해보세요." },
  netMargin: { up: "매출 대비 최종 이익의 비중이 늘어나고 있는 상태입니다. 전반적인 재무 건전성이 좋아지고 있습니다.", down: "매출 대비 최종 이익 비중이 줄어들고 있는 상태입니다. 금융비용이나 세금 부담 증가가 원인일 수 있습니다.", comment: "영업 이익률과 차이가 너무 크다면(5% 이상) 영업 외 이익이나 비용이 과도하지 않은지 점검해야 합니다." },
  // 주주환원
  sharesQ: { up: "시장에 유통되는 주식 수가 늘어나고 있는 상태입니다. 유상증자나 스톡옵션 행사가 원인이며, 기존 주주의 지분율이 희석됩니다.", down: "자사주 매입 및 소각을 통해 주식 수가 줄어들고 있는 상태입니다. 주주 친화적인 정책을 시행하고 있습니다.", comment: "주식 수가 꾸준히 줄어드는 것(우하향)이 주주 친화적인 기업입니다." },
  sharesY: { up: "연간 기준 발행 주식 수가 늘어나고 있는 상태입니다. 유상증자나 스톡옵션 행사가 원인일 수 있습니다.", down: "연간 기준 주식 수가 줄어들고 있는 상태입니다. 자사주 매입 및 소각으로 주주 가치가 높아지고 있습니다.", comment: "주식 수가 꾸준히 줄어드는 것(우하향)이 주주 친화적인 기업입니다." },
};

function PriceChart({ ticker, dailyChange, onPeriodChange }) {
  const [period, setPeriod] = useState("1Y");
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    fetch(`/api/price?symbol=${ticker}&period=${period}`)
      .then(r => r.json())
      .then(d => {
        if (d.points && d.points.length > 0) {
          const pts = d.points.map(p => {
            const dt = new Date(p.date);
            const krDate = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
            const yy = String(krDate.getUTCFullYear()).slice(-2);
            const mm = String(krDate.getUTCMonth() + 1).padStart(2, "0");
            const dd = String(krDate.getUTCDate()).padStart(2, "0");
            const label = period === "1D" ? `${mm}.${dd} ${String(krDate.getUTCHours()).padStart(2,"0")}:${String(krDate.getUTCMinutes()).padStart(2,"0")}` : `${yy}년 ${mm}월`;
            return { date: label, price: p.price, fullDate: p.date };
          });
          setChartData(pts);
          // Calculate period return and notify parent
          const first = d.points[0].price;
          const last = d.points[d.points.length - 1].price;
          if (first > 0 && onPeriodChange) {
            const pctChange = ((last - first) / first) * 100;
            onPeriodChange({ pct: pctChange, label: PERIOD_LABELS[period] || period });
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker, period]);

  const firstPrice = chartData.length > 0 ? chartData[0].price : 0;
  const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0;
  const chartUp = lastPrice >= firstPrice;
  const color = chartUp ? "#F04452" : "#3182F6";

  return (
    <div className="card fade-up" style={{ padding: "16px" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        {["1D", "1M", "3M", "6M", "1Y", "3Y", "5Y", "10Y", "MAX"].map(p => (
          <button key={p} className={`chart-period-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)} style={{ padding: "5px 10px" }}>{p}</button>
        ))}
      </div>
      {loading ? (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13 }}>Loading...</div>
      ) : chartData.length === 0 ? (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13 }}>No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <defs><linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.12} /><stop offset="100%" stopColor={color} stopOpacity={0.01} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F5" vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#8B95A1" }} interval={Math.max(0, Math.floor(chartData.length / 6) - 1)} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8B95A1" }} domain={["dataMin * 0.97", "dataMax * 1.03"]} tickFormatter={v => `$${v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(1)}`} width={58} />
            <Tooltip contentStyle={{ background: "white", border: "1px solid #E5E8EB", borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", padding: "8px 14px", fontSize: 13, fontWeight: 600 }} formatter={(val) => [`$${typeof val === "number" ? val.toFixed(2) : val}`, ""]} labelStyle={{ color: "#8B95A1", fontSize: 11 }} />
            <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2} fill="url(#priceGrad)" dot={false} activeDot={{ r: 4, stroke: color, strokeWidth: 2, fill: "white" }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Company Analysis Page ───────────────────────────────────────
function CompanyPage({ searchTicker, onQuickSearch, onUsageConsume, user, isInWatchlist, addToWatchlist, removeFromWatchlist }) {
  const [viewMode, setViewMode] = useState("quarterly");
  const [activeSection, setActiveSection] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [periodInfo, setPeriodInfo] = useState({ pct: 0, label: "전년대비" });
  const consumedRef = useRef(new Set());

  useEffect(() => {
    if (!searchTicker) { setData(null); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(`/api/stock?symbol=${encodeURIComponent(searchTicker)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.error) { setError(d.error); setData(null); }
        else {
          setData(d);
          // Only consume usage once per ticker, and only on success
          if (onUsageConsume && !consumedRef.current.has(searchTicker)) {
            consumedRef.current.add(searchTicker);
            onUsageConsume();
          }
        }
      })
      .catch(() => !cancelled && setError("데이터를 불러올 수 없습니다"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [searchTicker]);

  if (!searchTicker) {
    return (
      <div className="content-area" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 60px)" }}>
        <div className="fade-up" style={{ textAlign: "center", width: "100%", maxWidth: 560, padding: "0 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>🔍</div>
          <h3 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.5px" }}>기업을 검색해보세요</h3>
          <p style={{ fontSize: 14, color: "var(--text-tertiary)", lineHeight: 1.6, marginBottom: 28 }}>티커 또는 기업명을 입력하면<br />재무제표, 밸류에이션, 현금흐름을 한눈에 볼 수 있습니다.</p>
          <div style={{ width: "100%", maxWidth: 520, margin: "0 auto 20px" }}>
            <SearchBox onSelect={onQuickSearch} large />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
            {["NVDA", "AAPL", "TSLA", "MSFT", "GOOG", "LLY"].map(t => (
              <button key={t} onClick={() => onQuickSearch && onQuickSearch(t)}
                style={{ padding: "8px 18px", borderRadius: 20, border: "1px solid var(--border)", background: "white", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--accent-blue)", transition: "all 0.15s ease" }}>{t}</button>
            ))}
          </div>
          <a href="https://litt.ly/hodumoney/sale/QnPfK6I" target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, background: "var(--bg-primary)", border: "1px solid var(--border)", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none", transition: "all 0.15s ease" }}>
            🎫 기업분석 무제한 이용권 구매하기
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="content-area">
        <div className="empty-state fade-up">
          <div style={{ fontSize: 40, marginBottom: 16, animation: "pulse 1.5s infinite" }}>⏳</div>
          <h3>{searchTicker} 분석 중...</h3>
          <p>재무 데이터를 가져오고 있습니다</p>
          <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="content-area">
        <div className="empty-state fade-up">
          <div className="empty-state-icon">⚠️</div>
          <h3>{error || "데이터를 찾을 수 없습니다"}</h3>
          <p>티커를 확인하고 다시 시도해주세요</p>
        </div>
      </div>
    );
  }

  const fmtCap = (v) => {
    if (!v) return "-";
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    return `$${v.toLocaleString()}`;
  };
  const safeNum = (v, fallback = 0) => (typeof v === "number" && isFinite(v)) ? v : fallback;
  const capLabel = data.capRank || getCapRankLabel(data.ticker, data.marketCap);
  const dropFromHigh = data.yearHigh > 0 ? ((data.price - data.yearHigh) / data.yearHigh * 100) : 0;
  const krDesc = getKrDescription(data.ticker, null);

  const displayPct = periodInfo.pct;
  const displayLabel = periodInfo.label;

  return (
    <div className="content-area">
      <div className="company-hero fade-up">
        <div className="company-info">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>{data.name}</h2>
            {user && (
              <button
                onClick={() => isInWatchlist(data.ticker) ? removeFromWatchlist(data.ticker) : addToWatchlist(data.ticker, data.name)}
                style={{
                  background: isInWatchlist(data.ticker) ? "#5D4037" : "white",
                  color: isInWatchlist(data.ticker) ? "white" : "#5D4037",
                  border: "1.5px solid #5D4037",
                  borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700,
                  transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: 5,
                  fontFamily: "inherit", whiteSpace: "nowrap",
                }}
              >
                {isInWatchlist(data.ticker) ? "★ 관심종목 등록됨" : "☆ 관심종목 추가"}
              </button>
            )}
          </div>
          <div className="company-ticker">{data.ticker} · {data.exchange || ""} {data.sector ? `· ${data.sector}` : ""}</div>
          {krDesc && <div className="company-desc">{krDesc}</div>}
        </div>
        <div className="price-block">
          <div className="price-current">${safeNum(data.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className={`price-change ${displayPct >= 0 ? "positive" : "negative"}`}>
            {displayPct >= 0 ? "+" : ""}{displayPct.toFixed(2)}% {displayLabel}
          </div>
        </div>
      </div>

      <PriceChart ticker={data.ticker} dailyChange={data.dailyChange} onPeriodChange={(info) => setPeriodInfo(info)} />

      <div className="stats-grid fade-up fade-up-d1" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { label: "시가총액", value: fmtCap(data.marketCap) },
          { label: "시가총액 순위", value: capLabel },
          { label: "거래량", value: safeNum(data.volume).toLocaleString() },
          { label: "52주 최고", value: `$${safeNum(data.yearHigh).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` },
          { label: "고점대비 하락률", value: `${dropFromHigh.toFixed(1)}%`, color: dropFromHigh < 0 ? "var(--accent-blue)" : "var(--accent-green)" },
          { label: "변동성 (β)", value: safeNum(data.beta).toFixed(2), sub: "시장 대비 변동 배수" },
        ].map((s, i) => (
          <div className="stat-item" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color || "inherit" }}>{s.value}</div>
            {s.sub && <div className="stat-sub">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="tab-group fade-up fade-up-d2">
        {[{ id: "overview", label: "핵심 밸류에이션" }, { id: "financials", label: "재무제표" }, { id: "advanced", label: "심화 지표" }].map(t => (
          <button key={t.id} className={`tab-btn ${activeSection === t.id ? "active" : ""}`} onClick={() => setActiveSection(t.id)}>{t.label}</button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div className="toggle-group">
          <button className={`toggle-btn ${viewMode === "quarterly" ? "active" : ""}`} onClick={() => setViewMode("quarterly")}>분기</button>
          <button className={`toggle-btn ${viewMode === "yearly" ? "active" : ""}`} onClick={() => setViewMode("yearly")}>연간</button>
        </div>
      </div>

      {activeSection === "overview" && <CoreValuations data={viewMode === "quarterly" ? (data.quarterly || data) : (data.annual || data)} />}
      {activeSection === "financials" && <FinancialStatements data={viewMode === "quarterly" ? (data.quarterly || data) : (data.annual || data)} />}
      {activeSection === "advanced" && <AdvancedMetrics data={viewMode === "quarterly" ? (data.quarterly || data) : (data.annual || data)} />}

      <div style={{ textAlign: "center", padding: "32px 0 0", fontSize: 11, color: "var(--text-tertiary)" }}>
        ©hodusolution · 본 데이터는 참고용이며, 투자 판단의 책임은 투자자 본인에게 있습니다.
      </div>
    </div>
  );
}

// ─── Coming Soon Page ────────────────────────────────────────────
function ComingSoonPage({ icon, title }) {
  return (
    <div className="content-area">
      <div className="coming-soon fade-up">
        <div className="coming-soon-icon">{icon}</div>
        <h3>{title}</h3>
        <p>현재 개발 중인 기능입니다.<br />곧 업데이트될 예정이니 조금만 기다려주세요!</p>
      </div>
    </div>
  );
}

// ─── Watchlist Page (관심 종목) ──────────────────────────────────
function WatchlistPage({ user, onLogin, onSearch, watchlist, addToWatchlist, removeFromWatchlist }) {
  const [addTicker, setAddTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [stockData, setStockData] = useState({}); // { AAPL: { price, d1, w1, m1, y1 } }
  const [loading, setLoading] = useState(false);

  // 종목 추가 (검증 후)
  const handleAdd = async () => {
    const ticker = addTicker.trim().toUpperCase();
    if (!ticker) return;
    if (watchlist.some(w => w.ticker === ticker)) { setAddTicker(""); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/stock?symbol=${encodeURIComponent(ticker)}`);
      if (!res.ok) { alert("종목을 찾을 수 없습니다: " + ticker); setAdding(false); return; }
      const data = await res.json();
      addToWatchlist(ticker, data.name || ticker);
      setAddTicker("");
    } catch { alert("종목 추가에 실패했습니다."); }
    finally { setAdding(false); }
  };

  // 수익률 계산: chart API에서 기간별 첫/끝 값으로 계산
  const calcReturn = (points) => {
    if (!points || points.length < 2) return null;
    const first = points[0].value, last = points[points.length - 1].value;
    return first ? ((last - first) / first) * 100 : null;
  };

  // 전체 종목 가격+수익률 일괄 조회
  useEffect(() => {
    if (watchlist.length === 0) { setStockData({}); return; }
    setLoading(true);

    const ranges = ["1d", "5d", "1mo", "1y"];
    Promise.all(
      watchlist.map(async (w) => {
        try {
          // 현재가는 stock API에서
          const stockRes = await fetch(`/api/stock?symbol=${encodeURIComponent(w.ticker)}`);
          const stock = stockRes.ok ? await stockRes.json() : null;

          // 기간별 수익률은 chart API에서
          const chartResults = await Promise.all(
            ranges.map(r =>
              fetch(`/api/market/chart?symbol=${encodeURIComponent(w.ticker)}&range=${r}`)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null)
            )
          );

          return {
            ticker: w.ticker,
            price: stock?.price || null,
            d1: calcReturn(chartResults[0]?.points),
            w1: calcReturn(chartResults[1]?.points),
            m1: calcReturn(chartResults[2]?.points),
            y1: calcReturn(chartResults[3]?.points),
          };
        } catch {
          return { ticker: w.ticker, price: null, d1: null, w1: null, m1: null, y1: null };
        }
      })
    ).then(results => {
      const sd = {};
      results.forEach(r => { sd[r.ticker] = r; });
      setStockData(sd);
    }).finally(() => setLoading(false));
  }, [watchlist.length]);

  const ReturnBadge = ({ val, label }) => {
    if (val === null || val === undefined) return <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 2 }}>{label}</div><div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>-</div></div>;
    const up = val > 0, down = val < 0;
    const color = up ? "#c0392b" : down ? "#2980b9" : "var(--text-tertiary)";
    const bg = up ? "#FFF0F1" : down ? "#EBF3FE" : "#F5F6F8";
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color, background: bg, borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" }}>
          {up ? "+" : ""}{val.toFixed(1)}%
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="content-area">
        <div className="coming-soon fade-up">
          <div className="coming-soon-icon">⭐</div>
          <h3>관심 종목</h3>
          <p>로그인하면 관심 종목을 등록하고<br />한눈에 시세를 확인할 수 있어요.</p>
          <button onClick={onLogin} style={{ marginTop: 20, padding: "12px 32px", background: "#5D4037", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="content-area">
      <div className="section-header section-header-distinct fade-up" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title">관심 종목</div>
          <div className="section-subtitle">내가 등록한 종목의 시세와 수익률을 한눈에 확인</div>
        </div>
      </div>

      <div className="card fade-up" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" placeholder="종목 티커 입력 (예: AAPL, MSFT)"
            value={addTicker} onChange={e => setAddTicker(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            style={{ flex: 1, padding: "10px 14px", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
          <button onClick={handleAdd} disabled={adding}
            style={{ padding: "10px 20px", background: "#5D4037", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: adding ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap", opacity: adding ? 0.6 : 1 }}>
            {adding ? "추가중..." : "+ 추가"}
          </button>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div className="empty-state fade-up" style={{ paddingTop: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
          <h3>아직 등록한 종목이 없습니다</h3>
          <p style={{ color: "var(--text-tertiary)" }}>위 입력창에 티커를 입력하거나, 기업 분석 페이지에서<br />☆ 버튼을 눌러 관심 종목을 추가해보세요.</p>
        </div>
      ) : (
        <div className="fade-up fade-up-d1">
          {loading && <div style={{ textAlign: "center", padding: 20, color: "var(--text-tertiary)", fontSize: 13 }}>시세 및 수익률 불러오는 중...</div>}

          {/* 테이블 헤더 */}
          <div style={{ display: "flex", alignItems: "center", padding: "0 20px 8px", gap: 12 }}>
            <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>종목</div>
            <div style={{ width: 90, textAlign: "right", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>현재가</div>
            <div style={{ width: 56, textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>일간</div>
            <div style={{ width: 56, textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>주간</div>
            <div style={{ width: 56, textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>월간</div>
            <div style={{ width: 56, textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>1년</div>
            <div style={{ width: 32 }} />
          </div>

          {watchlist.map((w) => {
            const sd = stockData[w.ticker];
            return (
              <div className="card" key={w.ticker} style={{ padding: "14px 20px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "all 0.15s" }}
                onClick={() => onSearch(w.ticker)}>
                {/* 종목명 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{w.ticker}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</div>
                </div>
                {/* 현재가 */}
                <div style={{ width: 90, textAlign: "right" }}>
                  {sd?.price ? (
                    <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      ${sd.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>-</div>
                  )}
                </div>
                {/* 수익률 뱃지 */}
                <ReturnBadge val={sd?.d1} label="1D" />
                <ReturnBadge val={sd?.w1} label="1W" />
                <ReturnBadge val={sd?.m1} label="1M" />
                <ReturnBadge val={sd?.y1} label="1Y" />
                {/* 삭제 */}
                <button onClick={(e) => { e.stopPropagation(); removeFromWatchlist(w.ticker); }}
                  style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 16, cursor: "pointer", padding: "4px 8px", borderRadius: 6, transition: "all 0.15s", width: 32, textAlign: "center" }}
                  onMouseOver={e => { e.currentTarget.style.color = "var(--accent-red)"; e.currentTarget.style.background = "var(--accent-red-light)"; }}
                  onMouseOut={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "none"; }}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Paywall Modal ───────────────────────────────────────────────
function PaywallModal({ usageCount, maxFree, onCodeSubmit, onClose }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (onCodeSubmit(code.trim())) {
      onClose();
    } else {
      setError("유효하지 않은 코드입니다");
      setTimeout(() => setError(""), 2000);
    }
  };

  return (
    <div className="paywall-overlay" onClick={onClose}>
      <div className="paywall-card" onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
        <button className="paywall-close" onClick={onClose}>✕</button>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h3>무료 분석 횟수를 모두 사용했어요</h3>
        <p>기업 분석은 <strong>{maxFree}회</strong>까지 무료입니다.<br />코드를 입력하거나 구매하면 무제한으로 사용할 수 있어요!</p>
        <a href="https://litt.ly/hodumoney/sale/QnPfK6I" target="_blank" rel="noopener noreferrer"
          style={{ display: "block", width: "100%", padding: "12px", marginBottom: 12, border: "none", borderRadius: 10,
            background: "linear-gradient(135deg, #3182F6, #1B64DA)", color: "white", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", textAlign: "center", textDecoration: "none", letterSpacing: "-0.3px" }}>
          기업분석 무제한 이용권 구매하기
        </a>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>또는 이미 이용권이 있으시면 코드를 입력해주세요</div>
        <input
          className={`paywall-input ${error ? "error" : ""}`}
          type="text"
          placeholder="이용권 코드 입력"
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
        />
        {error && <div className="paywall-error">{error}</div>}
        <button className="paywall-submit" onClick={handleSubmit}>코드 인증</button>
        <div className="paywall-counter">사용 {usageCount}/{maxFree}회</div>
      </div>
    </div>
  );
}

// ─── Usage Notification (centered overlay) ───────────────────────
function UsageNotice({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 350, pointerEvents: "none",
    }}>
      <div style={{
        background: "white", padding: "28px 36px", borderRadius: 16,
        boxShadow: "0 12px 48px rgba(0,0,0,0.15)", textAlign: "center",
        animation: "fadeUp 0.3s ease", pointerEvents: "auto",
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>{message}</div>
      </div>
    </div>
  );
}

// ─── Briefing Page (Newsletter Archive + Subscribe + Admin Editor) ──
function BriefingPage({ user }) {
  const [email, setEmail] = useState("");
  const [subStatus, setSubStatus] = useState(null);
  const [subMsg, setSubMsg] = useState("");
  const [newsletters, setNewsletters] = useState([]);
  const [loadingNL, setLoadingNL] = useState(true);
  const [selectedNL, setSelectedNL] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNL, setEditingNL] = useState(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const fetchNewsletters = () => {
    setLoadingNL(true);
    fetch("/api/briefing")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setNewsletters(d); })
      .catch(() => {})
      .finally(() => setLoadingNL(false));
  };

  useEffect(() => { fetchNewsletters(); }, []);

  const handleSubscribe = async () => {
    if (!email || !email.includes("@")) { setSubStatus("error"); setSubMsg("올바른 이메일을 입력해주세요."); return; }
    setSubStatus("loading");
    try {
      const res = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (res.ok) { setSubStatus("success"); setSubMsg("구독 신청이 완료되었습니다! 매일 아침 뉴스 브리핑을 보내드릴게요."); setEmail(""); }
      else { setSubStatus("error"); setSubMsg(data.error || "구독 신청에 실패했습니다."); }
    } catch { setSubStatus("error"); setSubMsg("네트워크 오류가 발생했습니다."); }
  };

  // Admin: Edit existing post
  const handleEdit = (nl) => {
    setEditingNL(nl);
    setShowEditor(true);
    setSelectedNL(null);
  };

  // Admin: Delete post
  const handleDelete = async (nl) => {
    if (!confirm(`"${nl.title}" 게시글을 삭제하시겠습니까?`)) return;
    try {
      await fetch("/api/briefing", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: nl.date }) });
      fetchNewsletters();
    } catch {}
  };

  // Detail view — 이메일과 동일한 7섹션 양식
  if (selectedNL) {
    const indices = selectedNL.indices || {};
    const heatmaps = selectedNL.heatmaps || {};
    const news = selectedNL.news || selectedNL.articles || [];
    const watchpoints = selectedNL.watchpoints || [];
    const hasIndices = Object.keys(indices).length > 0;
    const hasHeatmaps = heatmaps.sp500 || heatmaps.kospi;
    const hasNews = news.length > 0;
    const hasWatchpoints = watchpoints.length > 0;
    const comicUrl = selectedNL.comicUrl || null;

    return (
      <div className="content-area">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button className="newsletter-detail-back" onClick={() => setSelectedNL(null)}>← 목록으로</button>
          {isAdmin && (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="post-btn secondary" onClick={() => handleEdit(selectedNL)} style={{ padding: "6px 14px", fontSize: 12 }}>✏️ 수정</button>
              <button className="post-btn danger" onClick={() => handleDelete(selectedNL)} style={{ padding: "6px 14px", fontSize: 12 }}>🗑 삭제</button>
            </div>
          )}
        </div>

        <div className="newsletter-detail fade-up">
          {/* 1. 헤더 */}
          <div className="nl-header">
            <div className="nl-header-logo">🥜</div>
            <div className="nl-header-title">{selectedNL.title || "HODU MONEY 모닝 뉴스"}</div>
            <div className="nl-header-date">{selectedNL.date}</div>
          </div>

          <div className="nl-body">
            {/* 2. 주요 지수 현황 — 이메일과 동일한 양옆 카드 레이아웃 */}
            {hasIndices && (
              <div className="nl-section">
                <div className="nl-section-title">📊 주요 지수 현황</div>
                <div className="nl-index-side">
                  {/* 미국 증시 */}
                  <div style={{ background: "white", padding: 18, borderRadius: 10, border: "1px solid #e0e0e0" }}>
                    <div style={{ margin: "0 0 14px 0", paddingBottom: 8, borderBottom: "2px solid #A67B5B", fontSize: 15, fontWeight: 700, color: "#333" }}>미국 증시</div>
                    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                      <tbody>
                        {(indices.us || []).map((row, i) => (
                          <tr key={i}>
                            <td style={{ padding: "6px 0", fontWeight: 700, color: "#444" }}>{row.name}</td>
                            <td style={{ padding: "6px 0", textAlign: "right", color: "#2c3e50", fontVariantNumeric: "tabular-nums" }}>{row.value}</td>
                            <td style={{ padding: "6px 0 6px 8px", textAlign: "right", fontWeight: 700, color: row.up ? "#c0392b" : "#2980b9", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                              {row.up ? "▲" : "▼"} {row.change?.replace(/[▲▼]/g, "").trim()} ({row.pct || ""})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* 한국 증시 */}
                  <div style={{ background: "white", padding: 18, borderRadius: 10, border: "1px solid #e0e0e0" }}>
                    <div style={{ margin: "0 0 14px 0", paddingBottom: 8, borderBottom: "2px solid #A67B5B", fontSize: 15, fontWeight: 700, color: "#333" }}>한국 증시</div>
                    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                      <tbody>
                        {(indices.kr || []).map((row, i) => (
                          <tr key={i}>
                            <td style={{ padding: "6px 0", fontWeight: 700, color: "#444" }}>{row.name}</td>
                            <td style={{ padding: "6px 0", textAlign: "right", color: "#2c3e50", fontVariantNumeric: "tabular-nums" }}>{row.value}</td>
                            <td style={{ padding: "6px 0 6px 8px", textAlign: "right", fontWeight: 700, color: row.up ? "#c0392b" : "#2980b9", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                              {row.up ? "▲" : "▼"} {row.change?.replace(/[▲▼]/g, "").trim()} ({row.pct || ""})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. 히트맵 */}
            {hasHeatmaps && (
              <div className="nl-section">
                <div className="nl-section-title">🗺️ 히트맵</div>
                <div className="nl-heatmap-grid">
                  {heatmaps.sp500 && (
                    <div className="nl-heatmap-item">
                      <div className="nl-heatmap-label">S&P 500 히트맵</div>
                      <img src={heatmaps.sp500} alt="S&P500 히트맵" />
                    </div>
                  )}
                  {heatmaps.kospi && (
                    <div className="nl-heatmap-item">
                      <div className="nl-heatmap-label">코스피 히트맵</div>
                      <img src={heatmaps.kospi} alt="코스피 히트맵" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. 오늘의 전체 인사이트 */}
            {selectedNL.overallInsight && (
              <div className="nl-section">
                <div className="nl-section-title">💡 오늘의 인사이트</div>
                <div className="nl-insight-box">{selectedNL.overallInsight}</div>
              </div>
            )}

            {/* 5. 만화 이미지 */}
            {comicUrl && (
              <div className="nl-section">
                <div className="nl-section-title">🎨 오늘의 한컷</div>
                <div className="nl-comic">
                  <img src={comicUrl} alt="오늘의 만화" />
                </div>
              </div>
            )}

            {/* 본문 (수동 입력 content) */}
            {selectedNL.content && (
              <div className="nl-section">
                <div style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{selectedNL.content}</div>
              </div>
            )}

            {/* 6. 경제 뉴스 TOP 5 */}
            {hasNews && (
              <div className="nl-section">
                <div className="nl-section-title">📰 오늘의 경제 뉴스 TOP {news.length}</div>
                {news.map((a, i) => (
                  <div className="nl-news-item" key={i}>
                    <div style={{ marginBottom: 10 }}>
                      <span className="nl-news-num">{i + 1}</span>
                      <span className="nl-news-title">{a.title}</span>
                    </div>
                    {a.summary && <div className="nl-news-summary">{a.summary}</div>}
                    {a.interpretation && (
                      <div className="nl-news-interp">
                        <strong>💡 해석</strong><br />{a.interpretation}
                      </div>
                    )}
                    {a.link && a.link !== "#" && (
                      <a href={a.link} target="_blank" rel="noopener noreferrer" className="nl-news-link">
                        📎 원본 뉴스 보기
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 7. 관전 포인트 */}
            {hasWatchpoints && (
              <div className="nl-section">
                <div className="nl-section-title">📌 오늘의 관전 포인트</div>
                {watchpoints.map((wp, i) => (
                  <div className="nl-watchpoint" key={i}>
                    <span className="nl-watchpoint-icon">📌</span>
                    <span>{wp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Editor view
  if (showEditor && isAdmin) {
    return (
      <div className="content-area">
        <PostEditor
          existing={editingNL}
          onSave={() => { setShowEditor(false); setEditingNL(null); fetchNewsletters(); }}
          onCancel={() => { setShowEditor(false); setEditingNL(null); }}
          user={user}
        />
      </div>
    );
  }

  return (
    <div className="content-area">
      {/* ── Section 1: 소개 ── */}
      <div className="card fade-up" style={{ textAlign: "center", padding: "44px 28px 36px", marginBottom: 0, borderBottom: "none", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>🥜</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.6px", marginBottom: 12 }}>호두 브리핑</h2>
        <p style={{ fontSize: 16, color: "var(--text-primary)", lineHeight: 1.7, maxWidth: 420, margin: "0 auto", fontWeight: 600 }}>
          "오늘 시장 왜 빠졌지?"<br />매일 아침 10분이면 충분합니다.
        </p>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", lineHeight: 1.6, maxWidth: 400, margin: "12px auto 0" }}>
          뉴스는 많은데 뭘 봐야 할지 모르겠다면,<br />호두가 골라서 쉽게 정리해드립니다.
        </p>
      </div>

      {/* ── Section 2: 구독 ── */}
      <div className="card fade-up fade-up-d1" style={{ padding: "28px", marginBottom: 28, borderRadius: "0 0 var(--radius-lg) var(--radius-lg)", borderTop: "1px dashed var(--border)", background: "#FDFBF9" }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>📬 호두레터 무료 구독하기</h3>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>이메일만 입력하면 매일 아침 무료로 뉴스 브리핑을 보내드립니다.</p>
        </div>
        <div style={{ maxWidth: 440, margin: "0 auto" }}>
          <div className="subscribe-form">
            <input className="subscribe-input" type="email" placeholder="이메일 주소 입력" value={email}
              onChange={e => { setEmail(e.target.value); setSubStatus(null); }}
              onKeyDown={e => { if (e.key === "Enter") handleSubscribe(); }} />
            <button className="subscribe-btn" onClick={handleSubscribe} disabled={subStatus === "loading"}>
              {subStatus === "loading" ? "처리중..." : "무료 구독"}
            </button>
          </div>
          {subMsg && <div className={`subscribe-msg ${subStatus}`}>{subMsg}</div>}
        </div>
      </div>

      {/* ── Section 3: 아카이브 ── */}
      <div style={{ marginTop: 8 }}>
        <div className="section-header section-header-distinct fade-up fade-up-d2" style={{ marginBottom: 20 }}>
          <div>
            <div className="section-title">지난 브리핑</div>
            <div className="section-subtitle">매일 발행되는 호두레터를 다시 읽어보세요</div>
          </div>
          {isAdmin && (
            <button className="post-btn primary" onClick={() => { setEditingNL(null); setShowEditor(true); }} style={{ fontSize: 13, padding: "8px 16px" }}>
              ✏️ 새 게시글 작성
            </button>
          )}
        </div>

        {loadingNL ? (
          <div className="empty-state fade-up">
            <div style={{ fontSize: 40, animation: "pulse 1.5s infinite" }}>⏳</div>
            <p style={{ marginTop: 12, color: "var(--text-tertiary)" }}>브리핑을 불러오는 중...</p>
            <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
          </div>
        ) : newsletters.length === 0 ? (
          <div className="empty-state fade-up">
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <h3>아직 발행된 브리핑이 없습니다</h3>
            <p style={{ color: "var(--text-tertiary)" }}>구독하시면 첫 번째 브리핑부터 받아보실 수 있어요!</p>
          </div>
        ) : (
          <div className="newsletter-grid fade-up fade-up-d2">
            {newsletters.map((nl, i) => (
              <div className="newsletter-card" key={i} onClick={() => setSelectedNL(nl)}>
                {nl.imageUrl ? (
                  <img className="newsletter-thumb" src={nl.imageUrl} alt={nl.title || nl.date} />
                ) : (
                  <div className="newsletter-thumb-placeholder">🥜</div>
                )}
                <div className="newsletter-body">
                  <div className="newsletter-date">{nl.date}</div>
                  <div className="newsletter-title">{nl.title || "호두 브리핑"}</div>
                  <div className="newsletter-preview">{nl.overallInsight || ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Post Editor (Admin Only) — 이메일 양식 7섹션 에디터 ─────────
function PostEditor({ existing, onSave, onCancel, user }) {
  const [title, setTitle] = useState(existing?.title || "");
  const [date, setDate] = useState(existing?.date || new Date().toISOString().split("T")[0]);
  const [overallInsight, setOverallInsight] = useState(existing?.overallInsight || "");
  const [content, setContent] = useState(existing?.content || "");
  const [comicUrl, setComicUrl] = useState(existing?.comicUrl || "");
  const [saving, setSaving] = useState(false);

  // 지수 데이터
  const emptyIndex = { name: "", value: "", change: "", pct: "", up: false };
  const defaultUS = [
    { name: "S&P 500", value: "", change: "", pct: "", up: false },
    { name: "나스닥 100", value: "", change: "", pct: "", up: false },
    { name: "다우존스", value: "", change: "", pct: "", up: false },
    { name: "달러인덱스", value: "", change: "", pct: "", up: false },
  ];
  const defaultKR = [
    { name: "코스피", value: "", change: "", pct: "", up: false },
    { name: "코스닥", value: "", change: "", pct: "", up: false },
    { name: "원/달러 환율", value: "", change: "", pct: "", up: false },
  ];
  const [indicesUS, setIndicesUS] = useState(existing?.indices?.us || defaultUS);
  const [indicesKR, setIndicesKR] = useState(existing?.indices?.kr || defaultKR);

  // 히트맵
  const [heatmapSP, setHeatmapSP] = useState(existing?.heatmaps?.sp500 || "");
  const [heatmapKospi, setHeatmapKospi] = useState(existing?.heatmaps?.kospi || "");

  // 뉴스 (최대 5개)
  const emptyNews = { title: "", summary: "", interpretation: "", link: "" };
  const [news, setNews] = useState(
    existing?.news?.length > 0 ? existing.news :
    existing?.articles?.length > 0 ? existing.articles :
    [{ ...emptyNews }]
  );

  // 관전포인트
  const [watchpoints, setWatchpoints] = useState(
    existing?.watchpoints?.length > 0 ? existing.watchpoints : [""]
  );

  const [uploading, setUploading] = useState({});
  const fileRefs = useRef({});

  const uploadImage = async (file, folder, key) => {
    if (!file) return "";
    if (file.size > 5 * 1024 * 1024) { alert("파일 크기는 5MB 이하여야 합니다."); return ""; }
    setUploading(prev => ({ ...prev, [key]: true }));
    try {
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const storage = await getFirebaseStorage();
      const fileName = `${folder}/${date}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (err) {
      alert("이미지 업로드 실패: " + err.message);
      return "";
    } finally {
      setUploading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleImageSelect = async (e, setter, key) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file, "briefing", key);
    if (url) setter(url);
  };

  // 지수 자동 불러오기
  const [loadingIndices, setLoadingIndices] = useState(false);
  const fetchIndices = async () => {
    setLoadingIndices(true);
    try {
      // 호두레터용: 어제(직전 거래일) 종가 + 전전일 대비 등락
      const res = await fetch("/api/market/yesterday");
      if (!res.ok) throw new Error();
      const d = await res.json();

      if (d.us) {
        setIndicesUS(
          defaultUS.map(def => {
            const found = d.us.find(r => r.name === def.name);
            return found || def;
          })
        );
      }
      if (d.kr) {
        setIndicesKR(
          defaultKR.map(def => {
            const found = d.kr.find(r => r.name === def.name);
            return found || def;
          })
        );
      }
      // 거래일 날짜를 자동 세팅 (새 게시글일 때만)
      if (d.tradingDate && !existing) {
        setDate(d.tradingDate);
      }
    } catch { alert("어제 시장 데이터를 불러올 수 없습니다."); }
    finally { setLoadingIndices(false); }
  };

  const updateIndex = (arr, setter, idx, field, val) => {
    const copy = [...arr];
    copy[idx] = { ...copy[idx], [field]: val };
    if (field === "change") copy[idx].up = !val.startsWith("-");
    setter(copy);
  };

  const updateNews = (idx, field, val) => {
    const copy = [...news];
    copy[idx] = { ...copy[idx], [field]: val };
    setNews(copy);
  };

  const handleSave = async () => {
    if (!title.trim() || !date) { alert("제목과 날짜를 입력해주세요."); return; }
    setSaving(true);
    try {
      const body = {
        date,
        title: title.trim(),
        overallInsight: overallInsight.trim(),
        content: content.trim(),
        imageUrl: comicUrl || heatmapSP || heatmapKospi || "",
        comicUrl,
        indices: { us: indicesUS.filter(r => r.value), kr: indicesKR.filter(r => r.value) },
        heatmaps: { sp500: heatmapSP, kospi: heatmapKospi },
        news: news.filter(n => n.title.trim()),
        watchpoints: watchpoints.filter(w => w.trim()),
        isManual: true,
      };
      const res = await fetch("/api/briefing", {
        method: existing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { onSave(); }
      else { const d = await res.json(); alert(d.error || "저장에 실패했습니다."); }
    } catch { alert("네트워크 오류가 발생했습니다."); }
    finally { setSaving(false); }
  };

  return (
    <div className="post-editor fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ margin: 0 }}>{existing ? "게시글 수정" : "새 게시글 작성"}</h3>
        <span className="admin-badge">👑 관리자</span>
      </div>

      {/* 기본 정보 */}
      <div className="editor-section">
        <div className="editor-section-title"><span className="es-num">①</span> 기본 정보</div>
        <div className="post-field">
          <label>날짜</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="post-field">
          <label>제목</label>
          <input type="text" placeholder="예: 🥜 HODU MONEY 모닝 뉴스" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
      </div>

      {/* 2. 지수 현황 */}
      <div className="editor-section">
        <div className="editor-section-title">
          <span className="es-num">②</span> 주요 지수 현황
          <button className="post-btn secondary" onClick={fetchIndices} disabled={loadingIndices}
            style={{ marginLeft: "auto", padding: "5px 12px", fontSize: 12 }}>
            {loadingIndices ? "불러오는 중..." : "🔄 어제 시장 데이터 불러오기"}
          </button>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>🇺🇸 미국 증시</div>
        {indicesUS.map((row, i) => (
          <div key={i} className="editor-index-grid" style={{ marginBottom: 8, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
            <div className="editor-index-item"><label>지수명</label><input value={row.name} onChange={e => updateIndex(indicesUS, setIndicesUS, i, "name", e.target.value)} /></div>
            <div className="editor-index-item"><label>종가</label><input value={row.value} onChange={e => updateIndex(indicesUS, setIndicesUS, i, "value", e.target.value)} placeholder="5,300.00" /></div>
            <div className="editor-index-item"><label>등락</label><input value={row.change} onChange={e => updateIndex(indicesUS, setIndicesUS, i, "change", e.target.value)} placeholder="+14.4" /></div>
            <div className="editor-index-item"><label>등락률</label><input value={row.pct} onChange={e => updateIndex(indicesUS, setIndicesUS, i, "pct", e.target.value)} placeholder="+0.3%" /></div>
          </div>
        ))}
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8, marginTop: 14 }}>🇰🇷 한국 증시</div>
        {indicesKR.map((row, i) => (
          <div key={i} className="editor-index-grid" style={{ marginBottom: 8, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
            <div className="editor-index-item"><label>지수명</label><input value={row.name} onChange={e => updateIndex(indicesKR, setIndicesKR, i, "name", e.target.value)} /></div>
            <div className="editor-index-item"><label>종가</label><input value={row.value} onChange={e => updateIndex(indicesKR, setIndicesKR, i, "value", e.target.value)} placeholder="2,726.68" /></div>
            <div className="editor-index-item"><label>등락</label><input value={row.change} onChange={e => updateIndex(indicesKR, setIndicesKR, i, "change", e.target.value)} placeholder="+3.22" /></div>
            <div className="editor-index-item"><label>등락률</label><input value={row.pct} onChange={e => updateIndex(indicesKR, setIndicesKR, i, "pct", e.target.value)} placeholder="+0.1%" /></div>
          </div>
        ))}
      </div>

      {/* 3. 히트맵 */}
      <div className="editor-section">
        <div className="editor-section-title"><span className="es-num">③</span> 히트맵 이미지</div>
        <div className="nl-heatmap-grid">
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>S&P 500 히트맵</div>
            <div className="editor-image-slot" onClick={() => fileRefs.current.heatSP?.click()}>
              {uploading.heatSP ? <span>업로드 중...</span> : heatmapSP ? <img src={heatmapSP} alt="SP500" /> : <><span style={{ fontSize: 24 }}>🗺️</span><span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>클릭하여 업로드</span></>}
            </div>
            <input ref={el => fileRefs.current.heatSP = el} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageSelect(e, setHeatmapSP, "heatSP")} />
            {heatmapSP && <button onClick={() => setHeatmapSP("")} style={{ marginTop: 4, fontSize: 11, color: "var(--accent-red)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>제거</button>}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>코스피 히트맵</div>
            <div className="editor-image-slot" onClick={() => fileRefs.current.heatKR?.click()}>
              {uploading.heatKR ? <span>업로드 중...</span> : heatmapKospi ? <img src={heatmapKospi} alt="KOSPI" /> : <><span style={{ fontSize: 24 }}>🗺️</span><span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>클릭하여 업로드</span></>}
            </div>
            <input ref={el => fileRefs.current.heatKR = el} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageSelect(e, setHeatmapKospi, "heatKR")} />
            {heatmapKospi && <button onClick={() => setHeatmapKospi("")} style={{ marginTop: 4, fontSize: 11, color: "var(--accent-red)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>제거</button>}
          </div>
        </div>
      </div>

      {/* 4. 인사이트 */}
      <div className="editor-section">
        <div className="editor-section-title"><span className="es-num">④</span> 오늘의 인사이트</div>
        <div className="post-field" style={{ marginBottom: 0 }}>
          <textarea placeholder="오늘 시장의 전체 흐름을 2~3문장으로 요약해주세요." value={overallInsight} onChange={e => setOverallInsight(e.target.value)} rows={3} />
        </div>
      </div>

      {/* 5. 만화 이미지 */}
      <div className="editor-section">
        <div className="editor-section-title"><span className="es-num">⑤</span> 오늘의 한컷 (만화)</div>
        <div className="editor-image-slot" onClick={() => fileRefs.current.comic?.click()}>
          {uploading.comic ? <span>업로드 중...</span> : comicUrl ? <img src={comicUrl} alt="만화" /> : <><span style={{ fontSize: 24 }}>🎨</span><span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>클릭하여 만화 이미지 업로드 (최대 5MB)</span></>}
        </div>
        <input ref={el => fileRefs.current.comic = el} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageSelect(e, setComicUrl, "comic")} />
        {comicUrl && <button onClick={() => setComicUrl("")} style={{ marginTop: 4, fontSize: 11, color: "var(--accent-red)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>제거</button>}
      </div>

      {/* 6. 경제 뉴스 */}
      <div className="editor-section">
        <div className="editor-section-title"><span className="es-num">⑥</span> 오늘의 경제 뉴스 TOP 5</div>
        {news.map((n, i) => (
          <div className="editor-news-item" key={i}>
            <div className="editor-news-header">
              <span className="editor-news-num">뉴스 #{i + 1}</span>
              {news.length > 1 && <button className="editor-remove-btn" onClick={() => setNews(news.filter((_, j) => j !== i))}>✕</button>}
            </div>
            <div className="post-field"><label>제목</label><input placeholder="뉴스 제목" value={n.title} onChange={e => updateNews(i, "title", e.target.value)} /></div>
            <div className="post-field"><label>요약 (평어체)</label><textarea placeholder="~했다, ~이다 형태로 요약" value={n.summary} onChange={e => updateNews(i, "summary", e.target.value)} rows={2} /></div>
            <div className="post-field"><label>해석 (경어체)</label><textarea placeholder="~합니다, ~될 것으로 보입니다 형태의 해석" value={n.interpretation} onChange={e => updateNews(i, "interpretation", e.target.value)} rows={2} /></div>
            <div className="post-field" style={{ marginBottom: 0 }}><label>원본 링크</label><input placeholder="https://..." value={n.link} onChange={e => updateNews(i, "link", e.target.value)} /></div>
          </div>
        ))}
        {news.length < 7 && (
          <button className="editor-add-btn" onClick={() => setNews([...news, { ...emptyNews }])}>
            + 뉴스 추가
          </button>
        )}
      </div>

      {/* 7. 관전포인트 */}
      <div className="editor-section">
        <div className="editor-section-title"><span className="es-num">⑦</span> 오늘의 관전 포인트</div>
        {watchpoints.map((wp, i) => (
          <div className="editor-watchpoint-row" key={i}>
            <span style={{ fontSize: 14 }}>📌</span>
            <input className="post-field"
              style={{ flex: 1, padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 0 }}
              placeholder={`관전 포인트 ${i + 1}`} value={wp}
              onChange={e => { const c = [...watchpoints]; c[i] = e.target.value; setWatchpoints(c); }}
            />
            {watchpoints.length > 1 && <button className="editor-remove-btn" onClick={() => setWatchpoints(watchpoints.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        {watchpoints.length < 6 && (
          <button className="editor-add-btn" onClick={() => setWatchpoints([...watchpoints, ""])}>
            + 포인트 추가
          </button>
        )}
      </div>

      {/* 추가 본문 (선택) */}
      <div className="editor-section">
        <div className="editor-section-title">📝 추가 본문 (선택)</div>
        <div className="post-field" style={{ marginBottom: 0 }}>
          <textarea placeholder="추가로 본문에 넣고 싶은 내용이 있다면 작성하세요" value={content} onChange={e => setContent(e.target.value)} rows={5} />
        </div>
      </div>

      <div className="post-actions">
        <button className="post-btn primary" onClick={handleSave} disabled={saving}>
          {saving ? "저장 중..." : (existing ? "수정 완료" : "게시하기")}
        </button>
        <button className="post-btn secondary" onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}

// ─── Auth Modal (Firebase: 구글 로그인 + 이메일/비번) ────────────
function AuthModal({ onClose, onLogin }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const { signInWithPopup, GoogleAuthProvider } = await import("firebase/auth");
      const auth = await getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      onLogin({ email: u.email, name: u.displayName || u.email.split("@")[0], uid: u.uid, photoURL: u.photoURL });
      onClose();
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        setError("구글 로그인에 실패했습니다. 다시 시도해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
        <button className="auth-close" onClick={onClose}>✕</button>
        <div style={{ fontSize: 36, textAlign: "center", marginBottom: 8 }}>🥜</div>
        <h3>호두머니 로그인</h3>
        <div className="auth-sub">Google 계정으로 간편하게 시작하세요</div>

        <button onClick={handleGoogleLogin} disabled={loading}
          style={{ width: "100%", padding: "13px", border: "1px solid var(--border)", borderRadius: 10, background: "white", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-primary)", transition: "all 0.15s", opacity: loading ? 0.6 : 1 }}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          {loading ? "로그인 중..." : "Google로 계속하기"}
        </button>

        {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
          로그인 시 호두머니의 서비스 이용약관에 동의하게 됩니다.
        </p>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────
const VALID_CODES = ["MZHODU"];
const MAX_FREE_ANALYSES = 3;

export default function App() {
  const [activePage, setActivePage] = useState("market");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchedTicker, setSearchedTicker] = useState("");
  const [usageCount, setUsageCount] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeShown, setWelcomeShown] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState(null);
  const [user, setUser] = useState(null); // { email, name, uid, photoURL }
  const [showAuth, setShowAuth] = useState(null); // null | "login" | "signup"
  const [watchlist, setWatchlist] = useState([]); // [{ ticker, name, addedAt }]
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // 관심종목 Firestore에서 로드 (유저 변경 시)
  useEffect(() => {
    if (!user?.uid) { setWatchlist([]); return; }
    let cancelled = false;
    setWatchlistLoading(true);
    (async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const db = await getFirebaseFirestore();
        const snap = await getDoc(doc(db, "watchlists", user.uid));
        if (!cancelled && snap.exists()) {
          setWatchlist(snap.data().items || []);
        }
      } catch (e) {
        console.error("Watchlist load error:", e);
      } finally {
        if (!cancelled) setWatchlistLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  // Firestore에 관심종목 저장
  const saveWatchlistToFirestore = useCallback(async (list) => {
    setWatchlist(list);
    if (!user?.uid) return;
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      const db = await getFirebaseFirestore();
      await setDoc(doc(db, "watchlists", user.uid), { items: list, updatedAt: new Date().toISOString() });
    } catch (e) {
      console.error("Watchlist save error:", e);
    }
  }, [user?.uid]);

  const addToWatchlist = useCallback((ticker, name) => {
    if (!user) return false;
    if (watchlist.some(w => w.ticker === ticker)) return false;
    const newList = [...watchlist, { ticker, name: name || ticker, addedAt: new Date().toISOString() }];
    saveWatchlistToFirestore(newList);
    return true;
  }, [user, watchlist, saveWatchlistToFirestore]);

  const removeFromWatchlist = useCallback((ticker) => {
    const newList = watchlist.filter(w => w.ticker !== ticker);
    saveWatchlistToFirestore(newList);
  }, [watchlist, saveWatchlistToFirestore]);

  const isInWatchlist = useCallback((ticker) => {
    return watchlist.some(w => w.ticker === ticker);
  }, [watchlist]);

  // Firebase 로그인 상태 유지 (페이지 새로고침 시 자동 복원)
  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      try {
        const { onAuthStateChanged } = await import("firebase/auth");
        const auth = await getFirebaseAuth();
        unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            setUser({
              email: firebaseUser.email,
              name: firebaseUser.displayName || firebaseUser.email.split("@")[0],
              uid: firebaseUser.uid,
              photoURL: firebaseUser.photoURL,
            });
          } else {
            setUser(null);
          }
        });
      } catch (e) {
        // Firebase 미설정 시 무시
      }
    })();
    return () => unsubscribe();
  }, []);

  // Show welcome popup when entering company tab for the first time
  const handlePageChange = (pageId) => {
    if (pageId === "company") {
      setSearchedTicker(""); // always reset to search screen
      if (!welcomeShown && !isUnlocked) {
        setShowWelcome(true);
        setWelcomeShown(true);
      }
    }
    setActivePage(pageId);
    setSidebarOpen(false);
  };

  const handleSearchSelect = (ticker) => {
    if (!isUnlocked && usageCount >= MAX_FREE_ANALYSES) {
      setShowPaywall(true);
      return;
    }
    setSearchedTicker(ticker);
    setActivePage("company");
  };

  const handleQuickSearch = (ticker) => {
    if (!isUnlocked && usageCount >= MAX_FREE_ANALYSES) {
      setShowPaywall(true);
      return;
    }
    setSearchedTicker(ticker);
    setActivePage("company");
  };

  const handleUsageConsume = () => {
    if (isUnlocked) return;
    const newCount = usageCount + 1;
    setUsageCount(newCount);
    const remaining = MAX_FREE_ANALYSES - newCount;
    if (remaining > 0) {
      setNoticeMsg(`무료 사용 횟수 ${remaining}회 남았습니다`);
    } else {
      setNoticeMsg("무료 사용 횟수를 모두 사용했습니다");
    }
  };

  const handleCodeSubmit = (code) => {
    if (VALID_CODES.includes(code.toUpperCase())) {
      setIsUnlocked(true);
      setNoticeMsg("무제한 이용권이 활성화되었습니다!");
      return true;
    }
    return false;
  };

  const pageTitle = {
    market: "시장 동향", company: "기업 분석", briefing: "호두 브리핑",
    etf: "ETF 단일 분석", "etf-compare": "ETF 비교 분석",
    correlation: "상관관계 분석", backtest: "백테스트", watchlist: "관심 종목",
  };

  const usageBadgeClass = isUnlocked ? "usage-badge unlimited" : (usageCount >= MAX_FREE_ANALYSES ? "usage-badge warning" : "usage-badge");
  const usageBadgeText = isUnlocked ? "무제한" : `${usageCount}/${MAX_FREE_ANALYSES}회`;

  return (
    <div className="app-container">
      <style>{styles}</style>
      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* Welcome popup - shows once when first entering company tab */}
      {showWelcome && !isUnlocked && (
        <div className="paywall-overlay" onClick={() => setShowWelcome(false)}>
          <div className="paywall-card" onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
            <button className="paywall-close" onClick={() => setShowWelcome(false)}>✕</button>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
            <h3>기업 분석 {MAX_FREE_ANALYSES}회 무료!</h3>
            <p>기업 분석 기능은 <strong>{MAX_FREE_ANALYSES}회</strong>까지 무료로 이용 가능합니다.<br />이후에는 이용권을 구매하시면 무제한으로 사용할 수 있어요.</p>
            <button className="paywall-submit" onClick={() => setShowWelcome(false)}>확인</button>
          </div>
        </div>
      )}

      {showPaywall && (
        <PaywallModal
          usageCount={usageCount}
          maxFree={MAX_FREE_ANALYSES}
          onCodeSubmit={handleCodeSubmit}
          onClose={() => setShowPaywall(false)}
        />
      )}

      {/* Centered usage notice */}
      {noticeMsg && <UsageNotice message={noticeMsg} onClose={() => setNoticeMsg(null)} />}

      {/* Auth modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(null)} onLogin={(u) => setUser(u)} />}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-logo" onClick={() => handlePageChange("market")}>
          <div className="logo-icon">🥜</div>
          <div className="logo-text">HODU MONEY</div>
          <div className="logo-sub">투자를 쉽게 정리합니다</div>
        </div>
        {/* 로그인/회원가입 */}
        {user ? (
          <div style={{ padding: "12px 12px 4px" }}>
            <div className="auth-user">
              <span>👤</span>
              <span className="auth-user-email">{user.name || user.email}</span>
              <button className="auth-logout" onClick={async () => {
                try {
                  const { signOut } = await import("firebase/auth");
                  const auth = await getFirebaseAuth();
                  await signOut(auth);
                } catch (e) {}
                setUser(null);
              }}>로그아웃</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", marginTop: 6, lineHeight: 1.4 }}>
              ⭐ 관심종목을 등록하고 한눈에 확인하세요
            </div>
          </div>
        ) : (
          <div style={{ padding: "12px 12px 4px" }}>
            <div className="sidebar-item" onClick={() => setShowAuth("login")} style={{ background: "#5D4037", color: "white", borderRadius: "var(--radius-sm)", justifyContent: "center", fontWeight: 700 }}>
              <span className="item-icon">👤</span><span>로그인 / 회원가입</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", marginTop: 6, lineHeight: 1.4 }}>
              로그인하면 관심종목을 등록할 수 있어요
            </div>
          </div>
        )}
        <div className="sidebar-divider" />
        <div className="sidebar-section">
          <div className="sidebar-section-label">분석 도구</div>
          {MENU_ITEMS.map(item => (
            <div key={item.id} className={`sidebar-item ${activePage === item.id ? "active" : ""}`} onClick={() => handlePageChange(item.id)}>
              <span className="item-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "company" && <span className="badge-soon" style={{ background: "#FFF0F1", color: "#F04452" }}>유료</span>}
              {item.id !== "company" && !item.ready && <span className="badge-soon">준비중</span>}
            </div>
          ))}
        </div>
        <div className="sidebar-divider" />
        <div className="sidebar-section">
          <div className="sidebar-section-label">정보</div>
          <div className="sidebar-item"><span className="item-icon">📖</span><span>사용 가이드</span></div>
          <div className="sidebar-item"><span className="item-icon">💬</span><span>문의하기</span></div>
        </div>
        <div style={{ padding: "12px 24px" }}>
          <div className={usageBadgeClass}>
            {isUnlocked ? "✓ " : "🔑 "}기업분석 {usageBadgeText}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
            <div className="top-bar-title">{pageTitle[activePage]}</div>
          </div>
          {activePage === "company" && searchedTicker && <SearchBox onSelect={handleSearchSelect} />}
          {!user && (
            <button onClick={() => setShowAuth("login")} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "white", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)", transition: "all 0.15s", whiteSpace: "nowrap" }}>로그인</button>
          )}
          {user && (
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
              <span>👤</span> {user.name || user.email.split("@")[0]}
            </div>
          )}
        </div>

        {activePage === "market" && <MarketPage />}
        {activePage === "company" && (
          searchedTicker
            ? <CompanyPage searchTicker={searchedTicker} onUsageConsume={handleUsageConsume} user={user} isInWatchlist={isInWatchlist} addToWatchlist={addToWatchlist} removeFromWatchlist={removeFromWatchlist} />
            : <CompanyPage searchTicker={null} onQuickSearch={handleQuickSearch} user={user} isInWatchlist={isInWatchlist} addToWatchlist={addToWatchlist} removeFromWatchlist={removeFromWatchlist} />
        )}
        {activePage === "briefing" && <BriefingPage user={user} />}
        {activePage === "etf" && <ComingSoonPage icon="📦" title="ETF 단일 분석" />}
        {activePage === "etf-compare" && <ComingSoonPage icon="⚖️" title="ETF 비교 분석" />}
        {activePage === "correlation" && <ComingSoonPage icon="🔗" title="상관관계 분석" />}
        {activePage === "backtest" && <ComingSoonPage icon="⏪" title="백테스트" />}
        {activePage === "watchlist" && <WatchlistPage user={user} onLogin={() => setShowAuth("login")} onSearch={(ticker) => { setSearchedTicker(ticker); setActivePage("company"); }} watchlist={watchlist} addToWatchlist={addToWatchlist} removeFromWatchlist={removeFromWatchlist} />}
      </main>
    </div>
  );
}
