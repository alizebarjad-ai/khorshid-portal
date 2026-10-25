import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readMembers } from "@/lib/records-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (user.role !== "member" || !user.memberId) return NextResponse.json({ error: "این بخش فقط برای حساب عضو فعال است." }, { status: 403 });
  const member = (await readMembers()).find(item => item.id === user.memberId);
  if (!member || member.status !== "active") return NextResponse.json({ error: "پرونده عضو فعال پیدا نشد." }, { status: 404 });
  return NextResponse.json({ pointsBalance: Number(member.pointsBalance) || 0, pointEvents: (member.pointEvents || []).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)), programs: [] }, { headers: { "Cache-Control": "private, no-store" } });
}
