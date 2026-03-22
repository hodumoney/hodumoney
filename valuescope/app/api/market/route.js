// app/api/market/route.js
export async function GET() {
  // 시장 동향은 현재 프론트엔드 샘플 데이터를 사용
  // 추후 실시간 데이터 연동 예정
  return Response.json({ status: "ok" });
}
