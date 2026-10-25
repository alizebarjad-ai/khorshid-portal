import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readMembers } from "@/lib/records-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (!["artists", "ceo", "deputy"].includes(user.role)) return NextResponse.json({ error: "دسترسی به بانک هنرمندان مجاز نیست." }, { status: 403 });
  const q = (request.nextUrl.searchParams.get("q") || "").trim().toLocaleLowerCase("fa");
  const city = (request.nextUrl.searchParams.get("city") || "").trim().toLocaleLowerCase("fa");
  const members = await readMembers();
  const items = members.filter(member => {
    const profile = member.artistProfile || {};
    if (member.status !== "active" || member.memberType !== "artist" || profile.verified !== true) return false;
    const specialties = Array.isArray(profile.specialties) ? profile.specialties.join(" ") : String(profile.specialties || "");
    const haystack = [member.fullName, member.email, member.phone, member.city, member.expertise, member.biography, profile.headline, profile.educationField, profile.experience, profile.biography, specialties].map(v => String(v || "")).join(" ").toLocaleLowerCase("fa");
    return (!q || haystack.includes(q)) && (!city || String(member.city || "").toLocaleLowerCase("fa").includes(city));
  }).map(member => {
    const p = member.artistProfile || {};
    return {
      id: member.id, fullName: member.fullName, email: member.email, phone: member.phone, city: member.city,
      headline: p.headline || p.educationField || member.expertise,
      specialties: Array.isArray(p.specialties) ? p.specialties : String(p.specialties || "").split(/[،,\n]/).map(s => s.trim()).filter(Boolean),
      education: p.education, educationField: p.educationField, experience: p.experience, portfolio: p.portfolio,
      biography: p.biography || member.biography, website: p.website, verifiedAt: p.verifiedAt,
    };
  }).sort((a,b) => a.fullName.localeCompare(b.fullName, "fa"));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}
