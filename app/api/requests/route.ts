import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function auth(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 }) };
  const allowed = ["members", "economic", "csr", "media", "artists", "education", "ceo", "deputy"];
  if (!allowed.includes(user.role)) return { user: null, response: NextResponse.json({ error: "دسترسی به کارتابل درخواست‌ها مجاز نیست." }, { status: 403 }) };
  return { user, response: null };
}

async function upstream(path: string, init?: RequestInit) {
  const base = process.env.WEBSITE_MEMBERSHIP_API_URL;
  const key = process.env.PORTAL_MEMBERSHIP_API_KEY;
  if (!base || !key) throw new Error("اتصال امن به سامانه درخواست‌های سایت تنظیم نشده است.");
  const endpoint = base.replace(/\/api\/portal\/membership-requests\/?$/, "/api/portal/requests").replace(/\/$/, "");
  const response = await fetch(endpoint + path, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", "x-portal-membership-key": key, ...(init?.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}

function canSeeAll(role: string) {
  return role === "ceo" || role === "deputy";
}

export async function GET(request: NextRequest) {
  const checked = auth(request);
  if (!checked.user) return checked.response!;
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const response = await upstream("?id=" + encodeURIComponent(id));
      if (!response.ok) return response;
      const payload = await response.clone().json();
      const item = payload.item;
      if (!item) return NextResponse.json({ error: "درخواست پیدا نشد." }, { status: 404 });
      if (item.requestType === "membership") return NextResponse.json({ error: "این درخواست در کارتابل عضویت بررسی می‌شود." }, { status: 409 });
      if (!canSeeAll(checked.user.role) && item.assignedUnit !== checked.user.role) return NextResponse.json({ error: "این درخواست به واحد شما ارجاع نشده است." }, { status: 403 });
      return response;
    }
    const path = canSeeAll(checked.user.role) ? "" : "?unit=" + encodeURIComponent(checked.user.role);
    return await upstream(path);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "دریافت کارتابل ناموفق بود." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const checked = auth(request);
  if (!checked.user) return checked.response!;
  try {
    const body = await request.json();
    if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "شناسه درخواست معتبر نیست." }, { status: 400 });
    if (body.action === "assign" && !canSeeAll(checked.user.role)) return NextResponse.json({ error: "ارجاع درخواست به واحد دیگر فقط برای مدیرعامل یا قائم‌مقام مجاز است." }, { status: 403 });

    const current = await upstream("?id=" + encodeURIComponent(body.id));
    if (!current.ok) return current;
    const payload = await current.clone().json();
    const item = payload.item;
    if (!item || item.requestType === "membership") return NextResponse.json({ error: "درخواست عمومی پیدا نشد." }, { status: 404 });
    if (!canSeeAll(checked.user.role) && item.assignedUnit !== checked.user.role) return NextResponse.json({ error: "این درخواست به واحد شما ارجاع نشده است." }, { status: 403 });

    return await upstream("", {
      method: "PATCH",
      body: JSON.stringify({ ...body, actor: checked.user.name }),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت تغییرات درخواست ناموفق بود." }, { status: 503 });
  }
}
