import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readMembers, updateRecord } from "@/lib/records-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const currentBalance = Math.max(0, Number(member.pointsBalance) || 0);
    if (currentBalance + points < 0) return NextResponse.json({ error: "امتیاز قابل کسر از موجودی فعلی بیشتر است." }, { status: 409 });
    const event = { id: randomUUID(), points, title, note, createdAt: new Date().toISOString(), actor: user.name };
    const pointEvents = [...(member.pointEvents || []), event].slice(-300);
    const updated = await updateRecord("member", member.id, { pointsBalance: currentBalance + points, pointEvents }, { username: user.username });
    return NextResponse.json({ member: updated, event }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت امتیاز انجام نشد." }, { status: 400 });
  }
}
