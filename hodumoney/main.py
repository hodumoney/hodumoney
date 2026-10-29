"""호두머니 오늘의 주제 브리프 — GitHub Actions에서 매일 실행된다.

순서: 소스 수집 → Gemini가 주제 선정(1단계) → 근거 원문에서 숫자 확인(2단계) → 메일 발송 → 기록 저장
"""
import csv
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import collectors as C
import llm
import mailer
import research

ROOT = Path(__file__).parent
CFG = ROOT / "config"
DATA = ROOT / "data"
HISTORY = DATA / "history.csv"
WEEKDAY = "월화수목금토일"
T0 = time.time()


def log(msg):
    """Actions 로그에 진행 상황을 바로바로 남긴다 (몇 초째인지 함께)."""
    print(f"[{time.time() - T0:5.0f}초] {msg}", flush=True)


def env(name, required=True, default=""):
    v = os.environ.get(name, default).strip()
    if required and not v:
        sys.exit(f"[설정 오류] GitHub Secrets에 {name} 값이 없습니다.")
    return v


def load_lines(path):
    if not path.exists():
        return []
    return [l.strip() for l in path.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]


def load_history(days=180):
    if not HISTORY.exists():
        return []
    cutoff = datetime.now(C.KST).date().toordinal() - days
    out = []
    for r in C.read_csv(HISTORY):
        try:
            if datetime.strptime(r["날짜"], "%Y-%m-%d").date().toordinal() >= cutoff:
                out.append(f"{r['날짜']} {r['주제']}")
        except (KeyError, ValueError):
            continue
    return out


def load_recent_sent(days=180):
    """최근에 보낸 주제 제목과 근거 링크. data/daily/날짜.json 기록에서 읽는다."""
    cutoff = datetime.now(C.KST).date().toordinal() - days
    titles, used = [], set()
    for f in sorted((DATA / "daily").glob("*.json")):
        try:
            if datetime.strptime(f.stem, "%Y-%m-%d").date().toordinal() < cutoff:
                continue
            for t in json.loads(f.read_text(encoding="utf-8")).get("topics", []):
                titles.append(t.get("title", ""))
                used |= {u for u in (t.get("evidence") or []) if isinstance(u, str)}
        except (ValueError, OSError):
            continue
    return [t for t in titles if t], used


def drop_used(obj, used):
    """이전 메일에서 이미 근거로 쓴 기사·글은 오늘 수집 자료에서 뺀다 (같은 글로 같은 주제가 반복되는 것 방지)."""
    if isinstance(obj, dict):
        return {k: drop_used(v, used) for k, v in obj.items()}
    if isinstance(obj, list):
        return [drop_used(v, used) for v in obj if not (isinstance(v, dict) and v.get("url") in used)]
    return obj


def month_calendar(month):
    notes = [f"{r['주제']} ({r['메모']})" if r.get("메모") else r["주제"]
             for r in C.read_csv(CFG / "calendar.csv") if str(month) in [m.strip() for m in r["월"].split("|")]]
    return "; ".join(notes)


def save_history(date_str, topics):
    new = not HISTORY.exists()
    DATA.mkdir(exist_ok=True)
    with open(HISTORY, "a", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["날짜", "우선순위", "카테고리", "주제"])
        for t in topics:
            w.writerow([date_str, t["priority"], t["tag"], t["title"]])


def collect_all():
    data, statuses = {}, {}

    log("수집 시작")
    yt_key = env("YOUTUBE_API_KEY")
    try:
        data["youtube_trending_videos"], statuses["유튜브"] = C.collect_youtube(yt_key, CFG / "channels.csv")
        data["youtube_trending_videos"] = data["youtube_trending_videos"][:40]
    except Exception as e:  # noqa: BLE001
        statuses["유튜브"] = f"실패 ({e.__class__.__name__})"

    log(f"유튜브: {statuses.get('유튜브')}")
    nid, nsec = env("NAVER_CLIENT_ID"), env("NAVER_CLIENT_SECRET")
    try:
        trend, statuses["네이버 검색어트렌드"] = C.collect_naver_trend(nid, nsec, CFG / "keywords.csv")
        data["naver_search_trend (최근7일/이전28일 검색량 배수, 1.3 이상이면 급등)"] = trend
    except Exception as e:  # noqa: BLE001
        statuses["네이버 검색어트렌드"] = f"실패 ({e.__class__.__name__})"
    try:
        kin, statuses["네이버 지식iN"] = C.collect_naver_kin(nid, nsec, CFG / "keywords.csv")
        data["naver_kin_recent_questions (보조 신호: 개인 사연 위주, 반복되는 공통 고민만 참고)"] = kin[:80]
    except Exception as e:  # noqa: BLE001
        statuses["네이버 지식iN"] = f"실패 ({e.__class__.__name__})"

    log(f"네이버: {statuses.get('네이버 검색어트렌드')} / {statuses.get('네이버 지식iN')}")
    feeds, statuses["RSS·웹"] = C.collect_feeds(CFG / "feeds.csv")
    log(f"RSS·웹: {statuses['RSS·웹']}")
    group = lambda g: {k: v for k, v in feeds.items() if v and v[0].get("source_group") == g}  # noqa: E731
    data["news (시의성 신호: 경제·증권 뉴스)"] = group("뉴스")
    data["other_demand_signals (구글 트렌드·레딧 등)"] = group("수요")
    data["chart_and_research_material (도표 재료)"] = group("데이터")
    return data, statuses


