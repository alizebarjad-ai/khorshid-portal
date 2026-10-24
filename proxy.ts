import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { findStaffAccount } from "@/lib/staff-accounts";

const PASSWORD_ALLOWED = new Set([
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/change-password",
  "/internal/change-password",
]);
const OWNER_ALLOWED_PREFIXES = ["/internal/owner", "/api/owner/"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/api/auth/login") return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = decodeSession(token);
  if (!user) return NextResponse.next();

  if (user.role !== "member" && user.role !== "beneficiary") {
    try {
      const account = await findStaffAccount(user.username);
      if (!account || account.status === "disabled" || account.role !== user.role) {
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

  if (user.role === "owner" && !OWNER_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix)) && path !== "/api/auth/me" && path !== "/api/auth/logout" && path !== "/api/auth/change-password") {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "حساب مالک فقط به پنل مالک دسترسی دارد." }, { status: 403 });
    return NextResponse.redirect(new URL("/internal/owner", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/internal/:path*", "/api/:path*"],
};
