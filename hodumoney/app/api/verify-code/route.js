// hodumoney/app/api/verify-code/route.js
// 이용권 코드 검증 API — 프론트엔드에 코드가 노출되지 않음

export const dynamic = "force-dynamic";

// 유효한 코드 목록 (서버에서만 관리)
// Vercel 환경변수 VALID_CODES로도 설정 가능 (쉼표 구분)
const VALID_CODES = (process.env.VALID_CODES || "HODU0418").split(",").map(c => c.trim().toUpperCase());

export async function POST(req) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== "string") {
      return Response.json({ valid: false, error: "코드를 입력해주세요" }, { status: 400 });
    }

    const isValid = VALID_CODES.includes(code.trim().toUpperCase());

    if (isValid) {
      return Response.json({ valid: true, message: "무제한 이용권이 활성화되었습니다!" });
    } else {
      return Response.json({ valid: false, error: "유효하지 않은 코드입니다" });
    }
  } catch (err) {
    return Response.json({ valid: false, error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
