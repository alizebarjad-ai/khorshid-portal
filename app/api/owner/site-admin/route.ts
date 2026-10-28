import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBSITE_BRIDGE_URL = "https://www.khorshid-mafakher.ir/api/owner-bridge/admin";

function authorize(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 }) };
  if (user.role !== "owner" || user.mustChangePassword) {
    return { user: null, response: NextResponse.json({ error: "دسترسی مالک سامانه لازم است." }, { status: 403 }) };
  }
  const origin = request.headers.get("origin");
  if (request.method !== "GET" && (!origin || origin !== request.nextUrl.origin)) {
    return { user: null, response: NextResponse.json({ error: "درخواست از مبدأ نامعتبر پذیرفته نشد." }, { status: 403 }) };
  }
  return { user, response: null };
}

async function bridge(method: "GET" | "POST", body?: Record<string, string>) {
  const key = process.env.PORTAL_MEMBERSHIP_API_KEY || "";
  if (!key) return NextResponse.json({ error: "اتصال امن به سایت اصلی پیکربندی نشده است." }, { status: 503 });
  try {
    const response = await fetch(WEBSITE_BRIDGE_URL, {
      method,
      headers: { "x-portal-membership-key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
    const result = await response.json();
    return NextResponse.json(result, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "ارتباط امن با سایت اصلی برقرار نشد." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  const checked = authorize(request);
  if (!checked.user) return checked.response!;
  return bridge("GET");
}

export async function POST(request: NextRequest) {
  const checked = authorize(request);
  if (!checked.user) return checked.response!;
  let body: { action?: string; newUsername?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "درخواست معتبر نیست." }, { status: 400 });
  }
  const action = body.action;
  if (action !== "reset-password" && action !== "transfer") {
    return NextResponse.json({ error: "عملیات درخواستی پشتیبانی نمی‌شود." }, { status: 400 });
  }
  const payload: Record<string, string> = { action };
  if (action === "transfer") {
    const newUsername = typeof body.newUsername === "string" ? body.newUsername.trim() : "";
    if (!/^[a-zA-Z0-9._-]{3,60}$/.test(newUsername) || newUsername.toLowerCase() === "owner") {
      return NextResponse.json({ error: "نام کاربری جدید باید ۳ تا ۶۰ نویسه انگلیسی معتبر باشد." }, { status: 400 });
    }
    payload.newUsername = newUsername;
  }
  return bridge("POST", payload);
}
