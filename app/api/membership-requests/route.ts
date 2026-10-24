import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { createRecord, readMembers, updateRecord } from "@/lib/records-store";
import { prepareMemberActivation } from "@/lib/member-accounts";

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
    if (body.action !== "approve") {
      return await upstream("", { method: "PATCH", body: JSON.stringify({ ...body, actor: checked.user.name }) });
    }

    if (typeof body.id !== "string" || !body.id) {
      return NextResponse.json({ error: "شناسه درخواست معتبر نیست." }, { status: 400 });
    }

    // Read the authoritative application and approve it upstream before syncing the portal profile.
    const fetched = await upstream("?id=" + encodeURIComponent(body.id));
    if (!fetched.ok) return fetched;
    const appData = await fetched.clone().json();
    const application = appData.item;
    if (!application) return NextResponse.json({ error: "درخواست عضویت پیدا نشد." }, { status: 404 });
    if (!application.membershipTier) {
      return NextResponse.json({ error: "ابتدا نوع عضویت را تعیین کنید." }, { status: 409 });
    }

    const approval = application.reviewStatus === "approved"
      ? NextResponse.json({ item: application, alreadyApproved: true })
      : await upstream("", {
          method: "PATCH",
          body: JSON.stringify({ ...body, actor: checked.user.name, suppressApprovalEmail: true }),
        });
    if (!approval.ok) return approval;

    // Synchronize only after the authoritative approval succeeded. Retrying is safe because
    // the source application ID is checked before creating another member profile.
    const members = await readMembers();
    const email = String(application.email || "").trim().toLowerCase();
    const phone = String(application.phone || "").replace(/[\\s()-]/g, "");
    const sourceId = String(application.id);
    const linked = members.find((member) => (member.sourceApplicationIds || []).includes(sourceId));
    const emailMatch = members.find((member) => email && String(member.email || "").trim().toLowerCase() === email);
    const phoneMatch = members.find((member) => phone && String(member.phone || "").replace(/[\\s()-]/g, "") === phone);
    const matches = [linked, emailMatch, phoneMatch].filter(Boolean);
    const uniqueMatches = new Set(matches.map((member) => member!.id));
    if (uniqueMatches.size > 1) {
      return NextResponse.json({
        error: "درخواست تأیید شده است، اما اطلاعات هویتی به چند پرونده متصل است. برای جلوگیری از ادغام اشتباه، همگام‌سازی پرونده متوقف شد.",
        approved: true,
        needsManualMerge: true,
      }, { status: 409 });
    }

    const existing = linked || emailMatch || phoneMatch;
    const inferredMemberType = application.audience === "artist"
      ? "artist"
      : (["company", "government"].includes(application.audience) || application.type === "organization")
        ? "organization"
        : application.type === "sponsor" ? "supporter" : "expert";
    const profileData = {
      fullName: application.name,
      memberType: existing ? existing.memberType : inferredMemberType,
      membershipTier: application.membershipTier,
      supplementalData: application.supplementalData || {},
      status: "active",
      phone: application.phone,
      email: application.email,
      city: application.city || "",
      expertise: application.artField || application.area || "",
      biography: application.message || "",
      sourceApplicationId: sourceId,
      notes: "پرونده از درخواست عضویت سایت ایجاد/به‌روزرسانی شده است. شناسه درخواست: " + sourceId
        + (application.supplementalData ? "؛ اطلاعات تکمیلی: " + JSON.stringify(application.supplementalData) : ""),
    };
    const memberProfile = existing
      ? await updateRecord("member", existing.id, profileData, { username: checked.user.username })
      : await createRecord("member", profileData, { username: checked.user.username });
    if (!memberProfile) throw new Error("تأیید درخواست انجام شد، اما همگام‌سازی پرونده عضو کامل نشد.");

    const activation = await prepareMemberActivation({
      memberId: memberProfile.id,
      phone: application.phone,
      fullName: application.name,
      email: application.email,
    });
    if (activation.activationToken) {
      const apiBase = process.env.WEBSITE_MEMBERSHIP_API_URL;
      const apiKey = process.env.PORTAL_MEMBERSHIP_API_KEY;
      if (!apiBase || !apiKey) throw new Error("پرونده عضو ساخته شد، اما تنظیمات ارسال پیوند فعال‌سازی ناقص است.");
      const portalUrl = (process.env.NEXT_PUBLIC_PORTAL_URL || "https://khorshid-portal.vercel.app").replace(/\/$/, "");
      const activationUrl = portalUrl + "/activate?token=" + encodeURIComponent(activation.activationToken);
      const emailResponse = await fetch(new URL("/api/portal/member-activation-email", apiBase).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-portal-membership-key": apiKey },
        body: JSON.stringify({ name: application.name, email: application.email, activationUrl }),
      });
      if (!emailResponse.ok) {
        const details = await emailResponse.json().catch(() => ({}));
        throw new Error(details.error || "پرونده عضو ساخته شد، اما ارسال پیوند فعال‌سازی انجام نشد؛ اقدام تأیید را دوباره اجرا کنید.");
      }
    }

    return approval;
  } catch (error) {
    console.error("Membership request action failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "ثبت تصمیم انجام نشد.",
      hint: "اگر درخواست تأیید شده باشد، می‌توان اقدام تأیید را دوباره اجرا کرد تا همگام‌سازی پرونده تکرار شود.",
    }, { status: 503 });
  }
}
