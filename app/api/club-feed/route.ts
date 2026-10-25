import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const base = (process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://www.khorshid-mafakher.ir").replace(/\/$/, "");
  try {
    const response = await fetch(base + "/api/club-feed", { cache: "no-store", headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || !Array.isArray(data.items)) {
      return NextResponse.json({ error: "دریافت برنامه‌ها و محتوای باشگاه‌ها از سایت اصلی انجام نشد." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ items: data.items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "اتصال به سایت اصلی برقرار نشد." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
