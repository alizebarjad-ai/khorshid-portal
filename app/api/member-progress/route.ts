import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readMembers, updateRecord, type MembershipRank } from "@/lib/records-store";
import { listStored, putStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PointEvent = {
  id: string;
  memberId: string;
  memberName?: string;
  points: number;
  title: string;
  note: string;
  createdAt: string;
  createdBy?: string;
  actor?: string;
};

const allowedRoles = new Set(["members", "deputy", "ceo"]);
const ranks: MembershipRank[] = ["volunteer", "professional", "club_manager"];
const rankLabels: Record<MembershipRank, string> = {
  volunteer: "داوطلب",
  professional: "حرفه‌ای",
  club_manager: "مدیر باشگاه",
};

function authorize(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 }) };
  if (!allowedRoles.has(user.role)) return { user: null, response: NextResponse.json({ error: "دسترسی به پرونده و امتیاز اعضا مجاز نیست." }, { status: 403 }) };
  return { user, response: null };
}

export async function GET(request: NextRequest) {
  const checked = authorize(request);
  if (!checked.user) return checked.response!;
  const memberId = request.nextUrl.searchParams.get("memberId")?.trim();
  if (!memberId) return NextResponse.json({ error: "شناسه عضو الزامی است." }, { status: 400 });

  try {
    const [members, entries] = await Promise.all([
      readMembers(),
      listStored<PointEvent>("member-points"),
    ]);
    const member = members.find((item) => item.id === memberId);
    if (!member) return NextResponse.json({ error: "پرونده عضو پیدا نشد." }, { status: 404 });

    const pointEvents = entries
      .filter((entry) => entry.memberId === memberId)
      .map((entry) => ({
        ...entry,
        points: Number(entry.points) || 0,
        actor: entry.actor || entry.createdBy || "سامانه",
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100);

    return NextResponse.json({
      member: {
        id: member.id,
        fullName: member.fullName,
        status: member.status,
        membershipType: "affiliate",
        membershipRank: member.membershipRank || "volunteer",
        rankHistory: member.rankHistory || [],
      },
      pointEvents,
      pointsBalance: entries.filter((entry) => entry.memberId === memberId).reduce((sum, event) => sum + (Number(event.points) || 0), 0),
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Member progress could not be loaded", error);
    return NextResponse.json({ error: "دریافت سابقه امتیاز و رده ناموفق بود." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const checked = authorize(request);
  if (!checked.user) return checked.response!;

  try {
    const body = await request.json();
    const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1200) : "";
    const hasRank = typeof body.membershipRank === "string" && ranks.includes(body.membershipRank as MembershipRank);
    const hasRankInput = body.membershipRank !== undefined;

    if (!memberId) return NextResponse.json({ error: "شناسه عضو الزامی است." }, { status: 400 });
    if (!title && !hasRank) return NextResponse.json({ error: "شرح فعالیت یا رده جدید را مشخص کنید." }, { status: 400 });
    if (title && (!Number.isInteger(Number(body.points)) || Number(body.points) === 0 || Math.abs(Number(body.points)) > 10000)) {
      return NextResponse.json({ error: "امتیاز باید عدد صحیح غیرصفر بین ۱۰۰۰۰- تا ۱۰۰۰۰ باشد." }, { status: 400 });
    }
    if (hasRankInput && !hasRank) return NextResponse.json({ error: "رده عضویت معتبر نیست." }, { status: 400 });

    const members = await readMembers();
    const member = members.find((item) => item.id === memberId);
    if (!member) return NextResponse.json({ error: "پرونده عضو پیدا نشد." }, { status: 404 });
    if (member.status !== "active") return NextResponse.json({ error: "ثبت امتیاز یا ارتقای رده فقط برای عضو فعال امکان‌پذیر است." }, { status: 409 });

    const currentRank = ranks.includes(member.membershipRank as MembershipRank) ? member.membershipRank as MembershipRank : "volunteer";
    let updatedMember = member;
    if (hasRank && body.membershipRank !== currentRank) {
      const currentIndex = ranks.indexOf(currentRank);
      const nextIndex = ranks.indexOf(body.membershipRank as MembershipRank);
      if (nextIndex < currentIndex) return NextResponse.json({ error: "کاهش رده از این مسیر مجاز نیست." }, { status: 409 });
      if (nextIndex > currentIndex && note.length < 5) return NextResponse.json({ error: "برای ارتقای رده، دلیل حداقل ۵ نویسه‌ای ثبت کنید." }, { status: 400 });

      const updated = await updateRecord("member", memberId, {
        membershipType: "affiliate",
        membershipTier: "affiliate",
        membershipRank: body.membershipRank,
        membershipRankReason: note,
      }, { username: checked.user.username });
      if (!updated || updated.kind !== "member") return NextResponse.json({ error: "ثبت رده جدید انجام نشد." }, { status: 500 });
      updatedMember = updated;
    }

    let pointEvent: PointEvent | null = null;
    if (title) {
      pointEvent = {
        id: randomUUID(),
        memberId,
        memberName: member.fullName,
        points: Number(body.points),
        title,
        note,
        createdAt: new Date().toISOString(),
        createdBy: checked.user.username,
        actor: checked.user.username,
      };
      await putStored("member-points", pointEvent);
    }

    const allEvents = await listStored<PointEvent>("member-points");
    const pointsBalance = allEvents.filter((event) => event.memberId === memberId).reduce((sum, event) => sum + (Number(event.points) || 0), 0);
    return NextResponse.json({
      success: true,
      pointEvent,
      member: {
        id: updatedMember.id,
        fullName: updatedMember.fullName,
        membershipType: "affiliate",
        membershipRank: updatedMember.membershipRank || "volunteer",
        rankHistory: updatedMember.rankHistory || [],
      },
      pointsBalance,
      rankLabels,
    }, { status: 201 });
  } catch (error) {
    console.error("Member progress update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت تغییرات پرونده انجام نشد." }, { status: 400 });
  }
}
