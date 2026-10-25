import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readMembers, updateRecord, type MemberRecord } from "@/lib/records-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Target = "artist" | "expert" | "consultant";
type Status = "pending" | "approved" | "rejected" | "needs_info";
const assignedRole = (target: Target) => target === "artist" ? "artists" : "csr";

function session(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 }) };
  if (!["artists", "csr", "members", "ceo", "deputy"].includes(user.role)) {
    return { user: null, response: NextResponse.json({ error: "دسترسی به درخواست‌های ارتقا مجاز نیست." }, { status: 403 }) };
  }
  return { user, response: null };
}

export async function GET(request: NextRequest) {
  const auth = session(request);
  if (!auth.user) return auth.response!;
  try {
    const members = await readMembers();
    const visible = members.flatMap(member => (member.upgradeRequests || [])
      .filter(item => auth.user!.role === "ceo" || auth.user!.role === "deputy" || auth.user!.role === "members" || item.assignedRole === auth.user!.role)
      .map(item => ({ ...item, member: { id: member.id, fullName: member.fullName, email: member.email, phone: member.phone, city: member.city, membershipTier: member.membershipTier || "affiliate", membershipGrade: member.membershipGrade || "volunteer", pointsBalance: member.pointsBalance || 0, expertise: member.expertise, biography: member.biography, artistProfile: member.artistProfile || {}, expertProfile: member.expertProfile || {} } })));
    visible.sort((a,b) => b.submittedAt.localeCompare(a.submittedAt));
    return NextResponse.json({ items: visible });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "دریافت درخواست‌ها ناموفق بود." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (user.role !== "member" || !user.memberId) return NextResponse.json({ error: "ثبت درخواست ارتقا فقط از حساب عضو امکان‌پذیر است." }, { status: 403 });
  try {
    const body = await request.json() as { target?: Target; headline?: string; education?: string; educationField?: string; experience?: string; specialties?: string; portfolio?: string; resumeText?: string; biography?: string };
    const target = body.target;
    if (!target || !["artist", "expert", "consultant"].includes(target)) return NextResponse.json({ error: "مسیر ارتقا معتبر نیست." }, { status: 400 });
    const members = await readMembers();
    const member = members.find(item => item.id === user.memberId);
    if (!member || member.status !== "active") return NextResponse.json({ error: "پرونده عضو فعال پیدا نشد." }, { status: 404 });
    if ((member.upgradeRequests || []).some(item => item.target === target && (item.status === "pending" || item.status === "needs_info"))) {
      return NextResponse.json({ error: "برای این مسیر، درخواست باز دارید. ابتدا همان درخواست را تکمیل کنید." }, { status: 409 });
    }
    const profile = {
      ...(target === "artist" ? (member.artistProfile || {}) : (member.expertProfile || {})),
      headline: String(body.headline || "").trim().slice(0, 160),
      education: String(body.education || "").trim().slice(0, 1200),
      educationField: String(body.educationField || "").trim().slice(0, 160),
      experience: String(body.experience || "").trim().slice(0, 5000),
      specialties: String(body.specialties || "").split(/[،,\n]/).map(item => item.trim()).filter(Boolean).slice(0, 30),
      portfolio: String(body.portfolio || "").trim().slice(0, 2000),
      website: String(body.website || "").trim().slice(0, 300),
      resumeText: String(body.resumeText || "").trim().slice(0, 8000),
      biography: String(body.biography || member.biography || "").trim().slice(0, 3000),
      submittedAt: new Date().toISOString(),
      verified: false,
    };
    const item = { id: randomUUID(), target, status: "pending" as const, assignedRole: assignedRole(target), submittedAt: new Date().toISOString() };
    const updated = await updateRecord("member", member.id, {
      ...(target === "artist" ? { artistProfile: profile } : { expertProfile: profile }),
      upgradeRequests: [...(member.upgradeRequests || []), item],
    }, { username: user.username });
    return NextResponse.json({ request: item, member: updated }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت درخواست ارتقا انجام نشد." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = session(request);
  if (!auth.user) return auth.response!;
  try {
    const body = await request.json() as { memberId?: string; requestId?: string; status?: Status; note?: string };
    if (!body.memberId || !body.requestId || !["approved", "rejected", "needs_info"].includes(String(body.status))) {
      return NextResponse.json({ error: "شناسه عضو، درخواست و تصمیم معتبر الزامی است." }, { status: 400 });
    }
    const members = await readMembers();
    const member = members.find(item => item.id === body.memberId);
    if (!member) return NextResponse.json({ error: "پرونده عضو پیدا نشد." }, { status: 404 });
    const requests = member.upgradeRequests || [];
    const current = requests.find(item => item.id === body.requestId);
    if (!current) return NextResponse.json({ error: "درخواست ارتقا پیدا نشد." }, { status: 404 });
    if (!["ceo", "deputy", "members"].includes(auth.user.role) && current.assignedRole !== auth.user.role) {
      return NextResponse.json({ error: "این درخواست به کارتابل واحد شما ارجاع نشده است." }, { status: 403 });
    }
    if (current.status !== "pending" && current.status !== "needs_info") {
      return NextResponse.json({ error: "این درخواست قبلاً تعیین تکلیف شده است." }, { status: 409 });
    }
    const note = String(body.note || "").trim().slice(0, 3000);
    if (["rejected", "needs_info"].includes(body.status!) && !note) {
      return NextResponse.json({ error: "برای رد یا درخواست تکمیل، درج توضیح الزامی است." }, { status: 400 });
    }
    const updatedRequests = requests.map(item => item.id === current.id ? { ...item, status: body.status!, reviewedAt: new Date().toISOString(), reviewer: auth.user!.name, note } : item);
    const patch: Record<string, unknown> = { upgradeRequests: updatedRequests };
    if (body.status === "approved" && current.target === "artist") {
      patch.artistProfile = { ...(member.artistProfile || {}), verified: true, verifiedAt: new Date().toISOString(), verifiedBy: auth.user.name };
    } else if (body.status === "approved" && (current.target === "expert" || current.target === "consultant")) {
      patch.expertProfile = { ...(member.expertProfile || {}), designation: current.target, verified: true, verifiedAt: new Date().toISOString(), verifiedBy: auth.user.name };
    }
    const updated = await updateRecord("member", member.id, patch, { username: auth.user.username });
    return NextResponse.json({ item: updated, request: updated?.upgradeRequests?.find(item => item.id === current.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت تصمیم انجام نشد." }, { status: 400 });
  }
}
