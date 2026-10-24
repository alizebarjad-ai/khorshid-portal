import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { readRecordAudit } from "@/lib/records-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const allowed = ["ceo", "deputy", "members"] as const;

export async function GET(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (!allowed.includes(user.role as typeof allowed[number])) {
    return NextResponse.json({ error: "دسترسی به سوابق تغییرات مجاز نیست." }, { status: 403 });
  }
  try {
    const limitValue = Number(request.nextUrl.searchParams.get("limit") || 200);
    const events = await readRecordAudit(Number.isFinite(limitValue) ? limitValue : 200);
    return NextResponse.json({ events });
  } catch (error) {
    console.error("Record audit GET failed", error);
    return NextResponse.json({ error: "دریافت سوابق تغییرات انجام نشد." }, { status: 503 });
  }
}
