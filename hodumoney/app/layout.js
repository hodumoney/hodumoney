// app/layout.js
export const metadata = {
  title: "HoduMoney by 호두머니 — 숫자로 기업의 가치를 해석하다",
  description: "미국·한국 주식 기업분석, ETF 분석, 재무제표, 밸류에이션을 한눈에",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
