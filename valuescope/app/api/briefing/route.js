// app/api/briefing/route.js
import { google } from "googleapis";

export const dynamic = "force-dynamic";

function getSheets(readOnly = true) {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    [readOnly ? "https://www.googleapis.com/auth/spreadsheets.readonly" : "https://www.googleapis.com/auth/spreadsheets"]
  );
  return google.sheets({ version: "v4", auth });
}

// GET: 뉴스레터 목록 가져오기
export async function GET() {
  try {
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) return Response.json({ error: "서버 설정 오류" }, { status: 500 });
    const sheets = getSheets(true);

    // 뉴스기록 시트: [날짜, 제목, 요약, 해석, 링크]
    let logRows = [];
    try {
      const logRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "뉴스기록!A:E" });
      logRows = logRes.data.values || [];
    } catch (e) {}

    // 수동 게시글 시트: [날짜, 제목, 인사이트, 본문, 이미지URL]
    let manualRows = [];
    try {
      const manualRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "briefing_posts!A:E" });
      manualRows = manualRes.data.values || [];
    } catch (e) {}

    // 뉴스기록 → 날짜별 그룹핑
    const byDate = {};
    for (let i = 1; i < logRows.length; i++) {
      const [date, title, summary, interpretation, link] = logRows[i];
      if (!date) continue;
      if (!byDate[date]) byDate[date] = { date, articles: [], overallInsight: "", imageUrl: null, content: "", isManual: false };
      byDate[date].articles.push({ title: title || "", summary: summary || "", interpretation: interpretation || "", link: link || "#" });
    }

    // 뉴스미리보기에서 인사이트
    try {
      const previewRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "뉴스미리보기!A:C" });
      const previewRows = previewRes.data.values || [];
      for (let i = 1; i < previewRows.length; i++) {
        const [d, , insight] = previewRows[i];
        if (d && insight && byDate[d]) byDate[d].overallInsight = insight;
      }
    } catch (e) {}

    // 이미지 시트
    try {
      const imgRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "briefing_images!A:B" });
      const imgRows = imgRes.data.values || [];
      for (let i = 1; i < imgRows.length; i++) {
        const [d, url] = imgRows[i];
        if (d && url && byDate[d]) byDate[d].imageUrl = url;
      }
    } catch (e) {}

    // 수동 게시글 추가/덮어쓰기
    for (let i = 1; i < manualRows.length; i++) {
      const [date, title, insight, content, imageUrl] = manualRows[i];
      if (!date) continue;
      byDate[date] = {
        ...(byDate[date] || { articles: [] }),
        date,
        title: title || `${date} 호두 브리핑`,
        overallInsight: insight || byDate[date]?.overallInsight || "",
        content: content || "",
        imageUrl: imageUrl || byDate[date]?.imageUrl || null,
        isManual: true,
      };
    }

    // 날짜 역순 정렬
    const newsletters = Object.keys(byDate)
      .sort((a, b) => b.localeCompare(a))
      .map(date => {
        const g = byDate[date];
        return {
          date,
          title: g.title || `${date} 호두 브리핑`,
          overallInsight: g.overallInsight || "",
          content: g.content || "",
          imageUrl: g.imageUrl || null,
          articles: g.articles || [],
          isManual: g.isManual || false,
        };
      });

    return Response.json(newsletters);
  } catch (err) {
    console.error("Briefing GET error:", err);
    return Response.json({ error: "데이터를 불러올 수 없습니다." }, { status: 500 });
  }
}

// POST: 새 게시글 작성
export async function POST(request) {
  try {
    const { date, title, overallInsight, content, imageUrl } = await request.json();
    if (!date || !title) return Response.json({ error: "날짜와 제목은 필수입니다." }, { status: 400 });

    const sheetId = process.env.GOOGLE_SHEETS_ID;
    const sheets = getSheets(false);

    // briefing_posts 시트 확인/생성
    try {
      await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "briefing_posts!A1" });
    } catch (e) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: "briefing_posts" } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId, range: "briefing_posts!A1:E1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [["날짜", "제목", "인사이트", "본문", "이미지URL"]] },
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId, range: "briefing_posts!A:E",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[date, title, overallInsight || "", content || "", imageUrl || ""]] },
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("Briefing POST error:", err);
    return Response.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}

// PUT: 게시글 수정
export async function PUT(request) {
  try {
    const { date, title, overallInsight, content, imageUrl } = await request.json();
    if (!date) return Response.json({ error: "날짜가 필요합니다." }, { status: 400 });

    const sheetId = process.env.GOOGLE_SHEETS_ID;
    const sheets = getSheets(false);

    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "briefing_posts!A:E" });
    const rows = res.data.values || [];

    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === date) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId, range: `briefing_posts!A${i + 1}:E${i + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[date, title || "", overallInsight || "", content || "", imageUrl || ""]] },
        });
        found = true;
        break;
      }
    }

    if (!found) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId, range: "briefing_posts!A:E",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[date, title || "", overallInsight || "", content || "", imageUrl || ""]] },
      });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Briefing PUT error:", err);
    return Response.json({ error: "수정에 실패했습니다." }, { status: 500 });
  }
}

// DELETE: 게시글 삭제
export async function DELETE(request) {
  try {
    const { date } = await request.json();
    if (!date) return Response.json({ error: "날짜가 필요합니다." }, { status: 400 });

    const sheetId = process.env.GOOGLE_SHEETS_ID;
    const sheets = getSheets(false);

    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "briefing_posts!A:E" });
    const rows = res.data.values || [];

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === date) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId, range: `briefing_posts!A${i + 1}:E${i + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [["", "", "", "", ""]] },
        });
        break;
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Briefing DELETE error:", err);
    return Response.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }
}