def all_urls(obj):
    urls = set()
    if isinstance(obj, dict):
        for v in obj.values():
            urls |= all_urls(v)
    elif isinstance(obj, list):
        for v in obj:
            urls |= all_urls(v)
    elif isinstance(obj, str) and obj.startswith("http"):
        urls.add(obj)
    return urls


def main():
    now = datetime.now(C.KST)
    date_str = now.strftime("%Y-%m-%d")
    date_label = f"{now:%Y.%m.%d} ({WEEKDAY[now.weekday()]})"
    n = int(os.environ.get("TOPICS_PER_DAY", "10") or 10)
    dry = os.environ.get("DRY_RUN", "").strip() == "1"

    gemini_key = env("GEMINI_API_KEY")
    sender = env("GMAIL_ADDRESS", required=not dry)
    app_pw = env("GMAIL_APP_PASSWORD", required=not dry)
    to_addrs = [a.strip() for a in (os.environ.get("MAIL_TO") or sender).split(",") if a.strip()]
    models = [m.strip() for m in os.environ.get("GEMINI_MODELS", "gemini-flash-latest,gemini-flash-lite-latest").split(",") if m.strip()]

    data, statuses = collect_all()
    log("수집 끝: " + json.dumps(statuses, ensure_ascii=False))
    sent_titles, used_urls = load_recent_sent()
    before = len(all_urls(data))
    data = drop_used(data, used_urls)
    statuses["중복 제외"] = f"이전 메일 근거 링크 {before - len(all_urls(data))}개 제외, 최근 보낸 주제 {len(sent_titles)}개와 비교"
    log(statuses["중복 제외"])

    urls = all_urls(data)
    if len(urls) < 5:
        # 수집된 게 거의 없으면 AI가 주제를 지어낼 위험이 있으므로 중단
        data = None

    published = load_lines(CFG / "published.txt")
    prompt = "" if data is None else llm.build_prompt(data, published, load_history(),
                                                       month_calendar(now.month), date_label, n)
    try:
        if data is None:
            raise RuntimeError("수집된 자료가 거의 없습니다. 아래 수집 현황을 확인하세요")
        log("Gemini 주제 선정 시작")
        raw, model = llm.call_gemini(prompt, gemini_key, models)
        log(f"Gemini 주제 선정 끝 ({model})")
        result = llm.validate(raw, urls, n, published, sent_titles)
        if not result["topics"]:
            raise RuntimeError("주제가 비어 있음")
    except Exception as e:  # noqa: BLE001
        msg = f"오늘은 주제 선정에 실패했습니다: {e}"
        log(msg)
        if not dry:
            body = mailer.render_html({"today_summary": msg, "topics": []}, date_label, statuses, "-")
            mailer.send_mail(sender, app_pw, to_addrs, f"[호두머니] 주제 브리핑 실패 · {date_label}", body)
        sys.exit(1)

    log("원문 숫자 확인 시작")
    try:
        statuses["원문 숫자 확인"] = research.enrich(result["topics"], gemini_key, models)
    except Exception as e:  # noqa: BLE001
        statuses["원문 숫자 확인"] = f"실패 ({e.__class__.__name__})"
    log(f"원문 숫자 확인 끝: {statuses['원문 숫자 확인']}")
    body = mailer.render_html(result, date_label, statuses, model)
    attach = mailer.render_csv(result, date_str)
    (DATA / "daily").mkdir(parents=True, exist_ok=True)
    (DATA / "daily" / f"{date_str}.json").write_text(
        json.dumps({"date": date_str, "model": model, "statuses": statuses, **result}, ensure_ascii=False, indent=1),
        encoding="utf-8")

    if dry:
        (ROOT / "preview.html").write_text(body, encoding="utf-8")
        log("DRY_RUN: preview.html 저장, 메일은 보내지 않음")
        return

    mailer.send_mail(sender, app_pw, to_addrs, f"[호두머니] 오늘의 주제 브리핑 · {date_label}",
                     body, attach, f"hodumoney_topics_{date_str}.csv")
    save_history(date_str, result["topics"])
    log(f"발송 완료: {to_addrs}, 주제 {len(result['topics'])}개, 모델 {model}")


if __name__ == "__main__":
    main()
