import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readClubs, readMembers } from "@/lib/records-store";
import { mergeClubCatalog } from "@/lib/club-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FeedItem = {
  id?: string;
  kind?: string;
  title?: string;
  description?: string;
  dateLabel?: string;
  isoDate?: string | null;
  href?: string;
  clubIds?: string[];
};

export async function GET(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (!["ceo", "deputy"].includes(user.role)) {
    return NextResponse.json({ error: "گزارش مدیریتی اعضا و باشگاه‌ها برای این نقش مجاز نیست." }, { status: 403 });
  }

  try {
    const [members, storedClubs] = await Promise.all([readMembers(), readClubs()]);
    const clubs = mergeClubCatalog(storedClubs.filter((club) => club.status !== "closed") as unknown as Array<Record<string, unknown>>);
    const activeMembers = members.filter((member) => member.status === "active");
    const clubBreakdown = clubs.map((club) => {
      const memberIds = new Set(members.filter((member) => (member.clubIds || []).includes(club.id)).map((member) => member.id));
      const activeMemberCount = activeMembers.filter((member) => (member.clubIds || []).includes(club.id)).length;
      return {
        id: club.id,
        name: club.name,
        status: club.status,
        source: club.source,
        memberCount: memberIds.size,
        activeMemberCount,
      };
    }).sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name, "fa"));

    let feedAvailable = false;
    let upcomingPrograms: Array<{ id: string; title: string; dateLabel: string; isoDate: string; clubNames: string[]; href: string; description: string }> = [];
    const base = (process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://www.khorshid-mafakher.ir").replace(/\/$/, "");
    try {
      const response = await fetch(base + "/api/club-feed", { cache: "no-store", headers: { Accept: "application/json" } });
      const feed = await response.json().catch(() => null) as { items?: FeedItem[] } | null;
      if (response.ok && Array.isArray(feed?.items)) {
        feedAvailable = true;
        const now = Date.now();
        upcomingPrograms = feed.items
          .filter((item) => item.kind === "announcement" && item.isoDate && Number.isFinite(Date.parse(item.isoDate)) && Date.parse(item.isoDate) >= now && Array.isArray(item.clubIds) && item.clubIds.length > 0)
          .map((item) => ({
            id: String(item.id || item.title || ""),
            title: String(item.title || "برنامه بدون عنوان"),
            dateLabel: String(item.dateLabel || new Date(String(item.isoDate)).toLocaleDateString("fa-IR")),
            isoDate: String(item.isoDate),
            clubNames: clubs.filter((club) => (item.clubIds || []).includes(club.id)).map((club) => club.name),
            href: new URL(String(item.href || "/"), base).toString(),
            description: String(item.description || ""),
          }))
          .filter((item) => item.clubNames.length > 0)
          .sort((a, b) => Date.parse(a.isoDate) - Date.parse(b.isoDate))
          .slice(0, 12);
      }
    } catch {
      // Keep member and club totals available even when the public site feed is temporarily unavailable.
    }

    return NextResponse.json({
      totals: {
        members: members.length,
        activeMembers: activeMembers.length,
        clubs: clubs.length,
        activeClubs: clubs.filter((club) => club.status === "active").length,
      },
      clubs: clubBreakdown,
      upcomingPrograms,
      feedAvailable,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Management club summary failed", error);
    return NextResponse.json({ error: "گزارش اعضا و باشگاه‌ها در دسترس نیست." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
