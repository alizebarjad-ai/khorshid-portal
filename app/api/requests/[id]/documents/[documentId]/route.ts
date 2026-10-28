import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; documentId: string }> }) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (!["ceo", "deputy", "economic", "csr", "media", "artists", "education", "members"].includes(user.role)) {
    return NextResponse.json({ error: "دسترسی به فایل مجاز نیست." }, { status: 403 });
  }
  const { id, documentId } = await context.params;
  const base = process.env.WEBSITE_MEMBERSHIP_API_URL;
  const key = process.env.PORTAL_MEMBERSHIP_API_KEY;
  if (!base || !key) return NextResponse.json({ error: "اتصال به سامانه سایت تنظیم نشده است." }, { status: 503 });
  try {
    const requestResponse = await fetch(new URL("/api/portal/requests?id=" + encodeURIComponent(id), base), {
      headers: { "x-portal-membership-key": key },
      cache: "no-store",
    });
    const requestData = await requestResponse.json().catch(() => ({}));
    const item = requestData.item;
    if (!requestResponse.ok || !item) return NextResponse.json({ error: "درخواست پیدا نشد." }, { status: 404 });
    if (item.assignedUnit !== user.role) {
      return NextResponse.json({ error: "فایل فقط برای واحدی قابل دریافت است که درخواست صریحاً به آن ارجاع شده باشد." }, { status: 403 });
    }
    const fileResponse = await fetch(new URL("/api/portal/requests/" + encodeURIComponent(id) + "/documents/" + encodeURIComponent(documentId), base), {
      headers: { "x-portal-membership-key": key },
      cache: "no-store",
    });
    if (!fileResponse.ok) {
      const data = await fileResponse.json().catch(() => ({}));
      return NextResponse.json({ error: data.error || "دریافت فایل ناموفق بود." }, { status: fileResponse.status });
    }
    return new Response(fileResponse.body, {
      status: 200,
      headers: {
        "Content-Type": fileResponse.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": fileResponse.headers.get("content-disposition") || "attachment",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Portal request document proxy failed", error);
    return NextResponse.json({ error: "دریافت فایل پیوست ناموفق بود." }, { status: 503 });
  }
}
