// hodumoney/app/opengraph-image.jsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "호두머니 — 투자를 쉽게 정리합니다";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #FFFBF5 0%, #FFF3E0 50%, #F5F0EB 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* 배경 장식 */}
        <div style={{ position: "absolute", top: 40, right: 60, fontSize: 120, opacity: 0.08, display: "flex" }}>📊</div>
        <div style={{ position: "absolute", bottom: 50, left: 60, fontSize: 100, opacity: 0.06, display: "flex" }}>📈</div>

        {/* 메인 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          <div style={{ fontSize: 80, marginBottom: 8, display: "flex" }}>🥜</div>
          <div style={{ fontSize: 52, fontWeight: 900, color: "#5D4037", letterSpacing: "3px", lineHeight: 1.2, display: "flex" }}>
            HODU MONEY
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 28,
              color: "#8D6E63",
              fontWeight: 500,
              display: "flex",
            }}
          >
            어렵게 느껴지는 투자를 쉽게 정리합니다
          </div>
        </div>

        {/* 하단 URL */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            fontSize: 18,
            color: "#BCAAA4",
            fontWeight: 600,
            letterSpacing: "0.5px",
            display: "flex",
          }}
        >
          hodumoney.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
