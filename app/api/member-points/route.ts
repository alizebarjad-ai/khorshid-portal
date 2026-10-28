import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readMembers, readMemberPointLedger, updateRecord } from "@/lib/records-store";
import { putStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (user.role !== "members") return NextResponse.json({ error: "ثبت امتیاز و ارتقای رده فقط در اختیار معاون اعضاست." }, { status: 403 });
  try {
    const body = await request.json() as { memberId?: string; points?: number; title?: string; note?: string };
    const memberId = String(body.memberId || "").trim();
    const points = Number(body.points);
    const title = String(body.title || "").trim().slice(0, 160);
    const note = String(body.note || "").trim().slice(0, 1500);
    if (!memberId || !Number.isInteger(points) || points === 0 || Math.abs(points) > 100000 || !title) {
      return NextResponse.json({ error: "شناسه عضو، عنوان امتیاز و مقدار صحیحِ غیرصفر الزامی است." }, { status: 400 });
    }
    if (points < 0 && note.length < 5) return NextResponse.json({ error: "برای کسر امتیاز، دلیل حداقل ۵ نویسه‌ای الزامی است." }, { status: 400 });
    const member = (await readMembers()).find(item => item.id === memberId);
    if (!member) return NextResponse.json({ error: "پرونده عضو پیدا نشد." }, { status: 404 });
    if (member.status !== "active") return NextResponse.json({ error: "ثبت امتیاز فقط برای عضو فعال مجاز است." }, { status: 409 });
    const existingEvents = await readMemberPointLedger(member.id);
    const currentBalance = existingEvents.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
    if (currentBalance + points < 0) return NextResponse.json({ error: "امتیاز قابل کسر از موجودی فعلی بیشتر است." }, { status: 409 });
    const event = { id: randomUUID(), memberId: member.id, memberName: member.fullName, points, title, note, createdAt: new Date().toISOString(), createdBy: user.username, actor: user.name };
    await putStored("member-points", event);
    const pointsBalance = currentBalance + points;
    const updated = await updateRecord("member", member.id, { pointsBalance }, { username: user.username });
    return NextResponse.json({ member: updated, event, pointsBalance }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت امتیاز انجام نشد." }, { status: 400 });
  }
}
