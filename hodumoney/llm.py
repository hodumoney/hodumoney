"""Gemini로 오늘의 주제를 고르고(1단계), 근거 원문에서 숫자를 확인한다(2단계)."""
import json
import re
import time

import requests

GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

BREADTH = {"넓음": 0, "보통": 1, "좁음": 2}
REASONS = ["시의성", "범용성", "필수 지식"]
TAGS = ["미국 주식", "ETF", "한 장 비교", "투자 공부", "절세·계좌", "연금", "경제 상식", "시장 흐름"]

PROMPT = """너는 인스타그램 경제·투자 계정 '호두머니(@hodu.money)'의 콘텐츠 기획자다.

[호두머니 콘텐츠 형식]
- 한 장짜리 인포그래픽이 기본이다(내용이 길면 2~3장까지). 카드뉴스 여러 장이 아니다.
- 한 장 구성: 왼쪽 위 작은 태그(예: 미국 주식, ISA, 한 장 비교, 투자 공부) / 큰 제목 / 메인 도표 1개(도넛, 막대, 선, 표, 트리맵 등) / 보조 숫자 박스 2~3개 / 맨 아래 결론 두 줄 / 출처 한 줄.
- 지난 게시물 예: '주식 대부분은 시장을 못 이긴다'(지수를 이긴 종목 비율 도넛), 'VOO vs VTI'(비교표+수익률 선), '손해보지 않는 투자법'(보유 기간별 수익률 막대), '달러의 시대는 끝?'(결제 통화 비중 트리맵+외환보유액 추이), 'ISA 3단 ETF 조합'.
- 독자는 한국 개인투자자(2030~40대 직장인 중심). 장기투자를 지향한다. 매수·매도 권유는 하지 않는다.

[오늘 날짜] {today}
[이번 달 일정 메모] {calendar}

[해야 할 일]
아래 [수집 데이터]를 근거로 주제 후보 {n_cand}개를 만들고 좋은 순서대로 정리해라.

[좋은 주제의 조건: 셋 중 하나 이상이 강해야 한다]
1. 시의성: 지금 뉴스·시장·제도 변화와 이어져 있어 "왜 지금 이걸 봐야 하는지"가 분명하다. (예: 금리 결정, 환율 급등, 세법 개정, 연말 마감 일정, 지수 급락)
2. 범용성: 투자하는 직장인 대부분에게 해당된다. 특정 집단(연금 수령자, 고액 자산가, 특정 상품 가입자, 특정 종목 보유자)에만 필요한 주제는 버린다.
3. 필수 지식: 시의성·범용성이 약해도 투자·경제를 이해하는 데 꼭 필요한 기본 개념이면 괜찮다. (예: 복리, 분산, 환율과 해외투자, 인플레이션)
- 너무 깊거나 전문적인 주제(세부 세법 조문, 파생상품 구조, 특정 산업 공급망 상세)는 버린다.
- 한 장 도표로 핵심이 보이는 주제가 좋다. 숫자 하나 또는 비교 하나로 요약되는 것.

[소스별 비중]
- 시의성 신호: 경제·증권 뉴스(한국경제·매일경제), 구글 트렌드, 네이버 검색량 급등, 유튜브에서 평소보다 조회수가 크게 튄 영상
- 도표 재료: 차트 블로그·해외 리서치(A Wealth of Common Sense, Bilello, Visual Capitalist, Of Dollars And Data, Apollo 등). 해외 자료는 한국 투자자 관점으로 바꿔서 제안한다.
- 지식iN 질문은 보조 신호다. 여러 질문에서 반복되는 공통 고민을 찾는 데만 쓴다.
- 여러 소스에서 동시에 보이는 주제는 가산점.

[규칙]
1. 종목 매수·매도 추천, 단타·레버리지 매매 권유, 급등주 소개는 넣지 않는다. 레버리지는 위험을 알리는 관점만.
2. 시장 흐름·개별 기업 주제는 합쳐서 최대 {max_market}개.
3. [이미 다룬 주제]와 [최근 추천 기록]에 있는 주제와 같거나 거의 같은 주제는 절대 넣지 않는다. 제목만 바꾼 같은 주제도 안 된다. 매일 새로운 주제를 낸다. 같은 소재라도 질문이 다르면 괜찮다(예: 'VOO vs VTI'를 다뤘어도 'S&P500 상위 10종목 비중 변화'는 다른 주제).
4. 숫자는 [수집 데이터]에 있는 것만 쓴다. 없으면 '확인 필요'라고 쓰고 numbers_needed에 어디서 확인할지 적는다. 지어내지 마라.
5. evidence에는 [수집 데이터]에 있는 URL만 넣는다(1~3개). 도표 숫자가 들어 있을 만한 기사·리서치 원문 URL을 우선한다.
6. 우선순위: A=조건이 강하고 한 장으로 잘 보이는 주제, B=좋은 후보, C=참고. A는 {n_a}개 안팎.
7. tag는 다음 중 하나: {tags}
8. 문장은 쉬운 한국어로 짧고 구체적으로. 제목은 이미지 맨 위에 크게 쓸 수 있게 15자 안팎.

[출력 형식] 아래 JSON만 출력한다.
{{
  "today_summary": "오늘 수집 데이터에서 보이는 흐름 2~3문장",
  "topics": [
    {{
      "priority": "A|B|C",
      "tag": "...",
      "title": "이미지 제목안",
      "reason": "시의성|범용성|필수 지식 (가장 강한 것 하나)",
      "why_now": "왜 지금 이 주제인지, 어떤 신호를 어디서 봤는지",
      "audience": "누가 보면 좋은지 한 줄",
      "breadth": "넓음|보통|좁음",
      "summary": "핵심 내용 2~3문장",
      "chart_idea": "메인 도표 1개 구성 (도표 종류, 가로·세로에 무엇, 강조할 숫자)",
      "sub_points": ["보조 숫자 박스에 넣을 내용 2~3개"],
      "bottom_line": "맨 아래 결론 두 줄 초안 (권유 없이)",
      "numbers_needed": ["카드에 쓸 숫자 — 어디서 확인하는지"],
      "data_source": "원문 데이터 출처(기관·보고서·사이트 이름)",
      "pages": "1장|2장|3장",
      "evidence": ["URL", "..."]
    }}
  ]
}}

[이미 다룬 주제]
{published}

[최근 추천 기록]
{history}

[수집 데이터]
{data}
"""

