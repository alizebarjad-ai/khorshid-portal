import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readMembers, updateRecord, type MembershipRank } from "@/lib/records-store";
import { listStored, putStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PointEntry = {
  id: string;
  memberId: string;
  points: number;
  title: string;
  note: string;
  createdAt: string;
  createdBy: string;
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
  if (!allowedRoles.has(user.role)) return { user: null, response: NextResponse.json({ error: "ثبت امتیاز و ارتقای رده فقط برای معاون اعضا و مدیران مجاز است." }, { status: 403 }) };
  return { user, response: null };
}

export async function GET(request: NextRequest) {
  const checked = authorize(request);
  if (!checked.user) return checked.response!;
  try {
    const memberId = request.nextUrl.searchParams.get("memberId");
    const [members, entries] = await Promise.all([
      readMembers(),
      listStored<PointEntry>("member-points"),
    ]);
    const validMemberIds = new Set(members.map((member) => member.id));
    const legacyEntries: PointEntry[] = members.flatMap((member) => (member.pointEvents || []).map((event) => ({
      id: event.id, memberId: member.id, points: event.points, title: event.title, note: event.note,
      createdAt: event.createdAt, createdBy: event.actor || "سامانه",
    })));
    const filtered = [...new Map([
      ...entries.filter((entry) => validMemberIds.has(entry.memberId) && (!memberId || entry.memberId === memberId)),
      ...legacyEntries.filter((entry) => !memberId || entry.memberId === memberId),
    ].map((entry) => [entry.id, entry])).values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pointsByMember: Record<string, { balance: number; events: PointEntry[] }> = {};
    for (const entry of filtered) {
      if (!pointsByMember[entry.memberId]) pointsByMember[entry.memberId] = { balance: 0, events: [] };
      pointsByMember[entry.memberId].balance += Number(entry.points) || 0;
      if (pointsByMember[entry.memberId].events.length < 200) pointsByMember[entry.memberId].events.push(entry);
    }
    return NextResponse.json({ pointsByMember }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Member development data could not be loaded", error);
    return NextResponse.json({ error: "دریافت امتیازهای اعضا ناموفق بود." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const checked = authorize(request);
  if (!checked.user) return checked.response!;
  try {
    const body = await request.json();
    const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
    if (!memberId || typeof body.action !== "string") {
      return NextResponse.json({ error: "عضو یا نوع عملیات معتبر نیست." }, { status: 400 });
    }
    const members = await readMembers();
    const member = members.find((item) => item.id === memberId);
    if (!member) return NextResponse.json({ error: "پرونده عضو پیدا نشد." }, { status: 404 });
    if (member.status !== "active") return NextResponse.json({ error: "ثبت امتیاز یا ارتقای رده فقط برای عضو فعال امکان‌پذیر است." }, { status: 409 });

    if (body.action === "award-points") {
      const points = Number(body.points);
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const note = typeof body.note === "string" ? body.note.trim() : "";
      if (!Number.isInteger(points) || points < 1 || points > 10000) {
        return NextResponse.json({ error: "امتیاز باید عدد صحیح بین ۱ تا ۱۰٬۰۰۰ باشد." }, { status: 400 });
      }
      if (!title || title.length > 160 || note.length > 1000) {
        return NextResponse.json({ error: "شرح فعالیت الزامی است و باید حداکثر ۱۶۰ نویسه باشد." }, { status: 400 });
      }
      const entry: PointEntry = {
        id: randomUUID(),
        memberId,
        points,
        title,
        note,
        createdAt: new Date().toISOString(),
        createdBy: checked.user.username,
      };
      await putStored("member-points", entry);
      const all = await listStored<PointEntry>("member-points");
      const legacy = (member.pointEvents || []).map((event) => ({ id: event.id, memberId, points: event.points, title: event.title, note: event.note, createdAt: event.createdAt, createdBy: event.actor || "سامانه" }));
      const merged = [...new Map([...all.filter((item) => item.memberId === memberId), ...legacy].map((item) => [item.id, item])).values()];
      const balance = merged.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
      const synced = await updateRecord("member", member.id, {
        pointsBalance: balance,
        pointEvents: merged.slice(-300).map((item) => ({ id: item.id, points: item.points, title: item.title, note: item.note, createdAt: item.createdAt, actor: item.createdBy })),
      }, { username: checked.user.username });
      if (!synced || synced.kind !== "member") return NextResponse.json({ error: "رویداد ثبت شد اما همگام‌سازی پرونده انجام نشد." }, { status: 503 });
      return NextResponse.json({ success: true, item: entry, member: synced, pointsBalance: balance }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (body.action === "promote-tier") {
      const current = ranks.includes(member.membershipRank as MembershipRank) ? member.membershipRank as MembershipRank : "volunteer";
      const currentIndex = ranks.indexOf(current);
      if (currentIndex >= ranks.length - 1) {
        return NextResponse.json({ error: "رده «مدیر باشگاه» بالاترین رده تعریف‌شده فعلی است." }, { status: 409 });
      }
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (reason.length < 5 || reason.length > 1000) {
        return NextResponse.json({ error: "دلیل ارتقا را در حداقل ۵ و حداکثر ۱۰۰۰ نویسه ثبت کنید." }, { status: 400 });
      }
      const nextRank = ranks[currentIndex + 1];
      const updated = await updateRecord("member", member.id, {
        membershipType: "affiliate",
        membershipTier: "affiliate",
        membershipRank: nextRank,
        membershipGrade: nextRank,
        rankReason: reason,
      }, { username: checked.user.username });
      if (!updated || updated.kind !== "member") return NextResponse.json({ error: "ثبت ارتقای رده انجام نشد." }, { status: 500 });
      return NextResponse.json({
        success: true,
        member: updated,
        from: rankLabels[current],
        to: rankLabels[nextRank],
      });
    }

    return NextResponse.json({ error: "نوع عملیات پشتیبانی نمی‌شود." }, { status: 400 });
  } catch (error) {
    console.error("Member development action failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت تغییر انجام نشد." }, { status: 503 });
  }
}
