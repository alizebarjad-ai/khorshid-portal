import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function auth(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 }) };
  if (!["members", "ceo", "deputy"].includes(user.role)) return { user: null, response: NextResponse.json({ error: "دسترسی به کارتابل درخواست‌های عضویت مجاز نیست." }, { status: 403 }) };
  return { user, response: null };
}

async function upstream(path: string, init?: RequestInit) {
  const base = process.env.WEBSITE_MEMBERSHIP_API_URL;
  const key = process.env.PORTAL_MEMBERSHIP_API_KEY;
  if (!base || !key) throw new Error("اتصال امن به سامانه درخواست‌های سایت تنظیم نشده است.");
  const response = await fetch(base.replace(/\/$/, "") + path, {
    ...init, cache: "no-store",
    headers: { "Content-Type": "application/json", "x-portal-membership-key": key, ...(init?.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}

export async function GET(request: NextRequest) {
  const checked = auth(request);
  if (!checked.user) return checked.response!;
  try {
    const id = request.nextUrl.searchParams.get("id");
    return await upstream(id ? "?id=" + encodeURIComponent(id) : "");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "دریافت درخواست‌ها ناموفق بود." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const checked = auth(request);
  if (!checked.user) return checked.response!;
  try {
    const body = await request.json();
    return await upstream("", { method: "PATCH", body: JSON.stringify({ ...body, actor: checked.user.name }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت تصمیم انجام نشد." }, { status: 503 });
  }
}
