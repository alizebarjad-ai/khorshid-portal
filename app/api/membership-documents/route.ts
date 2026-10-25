import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (!["members", "ceo", "deputy"].includes(user.role)) return NextResponse.json({ error: "دسترسی به مدارک عضویت مجاز نیست." }, { status: 403 });

  const apiBase = process.env.WEBSITE_MEMBERSHIP_API_URL;
  const key = process.env.PORTAL_MEMBERSHIP_API_KEY;
  const documentId = request.nextUrl.searchParams.get("documentId");
  if (!apiBase || !key || !documentId) return NextResponse.json({ error: "تنظیمات اتصال یا شناسه مدرک معتبر نیست." }, { status: 400 });

  try {
    // Derive the document endpoint from the existing website API base so deployments
    // do not silently fail when a second, undocumented URL variable is missing.
    const endpoint = new URL("/api/portal/membership-documents", apiBase);
    endpoint.searchParams.set("documentId", documentId);
    const response = await fetch(endpoint, {
      headers: { "x-portal-membership-key": key },
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status });
    }
    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
        "Content-Disposition": response.headers.get("Content-Disposition") || "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "دریافت مدرک انجام نشد." }, { status: 503 });
  }
}
