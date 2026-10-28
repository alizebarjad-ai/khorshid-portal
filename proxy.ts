import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession, getConfiguredUsers } from "@/lib/auth";
import { findStaffAccount } from "@/lib/staff-accounts";
import { findMemberAccountByUsername } from "@/lib/member-accounts";

const PASSWORD_ALLOWED = new Set([
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/change-password",
  "/internal/change-password",
]);
const OWNER_ALLOWED_PREFIXES = ["/internal/owner", "/api/owner/"];
const MEMBER_CLUB_MANAGEMENT_PATHS = new Set(["/internal/members", "/internal/clubs", "/internal/membership-requests"]);
const MEMBER_WRITE_API_PATHS = new Set(["/api/records", "/api/member-points", "/api/member-progress"]);
const MEMBER_ALLOWED_PATHS = new Set([
  "/internal/member-home",
  "/internal/change-password",
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/change-password",
  "/api/member/profile",
  "/api/member/dashboard",
]);
const BENEFICIARY_PAGE_PATHS = new Set(["/internal/my-reward", "/internal/submit-proposal"]);
const BENEFICIARY_API_METHODS = new Map<string, Set<string>>([
  ["/api/auth/me", new Set(["GET"])],
  ["/api/auth/logout", new Set(["POST"])],
  ["/api/opportunities", new Set(["GET", "POST"])],
  ["/api/project-rewards", new Set(["GET"])],
]);

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/api/auth/login" || path === "/api/auth/activate") return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = decodeSession(token);
  if (!user) return NextResponse.next();

  // Central CSRF defense for authenticated browser sessions. API-key bridge requests
  // without a session cookie are handled separately and are not affected.
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if (!origin || origin !== request.nextUrl.origin || fetchSite === "cross-site") {
      return NextResponse.json({ error: "درخواست از مبدأ نامعتبر پذیرفته نشد." }, { status: 403 });
    }
  }

  const memberUpgradeApiAllowed =
    (path === "/api/member-upgrades" && request.method === "POST") ||
    (/^\/api\/member-upgrades\/documents\/[^/]+$/.test(path) && request.method === "GET");
  const memberContentApiAllowed =
    (path === "/api/member-content" && ["GET", "POST"].includes(request.method)) ||
    (/^\/api\/member-content\/files\/[^/]+$/.test(path) && request.method === "GET");

  if (user.role === "member") {
    try {
      const account = await findMemberAccountByUsername(user.username);
      const credentialVersion = account?.passwordChangedAt || account?.createdAt;
      if (!account || account.status !== "active" || account.memberId !== user.memberId || !user.credentialVersion || user.credentialVersion !== credentialVersion) {
        const response = path.startsWith("/api/")
          ? NextResponse.json({ error: "نشست شما منقضی شده یا وضعیت حساب تغییر کرده است؛ دوباره وارد شوید." }, { status: 401 })
          : NextResponse.redirect(new URL("/login?access=revoked", request.url));
        response.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
        return response;
      }
    } catch {
      return path.startsWith("/api/")
        ? NextResponse.json({ error: "بررسی وضعیت حساب ممکن نشد؛ دوباره تلاش کنید." }, { status: 503 })
        : NextResponse.redirect(new URL("/login?access=check-failed", request.url));
    }
  }

  if (user.role === "beneficiary") {
    const configured = getConfiguredUsers().find((item) => item.username === user.username && item.role === "beneficiary");
    const expectedVersion = configured?.password
      ? createHash("sha256").update(configured.password).digest("hex")
      : "";
    if (!configured || !user.credentialVersion || user.credentialVersion !== expectedVersion) {
      const response = path.startsWith("/api/")
        ? NextResponse.json({ error: "حساب ذی‌نفع غیرفعال شده یا اطلاعات ورود آن تغییر کرده است." }, { status: 403 })
        : NextResponse.redirect(new URL("/login?access=revoked", request.url));
      response.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
      return response;
    }
    const allowedApiMethods = BENEFICIARY_API_METHODS.get(path);
    const allowed = path.startsWith("/api/")
      ? Boolean(allowedApiMethods?.has(request.method))
      : BENEFICIARY_PAGE_PATHS.has(path);
    if (!allowed) {
      const response = path.startsWith("/api/")
        ? NextResponse.json({ error: "این بخش برای حساب ذی‌نفع پروژه در دسترس نیست." }, { status: 403 })
        : NextResponse.redirect(new URL("/internal/my-reward", request.url));
      return response;
    }
  }

  if (user.role === "member" && !MEMBER_ALLOWED_PATHS.has(path) && !memberUpgradeApiAllowed && !memberContentApiAllowed) {
    const response = path.startsWith("/api/")
      ? NextResponse.json({ error: "این بخش برای حساب عضو در دسترس نیست." }, { status: 403 })
      : NextResponse.redirect(new URL("/internal/member-home", request.url));
    return response;
  }

  if (user.role !== "member" && user.role !== "beneficiary") {
    try {
      const account = await findStaffAccount(user.username);
      const credentialVersion = account?.passwordChangedAt || account?.createdAt;
      if (!account || account.status === "disabled" || account.role !== user.role || !user.credentialVersion || user.credentialVersion !== credentialVersion) {
        const response = path.startsWith("/api/")
          ? NextResponse.json({ error: "این حساب غیرفعال شده یا دسترسی آن تغییر کرده است." }, { status: 403 })
          : NextResponse.redirect(new URL("/login?access=revoked", request.url));
        response.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
        return response;
      }
      if (account.mustChangePassword && !PASSWORD_ALLOWED.has(path)) {
        if (path.startsWith("/api/")) {
          return NextResponse.json({ error: "برای ادامه ابتدا رمز عبور شخصی تعیین کنید.", mustChangePassword: true }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/internal/change-password?required=1", request.url));
      }
    } catch {
      return path.startsWith("/api/")
        ? NextResponse.json({ error: "بررسی وضعیت حساب ممکن نشد؛ دوباره تلاش کنید." }, { status: 503 })
        : NextResponse.redirect(new URL("/login?access=check-failed", request.url));
    }
  }

  if (MEMBER_CLUB_MANAGEMENT_PATHS.has(path) && user.role !== "members") {
    const dashboardPath = user.role === "ceo"
      ? "/internal/roles/ceo"
      : user.role === "deputy"
        ? "/internal/roles/deputy"
        : "/login?access=forbidden";
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  if (MEMBER_WRITE_API_PATHS.has(path) && user.role !== "members") {
    return NextResponse.json(
      { error: "افزودن، ویرایش، حذف و تغییر امتیاز یا رده اعضا فقط برای معاونت اعضا مجاز است." },
      { status: 403 },
    );
  }

  if (user.role === "owner" && !OWNER_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix)) && !PASSWORD_ALLOWED.has(path)) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "حساب مالک فقط به پنل مالک دسترسی دارد." }, { status: 403 });
    return NextResponse.redirect(new URL("/internal/owner", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/internal/:path*", "/api/:path*"],
};
