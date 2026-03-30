// app/api/briefing/route.js
// 뉴스기록 시트에서 발행된 뉴스레터 목록을 가져옴
import { google } from "googleapis";

export const dynamic = "force-dynamic";

function getSheets() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  );
  return google.sheets({ version: "v4", auth });
}

export async function GET() {
  try {
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) {
      return Response.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const sheets = getSheets();

    // 뉴스기록 시트: [날짜, 제목, 요약, 해석, 링크]
    const logRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "뉴스기록!A:E",
    });

    const rows = logRes.data.values || [];
    if (rows.length < 2) {
      return Response.json([]);
    }

    // 날짜별로 그룹핑 (1행은 헤더)
    const byDate = {};
    for (let i = 1; i < rows.length; i++) {
      const [date, title, summary, interpretation, link] = rows[i];
      if (!date) continue;
      if (!byDate[date]) byDate[date] = { date, articles: [] };
      byDate[date].articles.push({
        title: title || "",
        summary: summary || "",
        interpretation: interpretation || "",
        link: link || "#",
      });
    }

    // 뉴스미리보기 시트에서 overallInsight 가져오기 (있으면)
    let insightsByDate = {};
    try {
      const previewRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "뉴스미리보기!A:C",
      });
      const previewRows = previewRes.data.values || [];
      for (let i = 1; i < previewRows.length; i++) {
        const [d, , insight] = previewRows[i];
        if (d && insight) insightsByDate[d] = insight;
      }
    } catch (e) {
      // 미리보기 시트가 없을 수 있음 — 무시
    }

    // 만화 이미지 URL 시트 (briefing_images 시트: [날짜, 이미지URL])
    let imagesByDate = {};
    try {
      const imgRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "briefing_images!A:B",
      });
      const imgRows = imgRes.data.values || [];
      for (let i = 1; i < imgRows.length; i++) {
        const [d, url] = imgRows[i];
        if (d && url) imagesByDate[d] = url;
      }
    } catch (e) {
      // briefing_images 시트가 없을 수 있음 — 무시
    }

    // 날짜 역순 정렬
    const newsletters = Object.keys(byDate)
      .sort((a, b) => b.localeCompare(a))
      .map(date => {
        const group = byDate[date];
        const firstTitle = group.articles[0]?.title || "";
        return {
          date,
          title: `${date} 호두 브리핑`,
          overallInsight: insightsByDate[date] || "",
          imageUrl: imagesByDate[date] || null,
          articles: group.articles,
          articleCount: group.articles.length,
          preview: firstTitle,
        };
      });

    return Response.json(newsletters);
  } catch (err) {
    console.error("Briefing fetch error:", err);
    return Response.json({ error: "데이터를 불러올 수 없습니다." }, { status: 500 });
  }
}
