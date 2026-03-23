# HoduMoney by 호두머니

> 숫자로 기업의 가치를 해석하다

미국·한국 주식 기업분석, 재무제표, 밸류에이션을 한눈에 보여주는 웹 서비스입니다.

---

## 🚀 배포하기 (처음이라면 이대로 따라하세요)

### 1단계: FMP API 키 발급 (무료, 2분)

1. https://financialmodelingprep.com 접속
2. **Get my API Key** 클릭 → 회원가입 (구글 로그인 가능)
3. Dashboard에서 API Key 복사 (예: `abc123def456...`)

### 2단계: GitHub에 코드 올리기 (5분)

1. https://github.com 에서 **New repository** 클릭
2. 이름: `hodumoney` → **Create repository**
3. 터미널(명령 프롬프트)에서:

```bash
# 이 프로젝트 폴더로 이동
cd hodumoney

# Git 초기화 및 푸시
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/내아이디/hodumoney.git
git push -u origin main
```

### 3단계: Vercel에 배포 (3분)

1. https://vercel.com 접속 → **Sign up with GitHub**
2. **Add New Project** → `hodumoney` 레포 선택 → **Import**
3. **Environment Variables** 섹션에서:
   - Name: `FMP_API_KEY`
   - Value: 1단계에서 복사한 API 키
4. **Deploy** 클릭!

✅ 완료! `https://hodumoney.vercel.app` 같은 주소로 접속 가능합니다.

---

## 🛠 로컬에서 개발하기

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일을 열어서 FMP_API_KEY= 뒤에 API 키 입력

# 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 접속

---

## 📁 프로젝트 구조

```
hodumoney/
├── app/
│   ├── layout.js          # HTML 레이아웃, 폰트 설정
│   ├── page.js             # 메인 페이지
│   └── api/
│       ├── stock/route.js  # 기업 분석 데이터 API
│       ├── market/route.js # 시장 동향 API
│       └── search/route.js # 종목 검색 API
├── components/
│   └── App.jsx             # 전체 UI 컴포넌트
├── lib/
│   └── fmp.js              # Financial Modeling Prep API 헬퍼
├── package.json
├── next.config.js
└── .env.example
```

---

## 📊 데이터 소스

- **Financial Modeling Prep** (무료 플랜: 일 250회 호출)
  - 기업 프로필, 시세, 재무제표, 핵심 지표
  - 주요 지수, VIX, 환율

---

## ⓒ HODU SOLUTION
All Rights Reserved. 본 서비스의 데이터는 참고용이며, 투자 판단의 책임은 투자자 본인에게 있습니다.
