import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { createRecord, readMembers, updateRecord } from "@/lib/records-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function auth(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 }) };
  if (!["members", "ceo", "deputy"].includes(user.role)) return { user: null, response: NextResponse.json({ error: "دسترسی به کارتابل درخواست‌های عضویت مجاز نیست." }, { status: 403 }) };
  return { user, response: null };
}

async function upstream(path: string, init?: RequestInit) {
  const base = process.env.WEBSITE_MEMBERSHIP_API_URL;
  const key = process.env.PORTAL_MEMBERSHIP_API_KEY;
  if (!base || !key) throw new Error("اتصال امن به سامانه درخواست‌های سایت تنظیم نشده است.");
  const response = await fetch(base.replace(/\/$/, "") + path, {
    ...init, cache: "no-store",
    headers: { "Content-Type": "application/json", "x-portal-membership-key": key, ...(init?.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}

export async function GET(request: NextRequest) {
  const checked = auth(request);
  if (!checked.user) return checked.response!;
  try {
    const id = request.nextUrl.searchParams.get("id");
    return await upstream(id ? "?id=" + encodeURIComponent(id) : "");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "دریافت درخواست‌ها ناموفق بود." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const checked = auth(request);
  if (!checked.user) return checked.response!;
  try {
    const body = await request.json();
    if (body.action === "approve") {
      if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "شناسه درخواست معتبر نیست." }, { status: 400 });
      const fetched = await upstream("?id=" + encodeURIComponent(body.id));
      if (!fetched.ok) return fetched;
      const appData = await fetched.clone().json();
      const application = appData.item;
      if (!application) return NextResponse.json({ error: "درخواست عضویت پیدا نشد." }, { status: 404 });
      if (!application.membershipTier) return NextResponse.json({ error: "ابتدا نوع عضویت را تعیین کنید." }, { status: 409 });
      const members = await readMembers();
      // Only reuse a profile when this exact application is already linked to it.
      // Email and phone are not unique identifiers: different members may share contact details.
      // Matching on either field silently overwrote the previous member when approving a new application.
      const linked = members.find((m) => (m.sourceApplicationIds || []).includes(String(application.id)));
      const existing = linked;
      const inferredMemberType = application.audience === "media" ? "media" : application.audience === "organization" ? "organization" : application.audience === "individual" ? "individual" : application.type === "sponsor" ? "supporter" : "individual";
      const profileData = { fullName: application.name, memberType: existing ? existing.memberType : inferredMemberType, membershipTier: application.membershipTier, supplementalData: application.supplementalData || {}, status: existing ? existing.status : "pending", phone: application.phone, email: application.email, city: application.city || "", expertise: application.artField || application.area || "", biography: application.message || "", sourceApplicationId: application.id, notes: "پرونده از درخواست عضویت سایت ایجاد/به‌روزرسانی شده است. شناسه درخواست: " + application.id + (application.supplementalData ? "؛ اطلاعات تکمیلی: " + JSON.stringify(application.supplementalData) : "") };
      if (existing) await updateRecord("member", existing.id, profileData, { username: checked.user.username });
      else await createRecord("member", profileData, { username: checked.user.username });
    }
    const result = await upstream("", { method: "PATCH", body: JSON.stringify({ ...body, actor: checked.user.name }) });
    if (body.action === "approve" && result.ok) {
      const latestMembers = await readMembers();
      const profile = latestMembers.find((member) => (member.sourceApplicationIds || []).includes(String(body.id)));
      if (profile && profile.status !== "active") await updateRecord("member", profile.id, { status: "active" }, { username: checked.user.username });
    }
    return result;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت تصمیم انجام نشد." }, { status: 503 });
  }
}
