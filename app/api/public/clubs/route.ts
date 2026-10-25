import { NextResponse } from "next/server";
import { readClubs } from "@/lib/records-store";
import { mergeClubCatalog } from "@/lib/club-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const clubs = await readClubs();
    const items = mergeClubCatalog(clubs.filter((club) => club.status !== "closed") as unknown as Array<Record<string, unknown>>)
      .map(({ id, name, clubType, status, city, description, source }) => ({ id, name, clubType, status, city, description, source }));
    return NextResponse.json({ clubs: items }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "دریافت فهرست باشگاه‌ها ناموفق بود." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
