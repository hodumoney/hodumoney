import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
  { id: "etf", label: "ETF 단일 분석", icon: "📦", ready: false },
  { id: "etf-compare", label: "ETF 비교 분석", icon: "⚖️", ready: false },
  { id: "correlation", label: "상관관계 분석", icon: "🔗", ready: false },
  { id: "backtest", label: "백테스트", icon: "⏪", ready: false },
  { id: "watchlist", label: "관심 종목", icon: "⭐", ready: false },
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
  .sidebar-logo { padding: 0 24px 28px; display: flex; align-items: center; gap: 10px; }
  .logo-icon {
    width: 36px; height: 36px; background: linear-gradient(135deg, #3182F6, #1B64DA);
    border-radius: 10px; display: flex; align-items: center; justify-content: center;
    font-size: 18px; color: white; font-weight: 800;
  }
  .logo-text { font-size: 17px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.3px; }
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

  .country-label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px; padding: 4px 10px; background: var(--bg-primary); border-radius: 6px; }
  .country-flag { font-size: 15px; }

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
  .click-hint { position: absolute; top: 8px; right: 10px; font-size: 10px; color: var(--text-tertiary); opacity: 0; transition: opacity 0.2s ease; }
  .index-card.clickable:hover .click-hint, .econ-card.clickable:hover .click-hint { opacity: 1; }

  .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .data-table thead th { text-align: right; padding: 10px 12px; font-weight: 600; color: var(--text-tertiary); font-size: 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .data-table thead th:first-child { text-align: left; }
  .data-table tbody td { text-align: right; padding: 11px 12px; font-weight: 500; border-bottom: 1px solid #F2F3F5; font-variant-numeric: tabular-nums; }
  .data-table tbody td:first-child { text-align: left; color: var(--text-secondary); font-weight: 600; }
  .data-table tbody tr:hover { background: var(--bg-hover); }
  .data-table tbody tr:last-child td { border-bottom: none; }
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

// ─── Search Box Component (NEW) ─────────────────────────────────
function SearchBox({ onSelect }) {
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
    <div className="search-wrapper" ref={wrapperRef}>
      <div className="search-box">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="티커 또는 기업명 검색 (예: NVDA, Apple)"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
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
  const [period, setPeriod] = useState("1Y");
  const [chartData, setChartData] = useState(item?.history || []);
  const [chartLoading, setChartLoading] = useState(false);
  const [periodChange, setPeriodChange] = useState({ change: item?.change || "-", pct: item?.pct || "-", up: item?.up || false });

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
              <YAxis domain={[min - padding, max + padding]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8B95A1" }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(v < 10 ? 2 : 1)} width={52} />
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
function FinRowCard({ label, values, labels, expanded, onToggle, fmtFn, allowNeg, desc }) {
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
            {fmtFn ? fmtFn(lastVal) : (isNeg ? `(${Math.abs(lastVal).toLocaleString()})` : lastVal.toLocaleString())}
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
            <FinRowCard key={row.key} label={row.label} values={row.values} labels={labels} expanded={expandedKey === row.key} onToggle={() => toggle(row.key)} allowNeg={row.allowNeg} desc={row.desc} />
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
            <FinRowCard key={row.key} label={row.label} values={row.values} labels={labels} expanded={expandedKey === row.key} onToggle={() => toggle(row.key)} fmtFn={row.fmt} desc={row.desc} />
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

      <div className="section-header fade-up"><div className="section-title">주가지수</div></div>

      {showUS && liveIdxUS.length > 0 && (
        <div className="fade-up fade-up-d1">
          <div className="country-label"><span className="country-flag">🇺🇸</span> 미국</div>
          <div className="index-strip">
            {liveIdxUS.map((idx, i) => (
              <div className={`index-card index-card-lg clickable ${isSelected("idxUS", idx.name) ? "selected" : ""}`} key={i} onClick={() => toggle("idxUS", idx)}>
                <span className="click-hint">{isSelected("idxUS", idx.name) ? "닫기" : "차트"}</span>
                <div className="index-name">{idx.name}</div>
                <div className="index-value">{idx.value}</div>
                <div className={`index-change ${idx.up ? "up" : "down"}`}>{idx.change} ({idx.pct})</div>
              </div>
            ))}
          </div>
          {selectedIndex && selectedIndex.group === "idxUS" && <InlineChart item={selectedIndex} onClose={() => setSelectedIndex(null)} />}
        </div>
      )}

      {showKR && liveIdxKR.length > 0 && (
        <div className="fade-up fade-up-d1" style={{ marginTop: showUS ? 8 : 0 }}>
          <div className="country-label"><span className="country-flag">🇰🇷</span> 한국</div>
          <div className="index-strip">
            {liveIdxKR.map((idx, i) => (
              <div className={`index-card index-card-lg clickable ${isSelected("idxKR", idx.name) ? "selected" : ""}`} key={i} onClick={() => toggle("idxKR", idx)}>
                <span className="click-hint">{isSelected("idxKR", idx.name) ? "닫기" : "차트"}</span>
                <div className="index-name">{idx.name}</div>
                <div className="index-value">{idx.value}</div>
                <div className={`index-change ${idx.up ? "up" : "down"}`}>{idx.change} ({idx.pct})</div>
              </div>
            ))}
          </div>
          {selectedIndex && selectedIndex.group === "idxKR" && <InlineChart item={selectedIndex} onClose={() => setSelectedIndex(null)} />}
        </div>
      )}

      <div className="section-header fade-up fade-up-d2" style={{ marginTop: 20 }}>
        <div><div className="section-title">경제 지표</div><div className="section-subtitle">주요 금리·통화·물가 지표</div></div>
      </div>

      {showUS && liveEconUS.length > 0 && (
        <div className="fade-up fade-up-d2">
          <div className="country-label"><span className="country-flag">🇺🇸</span> 미국</div>
          <div className="econ-grid">
            {liveEconUS.map((ind, i) => (
              <div className={`econ-card ${ind.isStatic ? "" : "clickable"} ${isSelected("econUS", ind.name) ? "selected" : ""}`} key={i} onClick={() => { if (!ind.isStatic) toggle("econUS", ind); }}>
                {!ind.isStatic && <span className="click-hint">{isSelected("econUS", ind.name) ? "닫기" : "차트"}</span>}
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
          <div className="country-label"><span className="country-flag">🇰🇷</span> 한국</div>
          <div className="econ-grid">
            {liveEconKR.map((ind, i) => (
              <div className={`econ-card ${ind.isStatic ? "" : "clickable"} ${isSelected("econKR", ind.name) ? "selected" : ""}`} key={i} onClick={() => { if (!ind.isStatic) toggle("econKR", ind); }}>
                {!ind.isStatic && <span className="click-hint">{isSelected("econKR", ind.name) ? "닫기" : "차트"}</span>}
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
function PriceChart({ ticker, dailyChange }) {
  const [period, setPeriod] = useState("1Y");
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    fetch(`/api/price?symbol=${ticker}&period=${period}`)
      .then(r => r.json())
      .then(d => {
        if (d.points) {
          setChartData(d.points.map(p => {
            const dt = new Date(p.date);
            const yy = String(dt.getFullYear()).slice(-2);
            const mm = String(dt.getMonth() + 1).padStart(2, "0");
            return { date: `${yy}년 ${mm}월`, price: p.price, fullDate: p.date };
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker, period]);

  const color = dailyChange >= 0 ? "#F04452" : "#3182F6";

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
function CompanyPage({ searchTicker, onQuickSearch }) {
  const [viewMode, setViewMode] = useState("quarterly");
  const [activeSection, setActiveSection] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!searchTicker) { setData(null); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(`/api/stock?symbol=${encodeURIComponent(searchTicker)}`)
      .then(r => r.json())
      .then(d => { if (cancelled) return; if (d.error) { setError(d.error); setData(null); } else setData(d); })
      .catch(() => !cancelled && setError("데이터를 불러올 수 없습니다"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [searchTicker]);

  if (!searchTicker) {
    return (
      <div className="content-area">
        <div className="empty-state fade-up">
          <div className="empty-state-icon">🔍</div>
          <h3>기업을 검색해보세요</h3>
          <p>상단 검색창에 티커 또는 기업명을 입력하면<br />재무제표, 밸류에이션, 현금흐름을 한눈에 볼 수 있습니다.</p>
          <div style={{ marginTop: 24, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {["NVDA", "AAPL", "TSLA", "MSFT", "GOOG", "LLY"].map(t => (
              <button key={t} onClick={() => onQuickSearch && onQuickSearch(t)}
                style={{ padding: "8px 16px", borderRadius: 20, border: "1px solid var(--border)", background: "white", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--accent-blue)", transition: "all 0.15s ease" }}>{t}</button>
            ))}
          </div>
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
  const capLabel = data.capRank || data.capClass || "N/A";
  const dropFromHigh = data.yearHigh > 0 ? ((data.price - data.yearHigh) / data.yearHigh * 100) : 0;

  return (
    <div className="content-area">
      <div className="company-hero fade-up">
        <div className="company-info">
          <h2>{data.name}</h2>
          <div className="company-ticker">{data.ticker} · {data.exchange || ""} {data.sector ? `· ${data.sector}` : ""}</div>
          <div className="company-desc">{data.description}</div>
        </div>
        <div className="price-block">
          <div className="price-current">${safeNum(data.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className={`price-change ${data.dailyChange >= 0 ? "positive" : "negative"}`}>
            {data.dailyChange >= 0 ? "+" : ""}{(safeNum(data.dailyChange) * 100).toFixed(2)}% 전일대비
          </div>
        </div>
      </div>

      <PriceChart ticker={data.ticker} dailyChange={data.dailyChange} />

      <div className="stats-grid fade-up fade-up-d1" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { label: "시가총액", value: fmtCap(data.marketCap) },
          { label: "시가총액 분류", value: capLabel },
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
        ⓒ HODU SOLUTION. All Rights Reserved.<br />본 데이터는 참고용이며, 투자 판단의 책임은 투자자 본인에게 있습니다.
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

// ─── Main App ────────────────────────────────────────────────────
export default function App() {
  const [activePage, setActivePage] = useState("market");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchedTicker, setSearchedTicker] = useState("");

  const handleSearchSelect = (ticker) => {
    setSearchedTicker(ticker);
    setActivePage("company");
  };

  const handleQuickSearch = (ticker) => {
    setSearchedTicker(ticker);
    setActivePage("company");
  };

  const pageTitle = {
    market: "시장 동향", company: "기업 분석", etf: "ETF 단일 분석",
    "etf-compare": "ETF 비교 분석", correlation: "상관관계 분석",
    backtest: "백테스트", watchlist: "관심 종목",
  };

  return (
    <div className="app-container">
      <style>{styles}</style>
      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">H</div>
          <div>
            <div className="logo-text">호두머니</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 500, marginTop: 1, letterSpacing: "-0.2px" }}>©호두머니</div>
          </div>
        </div>
        <div className="sidebar-section">
          <div className="sidebar-section-label">분석 도구</div>
          {MENU_ITEMS.map(item => (
            <div key={item.id} className={`sidebar-item ${activePage === item.id ? "active" : ""}`} onClick={() => { setActivePage(item.id); setSidebarOpen(false); }}>
              <span className="item-icon">{item.icon}</span>
              <span>{item.label}</span>
              {!item.ready && <span className="badge-soon">준비중</span>}
            </div>
          ))}
        </div>
        <div className="sidebar-divider" />
        <div className="sidebar-section">
          <div className="sidebar-section-label">정보</div>
          <div className="sidebar-item"><span className="item-icon">📖</span><span>사용 가이드</span></div>
          <div className="sidebar-item"><span className="item-icon">💬</span><span>문의하기</span></div>
        </div>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
            <div className="top-bar-title">{pageTitle[activePage]}</div>
          </div>
          <SearchBox onSelect={handleSearchSelect} />
        </div>

        {activePage === "market" && <MarketPage />}
        {activePage === "company" && (
          searchedTicker
            ? <CompanyPage searchTicker={searchedTicker} />
            : <CompanyPage searchTicker={null} onQuickSearch={handleQuickSearch} />
        )}
        {activePage === "etf" && <ComingSoonPage icon="📦" title="ETF 단일 분석" />}
        {activePage === "etf-compare" && <ComingSoonPage icon="⚖️" title="ETF 비교 분석" />}
        {activePage === "correlation" && <ComingSoonPage icon="🔗" title="상관관계 분석" />}
        {activePage === "backtest" && <ComingSoonPage icon="⏪" title="백테스트" />}
        {activePage === "watchlist" && <ComingSoonPage icon="⭐" title="관심 종목" />}
      </main>
    </div>
  );
}
