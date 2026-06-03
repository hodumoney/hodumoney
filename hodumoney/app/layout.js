// hodumoney/app/layout.jsx

export const metadata = {
  title: "호두머니 — 투자를 쉽게 정리합니다",
  description: "어렵게 느껴지는 투자, 호두머니가 쉽게 정리해드립니다. 핵심 밸류에이션, 재무제표, 시장 동향을 한눈에.",
  keywords: ["호두머니", "기업분석", "주식", "투자", "밸류에이션", "PER", "PBR", "재무제표", "시장동향"],
  authors: [{ name: "호두머니" }],
  openGraph: {
    title: "호두머니 — 투자를 쉽게 정리합니다",
    description: "어렵게 느껴지는 투자, 호두머니가 쉽게 정리해드립니다.",
    url: "https://hodumoney.vercel.app",
    siteName: "호두머니 HODU MONEY",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "호두머니 — 투자를 쉽게 정리합니다",
    description: "어렵게 느껴지는 투자, 호두머니가 쉽게 정리해드립니다.",
  },
  metadataBase: new URL("https://hodumoney.vercel.app"),
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🥜</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  );
}
