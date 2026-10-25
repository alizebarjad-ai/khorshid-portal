import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readClubs, readMembers, updateRecord } from "@/lib/records-store";
import { mergeClubCatalog } from "@/lib/club-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function currentMember(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 }) };
  if (user.role !== "member" || !user.memberId) return { user: null, response: NextResponse.json({ error: "این بخش فقط برای حساب عضو فعال است." }, { status: 403 }) };
  return { user, response: null };
}

export async function GET(request: NextRequest) {
  const auth = currentMember(request);
  if (!auth.user) return auth.response!;
  const [members, clubs] = await Promise.all([readMembers(), readClubs()]);
  const member = members.find(item => item.id === auth.user!.memberId);
  if (!member || member.status !== "active") return NextResponse.json({ error: "پرونده عضو فعال پیدا نشد." }, { status: 404 });
  const catalog = mergeClubCatalog(clubs as unknown as Array<Record<string, unknown>>).filter(club => club.status !== "closed");
  return NextResponse.json({ member: { id: member.id, fullName: member.fullName, memberType: member.memberType, membershipType: "affiliate", membershipTier: "affiliate", membershipRank: member.membershipRank || "volunteer", membershipGrade: member.membershipGrade || "volunteer", phone: member.phone, email: member.email, city: member.city, expertise: member.expertise, biography: member.biography, status: member.status, clubIds: member.clubIds, artistProfile: member.artistProfile || {}, expertProfile: member.expertProfile || {}, upgradeRequests: member.upgradeRequests || [] }, clubs: catalog.filter(club => (member.clubIds || []).includes(club.id)).map(club => ({ id: club.id, name: club.name, clubType: club.clubType, city: club.city, description: club.description, status: club.status })), availableClubs: catalog.map(({ id, name, clubType, city, description, status, source }) => ({ id, name, clubType, city, description, status, source })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: NextRequest) {
  const auth = currentMember(request);
  if (!auth.user) return auth.response!;
  try {
    const body = await request.json() as { city?: string; expertise?: string; biography?: string };
    const members = await readMembers();
    const member = members.find(item => item.id === auth.user!.memberId);
    if (!member || member.status !== "active") return NextResponse.json({ error: "پرونده عضو فعال پیدا نشد." }, { status: 404 });
    const updated = await updateRecord("member", member.id, { city: String(body.city || "").trim().slice(0, 80), expertise: String(body.expertise || "").trim().slice(0, 500), biography: String(body.biography || "").trim().slice(0, 3000) }, { username: auth.user.username });
    return NextResponse.json({ member: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ذخیره پروفایل انجام نشد." }, { status: 400 });
  }
}


