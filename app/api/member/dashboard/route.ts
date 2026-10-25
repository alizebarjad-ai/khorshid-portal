import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readMembers, readClubs } from "@/lib/records-store";
import { listStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoredItem = Record<string, unknown>;

const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const strings = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
const clubKeyForName = (name: string): string | null => {
  if (name.includes("رسانه")) return "media";
  if (name.includes("سینما") || name.includes("تئاتر")) return "cinema";
  if (name.includes("موسیقی")) return "music";
  if (name.includes("ادبیات")) return "art";
  if (name.includes("تجسمی") || name.includes("طراحی")) return "visual";
  if (name.includes("مسئولیت اجتماعی")) return "responsibility";
  if (name.includes("آموزش")) return "education";
  if (name.includes("توسعه") || name.includes("شبکه")) return "partnership";
  return null;
};

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

    const [programRows, pointRows, allClubs] = await Promise.all([
      listStored<StoredItem>("club-programs"),
      listStored<StoredItem>("member-points"),
      readClubs(),
    ]);
    const clubIds = new Set(member.clubIds || []);
    const memberClubKeys = new Set(allClubs.filter((club) => clubIds.has(club.id)).map((club) => clubKeyForName(club.name)).filter((key): key is string => Boolean(key)));
    const siteBase = (process.env.KHORSHID_WEBSITE_URL || "https://www.khorshid-mafakher.ir").replace(/\/$/, "");
    const siteContent = await fetch(siteBase + "/api/club-feed", { cache: "no-store", signal: AbortSignal.timeout(3500) })
      .then(async (response) => response.ok ? (await response.json()).items as StoredItem[] : [])
      .catch(() => [] as StoredItem[]);
    const memberContent = siteContent.filter((item) => {
      if (item.showToMembers !== true) return false;
      const targeted = strings(item.clubIds);
      return targeted.length === 0 || targeted.some((key) => memberClubKeys.has(key));
    }).map((item) => ({ id: text(item.id), title: text(item.title), kind: text(item.kind), description: text(item.description), image: text(item.image), dateLabel: text(item.dateLabel), href: text(item.href), linkLabel: text(item.linkLabel) })).filter((item) => item.id && item.title);
    const now = Date.now();

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

    const allPointEvents = pointRows.flatMap((item) => {
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
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pointEvents = allPointEvents.slice(0, 50);

    return NextResponse.json({
      pointsBalance: allPointEvents.reduce((sum, event) => sum + event.points, 0),
      pointEvents,
      programs,
      siteContent: memberContent,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Member dashboard data could not be loaded", error);
    return NextResponse.json({ error: "دریافت برنامه‌ها و امتیازهای عضو ناموفق بود." }, { status: 503 });
  }
}
