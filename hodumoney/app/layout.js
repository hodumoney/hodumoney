// app/layout.js
export const metadata = {
  title: "호두머니 기업분석",
  description: "미국·한국 주식 기업분석을 한 번에",
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
