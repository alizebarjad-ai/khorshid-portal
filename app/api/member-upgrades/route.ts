import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readMembers, updateRecord, type MemberRecord } from "@/lib/records-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Target = "artist" | "expert" | "consultant";
type Status = "pending" | "approved" | "rejected" | "needs_info";
const validTargets: Target[] = ["artist", "expert", "consultant"];
const assignedRole = (target: Target) => target === "artist" ? "artists" : "csr";
const isReviewer = (role: string) => ["artists", "csr", "ceo", "deputy"].includes(role);

function session(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 }) };
  if (!isReviewer(user.role) && user.role !== "members") {
    return { user: null, response: NextResponse.json({ error: "دسترسی به درخواست‌های ارتقا مجاز نیست." }, { status: 403 }) };
  }
  return { user, response: null };
}

export async function GET(request: NextRequest) {
  const auth = session(request);
  if (!auth.user) return auth.response!;
  try {
    const members: MemberRecord[] = await readMembers();
    const visible = members.flatMap(member => (member.upgradeRequests || [])
      .filter(item => auth.user!.role === "ceo" || auth.user!.role === "deputy" || item.assignedRole === auth.user!.role)
      .map(item => ({ ...item, member: { id: member.id, fullName: member.fullName, memberType: member.memberType, email: member.email, phone: member.phone, city: member.city, membershipTier: member.membershipTier || "affiliate", membershipGrade: member.membershipGrade || member.membershipRank || "volunteer", membershipRank: member.membershipRank || member.membershipGrade || "volunteer", pointsBalance: Number(member.pointsBalance) || 0, expertise: member.expertise, biography: member.biography, artistProfile: member.artistProfile || {}, expertProfile: member.expertProfile || {} } })));
    visible.sort((a,b) => b.submittedAt.localeCompare(a.submittedAt));
    return NextResponse.json({ items: visible }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "دریافت درخواست‌ها ناموفق بود." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (user.role !== "member" || !user.memberId) return NextResponse.json({ error: "ثبت درخواست ارتقا فقط از حساب عضو امکان‌پذیر است." }, { status: 403 });
  try {
    const body = await request.json() as { target?: Target; headline?: string; education?: string; educationField?: string; experience?: string; specialties?: string; portfolio?: string; resumeText?: string; biography?: string; website?: string };
    const target = body.target;
    if (!target || !validTargets.includes(target)) return NextResponse.json({ error: "مسیر ارتقا معتبر نیست." }, { status: 400 });
    const clean = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
    const headline = clean(body.headline, 160);
    const education = clean(body.education, 1200);
    const educationField = clean(body.educationField, 160);
    const experience = clean(body.experience, 5000);
    const specialties = clean(body.specialties, 1200).split(/[،,\n]/).map(item => item.trim()).filter(Boolean).slice(0, 30);
    const portfolio = clean(body.portfolio, 2000);
    const website = clean(body.website, 300);
    const resumeText = clean(body.resumeText, 8000);
    const biography = clean(body.biography, 3000);
    if (headline.length < 2) return NextResponse.json({ error: "عنوان حرفه‌ای یا زمینه فعالیت را وارد کنید." }, { status: 400 });
    if (![education, experience, specialties.join(" "), portfolio, website, resumeText, biography].some(value => value.trim().length >= 3)) {
      return NextResponse.json({ error: "حداقل یکی از بخش‌های تحصیلات، سوابق، تخصص‌ها، نمونه‌کار، وب‌سایت یا معرفی را تکمیل کنید." }, { status: 400 });
    }
    if (website && !/^https?:\/\//i.test(website)) return NextResponse.json({ error: "نشانی وب‌سایت باید با http:// یا https:// شروع شود." }, { status: 400 });
    const members = await readMembers();
    const member = members.find(item => item.id === user.memberId);
    if (!member || member.status !== "active") return NextResponse.json({ error: "پرونده عضو فعال پیدا نشد." }, { status: 404 });
    const requests = member.upgradeRequests || [];
    const existingOpen = requests.find(item => item.target === target && item.status === "pending");
    if (existingOpen) return NextResponse.json({ error: "درخواست شما در حال بررسی است؛ درخواست تکراری ثبت نمی‌شود." }, { status: 409 });
    const profileKey = target === "artist" ? "artistProfile" : "expertProfile";
    const oldProfile = (target === "artist" ? member.artistProfile : member.expertProfile) || {};
    if ((oldProfile as Record<string, unknown>).verified === true || requests.some(item => item.target === target && item.status === "approved")) {
      return NextResponse.json({ error: "این عنوان قبلاً تأیید شده است. برای اصلاح پروفایل با معاونت مربوطه هماهنگ کنید." }, { status: 409 });
    }
    const needsInfoRequest = requests.find(item => item.target === target && item.status === "needs_info");
    const profile = {
      ...oldProfile, headline, education, educationField, experience, specialties, portfolio, website, resumeText, biography,
      submittedAt: new Date().toISOString(), verified: false,
    };
    const now = new Date().toISOString();
    const item = needsInfoRequest
      ? { ...needsInfoRequest, status: "pending" as const, submittedAt: now, reviewedAt: undefined, reviewer: undefined, note: undefined }
      : { id: randomUUID(), target, status: "pending" as const, assignedRole: assignedRole(target), submittedAt: now };
    const updatedRequests = needsInfoRequest ? requests.map(req => req.id === needsInfoRequest.id ? item : req) : [...requests, item];
    const updated = await updateRecord("member", member.id, {
      memberType: member.memberType,
      [profileKey]: profile,
      upgradeRequests: updatedRequests,
    }, { username: user.username });
    return NextResponse.json({ request: item, member: updated, resubmitted: Boolean(needsInfoRequest) }, { status: needsInfoRequest ? 200 : 201, headers: { "Cache-Control": "private, no-store" } });
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
    if (auth.user.role !== "ceo" && current.assignedRole !== auth.user.role) {
      return NextResponse.json({ error: "فقط معاونت مسئول این مسیر یا مدیرعامل مجاز به تصمیم‌گیری است." }, { status: 403 });
    }
    if (current.status !== "pending") return NextResponse.json({ error: "این درخواست در وضعیت قابل بررسی نیست." }, { status: 409 });
    const note = String(body.note || "").trim().slice(0, 3000);
    if (["rejected", "needs_info"].includes(body.status!) && note.length < 3) {
      return NextResponse.json({ error: "برای رد یا درخواست تکمیل، توضیح روشن و الزامی ثبت کنید." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const updatedRequests = requests.map(item => item.id === current.id ? { ...item, status: body.status!, reviewedAt: now, reviewer: auth.user!.name || auth.user!.username, note } : item);
    const patch: Record<string, unknown> = { upgradeRequests: updatedRequests };
    if (body.status === "approved" && current.target === "artist") {
      patch.memberType = "artist";
      patch.artistProfile = { ...(member.artistProfile || {}), verified: true, verifiedAt: now, verifiedBy: auth.user.name || auth.user.username };
    } else if (body.status === "approved" && (current.target === "expert" || current.target === "consultant")) {
      patch.memberType = "expert";
      patch.expertProfile = { ...(member.expertProfile || {}), designation: current.target, verified: true, verifiedAt: now, verifiedBy: auth.user.name || auth.user.username };
    }
    const updated = await updateRecord("member", member.id, patch, { username: auth.user.username });
    const updatedMember = updated as MemberRecord | null;
    return NextResponse.json({ item: updatedMember, request: updatedMember?.upgradeRequests?.find(item => item.id === current.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت تصمیم انجام نشد." }, { status: 400 });
  }
}