RESEARCH_PROMPT = """아래는 인포그래픽 주제와, 그 근거가 되는 원문 페이지들의 본문이다.
이 주제의 한 장 인포그래픽에 쓸 수 있는 숫자·사실을 원문에서만 뽑아라. 최대 6개.

[주제] {title}
[핵심 내용] {summary}
[도표 아이디어] {chart}

규칙:
- 원문에 실제로 적힌 내용만. 계산하거나 추측하지 마라.
- quote는 원문 문장을 한 글자도 바꾸지 말고 그대로 복사한 짧은 구절(숫자를 포함, 200자 이내). 번역하지 마라.
- fact는 그 내용을 한국어 한 줄로 쓴다. 기준일·단위가 원문에 있으면 함께 적는다.
- 관련 숫자가 없으면 빈 배열.

JSON만 출력: {{"facts": [{{"fact": "...", "quote": "...", "url": "..."}}]}}

[원문]
{pages}
"""


def build_prompt(data, published, history, calendar, today, n=5):
    return PROMPT.format(
        today=today, calendar=calendar or "없음", n_cand=n + 3, max_market=1, n_a=max(2, n // 2),
        tags=", ".join(TAGS),
        published="\n".join(f"- {p}" for p in published) or "없음",
        history="\n".join(f"- {h}" for h in history) or "없음",
        data=json.dumps(data, ensure_ascii=False, indent=1),
    )


def build_research_prompt(topic, pages):
    body = "\n\n".join(f"### URL: {u}\n{t}" for u, t in pages)
    return RESEARCH_PROMPT.format(title=topic["title"], summary=topic["summary"], chart=topic["chart_idea"], pages=body)


def extract_json(text):
    """모델 응답에서 JSON 부분만 안전하게 꺼낸다."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, flags=re.S)
        if not m:
            raise
        return json.loads(m.group(0))


def _as_list(x):
    if isinstance(x, list):
        return [str(i).strip() for i in x if str(i).strip()]
    return [str(x).strip()] if str(x or "").strip() else []


FIELDS = ["priority", "tag", "title", "reason", "why_now", "audience", "breadth", "summary", "chart_idea",
          "sub_points", "bottom_line", "numbers_needed", "data_source", "pages", "evidence"]


def _norm_title(s):
    return re.sub(r"[^0-9a-z가-힣]", "", str(s).lower())


def is_duplicate(title, published, threshold=0.75):
    """제목이 이미 다룬 주제와 거의 같으면 True (글자 겹침 기준의 마지막 안전장치)."""
    a = _norm_title(title)
    if len(a) < 4:
        return False
    for p in published:
        b = _norm_title(p)
        if len(b) < 4:
            continue
        if a in b or b in a:
            return True
        grams = lambda s: {s[i:i + 2] for i in range(len(s) - 1)}  # noqa: E731
        ga, gb = grams(a), grams(b)
        if ga and gb and len(ga & gb) / min(len(ga), len(gb)) >= threshold:
            return True
    return False


def validate(result, allowed_urls, n, published=(), recent=()):
    topics = []
    for t in (result.get("topics") or []):
        t = {k: (t.get(k) if t.get(k) is not None else "") for k in FIELDS}
        if (not str(t["title"]).strip() or is_duplicate(t["title"], published)
                or is_duplicate(t["title"], recent, 0.6)):   # 최근 보낸 주제는 더 엄격하게
            continue
        t["priority"] = str(t["priority"]).strip().upper()[:1] or "B"
        if t["priority"] not in "ABC":
            t["priority"] = "B"
        for k in ("sub_points", "numbers_needed"):
            t[k] = _as_list(t[k])[:4]
        # 모델이 만들어낸 링크는 버리고, 실제 수집한 링크만 남긴다
        t["evidence"] = [u for u in _as_list(t["evidence"]) if u in allowed_urls][:3]
        b = str(t["breadth"]).strip()
        t["breadth"] = b if b in BREADTH else "보통"
        r = str(t["reason"]).strip()
        t["reason"] = r if r in REASONS else "범용성"
        if t["breadth"] == "좁음" and t["reason"] != "필수 지식":
            continue  # 특정 사람에게만 필요한 주제는 버린다
        if t["priority"] == "A" and t["breadth"] == "좁음":
            t["priority"] = "B"
        t["pages"] = str(t["pages"]).strip() or "1장"
        t["facts"] = []
        topics.append(t)
    order = {"A": 0, "B": 1, "C": 2}
    topics.sort(key=lambda x: (order[x["priority"]], BREADTH[x["breadth"]]))  # 안정 정렬로 모델 순위 유지
    return {"today_summary": str(result.get("today_summary", "")).strip(), "topics": topics[:n]}


def _squash(s):
    return re.sub(r"\s+", " ", str(s)).strip().lower()


def verify_facts(raw, pages):
    """quote가 실제 원문에 그대로 있는 것만 남긴다 (지어낸 숫자 방지)."""
    texts = {u: _squash(t) for u, t in pages}
    out = []
    for f in (raw.get("facts") or [])[:8]:
        q, u = _squash(f.get("quote", "")), str(f.get("url", "")).strip()
        if len(q) < 8 or not re.search(r"\d", q):
            continue
        hit = u if u in texts and q in texts[u] else next((k for k, v in texts.items() if q in v), None)
        if hit:
            out.append({"fact": str(f.get("fact", "")).strip(), "quote": str(f.get("quote", "")).strip(), "url": hit})
    return out[:6]


def call_gemini(prompt, api_key, models, temperature=0.6):
    last_err = None
    for model in models:
        for attempt in range(3):
            try:
                r = requests.post(
                    GEMINI.format(model=model),
                    headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                    json={"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                          "generationConfig": {"responseMimeType": "application/json", "temperature": temperature}},
                    timeout=150,
                )
                if r.status_code in (429, 500, 502, 503, 504):
                    last_err = f"{model} HTTP {r.status_code}"
                    time.sleep(20 * (attempt + 1))
                    continue
                if r.status_code in (400, 403, 404):
                    last_err = f"{model} HTTP {r.status_code}: {r.text[:200]}"
                    break  # 이 모델은 안 됨 → 다음 모델로
                r.raise_for_status()
                parts = r.json()["candidates"][0]["content"]["parts"]
                text = "".join(p.get("text", "") for p in parts)
                return extract_json(text), model
            except (requests.RequestException, KeyError, ValueError) as e:
                last_err = f"{model} {e.__class__.__name__}: {e}"
                time.sleep(5)
    raise RuntimeError(f"Gemini 호출 실패: {last_err}")
