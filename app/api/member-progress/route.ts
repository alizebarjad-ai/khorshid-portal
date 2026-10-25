import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readMembers, updateRecord, type MemberRank } from "@/lib/records-store";
import { listStored, putStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const allowed = new Set(["ceo", "deputy", "members"]);
const ranks = new Set<MemberRank>(["volunteer", "professional", "club_manager"]);
type PointEvent = { id: string; memberId: string; memberName: string; points: number; title: string; note: string; createdAt: string; actor: string };

async function authorize(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 }) };
  if (!allowed.has(user.role)) return { user: null, response: NextResponse.json({ error: "ثبت امتیاز و ارتقای رده فقط برای مدیرعامل، معاونت‌ها و معاون اعضا مجاز است." }, { status: 403 }) };
  return { user, response: null };
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.user) return auth.response!;
  const memberId = request.nextUrl.searchParams.get("memberId") || "";
  if (!memberId) return NextResponse.json({ error: "شناسه عضو الزامی است." }, { status: 400 });
  try {
    const [members, events] = await Promise.all([readMembers(), listStored<PointEvent>("member-points")]);
    const member = members.find((item) => item.id === memberId);
    if (!member) return NextResponse.json({ error: "پرونده عضو پیدا نشد." }, { status: 404 });
    const pointEvents = events.filter((event) => event.memberId === memberId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
    return NextResponse.json({ member: { id: member.id, fullName: member.fullName, membershipTier: member.membershipTier || "affiliate", memberRank: member.memberRank || "volunteer", rankHistory: member.rankHistory || [] }, pointEvents, pointsBalance: pointEvents.reduce((sum, event) => sum + Number(event.points || 0), 0) }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "دریافت سابقه امتیاز ناموفق بود." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.user) return auth.response!;
  try {
    const body = await request.json();
    const memberId = typeof body.memberId === "string" ? body.memberId : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1200) : "";
    const points = Number(body.points);
    const hasRank = typeof body.memberRank === "string" && ranks.has(body.memberRank as MemberRank);
    if (!memberId) return NextResponse.json({ error: "شناسه عضو الزامی است." }, { status: 400 });
    if (!title && !hasRank) return NextResponse.json({ error: "شرح امتیاز یا رده جدید را وارد کنید." }, { status: 400 });
    if (title && (!Number.isInteger(points) || points === 0 || Math.abs(points) > 10000)) return NextResponse.json({ error: "امتیاز باید عدد صحیح غیرصفر بین ۱۰۰۰۰- تا ۱۰۰۰۰ باشد." }, { status: 400 });
    if (body.memberRank !== undefined && !hasRank) return NextResponse.json({ error: "رده عضویت معتبر نیست." }, { status: 400 });

    const members = await readMembers();
    const member = members.find((item) => item.id === memberId);
    if (!member) return NextResponse.json({ error: "پرونده عضو پیدا نشد." }, { status: 404 });
    const now = new Date().toISOString();
    let pointEvent: PointEvent | null = null;
    if (title) {
      pointEvent = { id: randomUUID(), memberId, memberName: member.fullName, points, title, note, createdAt: now, actor: auth.user.username };
      await putStored("member-points", pointEvent);
    }
    let updatedMember = member;
    if (hasRank && body.memberRank !== (member.memberRank || "volunteer")) {
      const updated = await updateRecord("member", memberId, { memberRank: body.memberRank }, { username: auth.user.username });
      if (updated) updatedMember = updated;
    }
    return NextResponse.json({ success: true, pointEvent, member: { id: updatedMember.id, fullName: updatedMember.fullName, membershipTier: updatedMember.membershipTier || "affiliate", memberRank: updatedMember.memberRank || "volunteer", rankHistory: updatedMember.rankHistory || [] } }, { status: 201 });
  } catch (error) {
    console.error("Member progress update failed", error);
    return NextResponse.json({ error: "ثبت تغییرات پرونده عضو انجام نشد." }, { status: 400 });
  }
}
