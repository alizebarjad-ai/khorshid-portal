import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readClubs, readMembers, updateRecord } from "@/lib/records-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (user.role !== "member" || !user.memberId) return NextResponse.json({ error: "این صفحه مخصوص اعضای فعال است." }, { status: 403 });
  try {
    const members = await readMembers();
    const member = members.find((item) => item.id === user.memberId);
    if (!member || member.status !== "active") return NextResponse.json({ error: "پرونده عضو فعال پیدا نشد." }, { status: 404 });
    const clubs = await readClubs();
    const linkedClubs = clubs
      .filter((club) => (member.clubIds || []).includes(club.id))
      .map((club) => ({
        id: club.id,
        name: club.name,
        clubType: club.clubType,
        city: club.city,
        description: club.description,
        status: club.status,
      }));
    const safeMember = {
      id: member.id,
      fullName: member.fullName,
      memberType: member.memberType,
      membershipTier: member.membershipTier,
      status: member.status,
      phone: member.phone,
      email: member.email,
      city: member.city,
      expertise: member.expertise,
      biography: member.biography,
      clubIds: member.clubIds || [],
    };
    return NextResponse.json({ member: safeMember, clubs: linkedClubs });
  } catch (error) {
    console.error("Member profile GET failed", error);
    return NextResponse.json({ error: "دریافت پرونده عضو ناموفق بود." }, { status: 503 });
  }
}


export async function PATCH(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (user.role !== "member" || !user.memberId) return NextResponse.json({ error: "این عملیات فقط برای اعضای فعال مجاز است." }, { status: 403 });

  try {
    const body = await request.json();
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const expertise = typeof body.expertise === "string" ? body.expertise.trim() : "";
    const biography = typeof body.biography === "string" ? body.biography.trim() : "";
    if (city.length > 120 || expertise.length > 240 || biography.length > 3000) {
      return NextResponse.json({ error: "طول یکی از فیلدها بیش از حد مجاز است." }, { status: 400 });
    }

    const members = await readMembers();
    const member = members.find((item) => item.id === user.memberId);
    if (!member || member.status !== "active") {
      return NextResponse.json({ error: "پرونده عضو فعال پیدا نشد." }, { status: 404 });
    }

    const updated = await updateRecord("member", member.id, { city, expertise, biography }, { username: user.username });
    if (!updated || updated.kind !== "member") {
      return NextResponse.json({ error: "ذخیره تغییرات پرونده انجام نشد." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      member: {
        id: updated.id,
        fullName: updated.fullName,
        memberType: updated.memberType,
        membershipTier: updated.membershipTier,
        status: updated.status,
        phone: updated.phone,
        email: updated.email,
        city: updated.city,
        expertise: updated.expertise,
        biography: updated.biography,
        clubIds: updated.clubIds || [],
      },
    });
  } catch (error) {
    console.error("Member profile PATCH failed", error);
    return NextResponse.json({ error: "ذخیره تغییرات پرونده عضو ناموفق بود." }, { status: 503 });
  }
}
