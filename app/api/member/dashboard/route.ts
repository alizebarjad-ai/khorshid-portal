import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readClubs, readMembers } from "@/lib/records-store";
import { listStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoredItem = Record<string, unknown>;
type SiteContentItem = {
  id: string;
  kind: string;
  title: string;
  description: string;
  image: string;
  dateLabel: string;
  href: string;
  linkLabel: string;
  clubIds: string[];
};

const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const strings = (value: unknown) => Array.isArray(value) ? value.map(String) : [];

export async function GET(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (user.role !== "member" || !user.memberId) {
    return NextResponse.json({ error: "این اطلاعات فقط برای اعضای فعال قابل مشاهده است." }, { status: 403 });
  }

  try {
    const members = await readMembers();
    const member = members.find((item) => item.id === user.memberId && item.status === "active");
    if (!member) return NextResponse.json({ error: "پرونده عضو فعال پیدا نشد." }, { status: 404 });

    const [programRows, pointRows, clubRecords] = await Promise.all([
      listStored<StoredItem>("club-programs"),
      listStored<StoredItem>("member-points"),
      readClubs(),
    ]);
    const clubIds = new Set(member.clubIds || []);
    const now = Date.now();
    const websiteBase = (process.env.KHORSHID_WEBSITE_BASE_URL || "https://www.khorshid-mafakher.ir").replace(/\\/$/, "");
    const clubSlugsByName = [
      { match: "رسانه", slug: "media" },
      { match: "سینما", slug: "cinema" },
      { match: "موسیقی", slug: "music" },
      { match: "ادبیات", slug: "art" },
      { match: "تجسمی", slug: "visual" },
      { match: "مسئولیت اجتماعی", slug: "responsibility" },
      { match: "آموزش", slug: "education" },
      { match: "توسعه", slug: "partnership" },
      { match: "شبکه‌سازی", slug: "partnership" },
    ];
    const memberClubSlugs = new Set(clubRecords
      .filter((club) => clubIds.has(club.id))
      .flatMap((club) => {
        const found = clubSlugsByName.find((entry) => club.name.includes(entry.match));
        return found ? [found.slug] : [];
      }));
    let siteContent: SiteContentItem[] = [];
    try {
      const feedResponse = await fetch(websiteBase + "/api/club-feed", {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (feedResponse.ok) {
        const feed = await feedResponse.json() as { items?: StoredItem[] };
        siteContent = (Array.isArray(feed.items) ? feed.items : [])
          .filter((item) => item.showToMembers === true && text(item.kind) !== "club-member")
          .filter((item) => {
            const targetClubs = strings(item.clubIds);
            return targetClubs.length === 0 || targetClubs.some((slug) => memberClubSlugs.has(slug));
          })
          .map((item) => {
            const rawImage = text(item.image);
            const rawHref = text(item.href);
            return {
              id: text(item.id),
              kind: text(item.kind) || "content",
              title: text(item.title),
              description: text(item.description),
              image: rawImage && rawImage.startsWith("/") ? websiteBase + rawImage : rawImage,
              dateLabel: text(item.dateLabel),
              href: rawHref.startsWith("http") ? rawHref : websiteBase + (rawHref.startsWith("/") ? rawHref : "/" + rawHref),
              linkLabel: text(item.linkLabel) || "مشاهده در سایت اصلی",
              clubIds: strings(item.clubIds),
            };
          })
          .filter((item) => item.id && item.title)
          .slice(0, 30);
      }
    } catch (feedError) {
      // The member dashboard remains usable if the public website feed is temporarily unavailable.
      console.error("Khorshid website club feed is unavailable", feedError);
    }

    const programs = programRows.flatMap((item) => {
      const id = text(item.id);
      const title = text(item.title || item.name);
      const startsAt = text(item.startsAt || item.startAt || item.startDate || item.date);
      const timestamp = startsAt ? new Date(startsAt).getTime() : Number.NaN;
      const programClubIds = strings(item.clubIds || (item.clubId ? [item.clubId] : []));
      const targetedMemberIds = strings(item.memberIds || (item.memberId ? [item.memberId] : []));
      const assignedToMember = targetedMemberIds.includes(member.id);
      const assignedToClub = programClubIds.some((clubId) => clubIds.has(clubId));
      const status = text(item.status || item.publicationStatus || item.visibility).toLowerCase();
      const published = ["published", "active", "scheduled", "منتشرشده", "فعال", "زمان‌بندی‌شده"].includes(status)
        || item.published === true;
      if (!id || !title || (!assignedToMember && !assignedToClub) || !Number.isFinite(timestamp) || timestamp < now || !published) return [];
      const clubName = text(item.clubName || item.clubTitle);
      return [{
        id,
        title,
        description: text(item.description || item.summary),
        startsAt,
        location: text(item.location || item.venue),
        clubName,
        format: text(item.format || item.type || "برنامه باشگاهی"),
      }];
    }).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()).slice(0, 20);

    const pointEvents = pointRows.flatMap((item) => {
      const itemMemberId = text(item.memberId);
      const itemUsername = text(item.username || item.memberUsername);
      const itemMemberIds = strings(item.memberIds);
      if (itemMemberId !== member.id && itemUsername !== user.username && !itemMemberIds.includes(member.id)) return [];
      const points = number(item.points ?? item.delta);
      return [{
        id: text(item.id) || `point-${member.id}-${String(item.createdAt || item.date || "")}`,
        title: text(item.title || item.activity || item.label || "فعالیت ثبت‌شده"),
        points,
        createdAt: text(item.createdAt || item.date || ""),
        note: text(item.note || item.description || ""),
      }];
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);

    return NextResponse.json({
      pointsBalance: pointEvents.reduce((sum, event) => sum + event.points, 0),
      pointEvents,
      programs,
      siteContent,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Member dashboard data could not be loaded", error);
    return NextResponse.json({ error: "دریافت برنامه‌ها و امتیازهای عضو ناموفق بود." }, { status: 503 });
  }
}
