import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readMembers, updateRecord } from "@/lib/records-store";
import { listStored, putStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PointEvent = { id: string; memberId: string; memberName?: string; points: number; title: string; note: string; createdAt: string; createdBy?: string; actor?: string };

export async function POST(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (!["members", "ceo", "deputy"].includes(user.role)) return NextResponse.json({ error: "ثبت امتیاز فقط برای معاون اعضا و مدیران مجاز است." }, { status: 403 });
  try {
    const body = await request.json() as { memberId?: string; points?: number; title?: string; note?: string };
    const memberId = String(body.memberId || "").trim();
    const points = Number(body.points);
    const title = String(body.title || "").trim().slice(0, 160);
    const note = String(body.note || "").trim().slice(0, 1500);
    if (!memberId || !Number.isInteger(points) || points === 0 || Math.abs(points) > 100000 || !title) {
      return NextResponse.json({ error: "شناسه عضو، عنوان امتیاز و مقدار صحیحِ غیرصفر الزامی است." }, { status: 400 });
    }
    if (points < 0 && !note) return NextResponse.json({ error: "برای کسر امتیاز، درج دلیل الزامی است." }, { status: 400 });
    const member = (await readMembers()).find(item => item.id === memberId);
    if (!member) return NextResponse.json({ error: "پرونده عضو پیدا نشد." }, { status: 404 });
    if (member.status !== "active") return NextResponse.json({ error: "ثبت امتیاز فقط برای عضو فعال امکان‌پذیر است." }, { status: 409 });
    const existingEvents = await listStored<PointEvent>("member-points");
    const legacyEvents: PointEvent[] = (member.pointEvents || []).map(event => ({ ...event, memberId, memberName: member.fullName, createdBy: event.actor, actor: event.actor }));
    const merged = [...new Map([...existingEvents.filter(event => event.memberId === memberId), ...legacyEvents].map(event => [event.id, event])).values()];
    const currentBalance = merged.reduce((sum, event) => sum + (Number(event.points) || 0), 0);
    if (currentBalance + points < 0) return NextResponse.json({ error: "امتیاز قابل کسر از موجودی فعلی بیشتر است." }, { status: 409 });
    const event: PointEvent = { id: randomUUID(), memberId, memberName: member.fullName, points, title, note, createdAt: new Date().toISOString(), createdBy: user.username, actor: user.name || user.username };
    await putStored("member-points", event);
    const nextEvents = [...merged, event].slice(-300);
    const nextBalance = currentBalance + points;
    const updated = await updateRecord("member", member.id, { pointsBalance: nextBalance, pointEvents: nextEvents.map(({ id, points: value, title: label, note: details, createdAt, actor }) => ({ id, points: value, title: label, note: details, createdAt, actor: actor || user.username })) }, { username: user.username });
    if (!updated || updated.kind !== "member") return NextResponse.json({ error: "رویداد ثبت شد اما همگام‌سازی پرونده انجام نشد؛ برای جلوگیری از ثبت تکراری، صفحه را تازه‌سازی کنید." }, { status: 503 });
    return NextResponse.json({ member: updated, event, pointsBalance: nextBalance }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت امتیاز انجام نشد." }, { status: 400 });
  }
}
