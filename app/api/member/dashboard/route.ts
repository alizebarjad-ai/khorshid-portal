import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readClubs, readMembers, readMemberPointLedger } from "@/lib/records-store";
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
  details?: string;
  linkLabel?: string;
  targetGrades?: string[];
  isoDate?: string;
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

    const [programRows, clubRecords, pointRows] = await Promise.all([
      listStored<StoredItem>("club-programs"),
      readClubs(),
      readMemberPointLedger(member.id),
    ]);
    const clubIds = new Set(member.clubIds || []);
    const now = Date.now();
    const websiteBase = (process.env.KHORSHID_WEBSITE_BASE_URL || "https://www.khorshid-mafakher.ir").replace(/\/$/, "");
    // Keep portal club records aligned with the eight canonical slugs used by the main website.
    // Normalize Persian/Arabic spelling and zero-width joiners before matching older club names.
    const normalizeClubName = (value: string) => value
      .replace(/[\u200c\u200d\u200e\u200f\ufeff]/g, "")
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/[ـ،؛:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const clubSlugsByName = [
      { slug: "media", aliases: ["رسانه و تولید محتوا", "رسانه"] },
      { slug: "cinema", aliases: ["سینما و تئاتر", "سینما", "تئاتر"] },
      { slug: "music", aliases: ["موسیقی"] },
      { slug: "art", aliases: ["ادبیات"] },
      { slug: "visual", aliases: ["هنرهای تجسمی و طراحی", "هنرهای تجسمی", "تجسمی"] },
      { slug: "responsibility", aliases: ["مسئولیت اجتماعی"] },
      { slug: "education", aliases: ["آموزش"] },
      { slug: "partnership", aliases: ["توسعه و شبکه سازی", "شبکه سازی", "توسعه"] },
    ];
    const memberClubSlugs = new Set(clubRecords
      .filter((club) => clubIds.has(club.id))
      .flatMap((club) => {
        const name = normalizeClubName(club.name);
        const found = clubSlugsByName.find((entry) =>
          entry.aliases.some((alias) => name.includes(normalizeClubName(alias)))
        );
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
        const gradeRaw = text(member.membershipRank || member.membershipGrade || "volunteer");
        const memberGrade = gradeRaw === "professional" ? "active_volunteer" : gradeRaw;
        siteContent = (Array.isArray(feed.items) ? feed.items : [])
          .filter((item) => item.showToMembers === true && text(item.kind) !== "club-member")
          .filter((item) => {
            if (text(item.kind) === "member-service") {
              const targetGrades = strings(item.targetGrades);
              return targetGrades.length > 0 && targetGrades.includes(memberGrade);
            }
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
              isoDate: text(item.isoDate),
              details: text(item.details),
              targetGrades: strings(item.targetGrades),
              href: rawHref ? (rawHref.startsWith("http") ? rawHref : websiteBase + (rawHref.startsWith("/") ? rawHref : "/" + rawHref)) : "",
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

    const effectivePointEvents = pointRows.map((event) => ({
      id: event.id,
      title: event.title || "فعالیت ثبت‌شده",
      points: number(event.points),
      createdAt: event.createdAt,
      note: event.note || "",
    }));
    const pointsBalance = effectivePointEvents.reduce((sum, event) => sum + event.points, 0);
    const pointEvents = effectivePointEvents.slice(0, 50);

    return NextResponse.json({
      pointsBalance,
      pointEvents,
      programs,
      siteContent: siteContent.filter((item) => item.kind !== "member-service"),
      memberServices: siteContent.filter((item) => item.kind === "member-service"),
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Member dashboard data could not be loaded", error);
    return NextResponse.json({ error: "دریافت برنامه‌ها و امتیازهای عضو ناموفق بود." }, { status: 503 });
  }
}
