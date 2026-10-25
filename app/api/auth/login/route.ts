import { NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession, encodeSession, getConfiguredUsers } from "@/lib/auth";
import { findMemberAccountByUsername, recordMemberLogin, verifyMemberPassword } from "@/lib/member-accounts";
import { authenticateStaff, findStaffAccount, recordStaffLogin } from "@/lib/staff-accounts";

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const user = decodeSession(match?.[1] || null);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: { username: user.username, name: user.name, role: user.role, ...(user.mustChangePassword ? { mustChangePassword: true } : {}) } });
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "logout") {
      const response = NextResponse.json({ ok: true });
      response.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
      return response;
    }

    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    const configuredUser = getConfiguredUsers().find((item) => item.username === username);
    const existingStaff = configuredUser?.role === "beneficiary" ? null : await findStaffAccount(username);
    const staffConfig = configuredUser && configuredUser.role !== "beneficiary"
      ? { username: configuredUser.username, password: configuredUser.password, name: configuredUser.name, role: configuredUser.role }
      : !configuredUser && existingStaff
        ? { username: existingStaff.username, password: "", name: existingStaff.name || existingStaff.username, role: existingStaff.role }
        : null;
    const staffAccount = staffConfig ? await authenticateStaff(staffConfig, password) : null;

    let sessionUser: { username: string; name: string; role: "finance" | "ceo" | "deputy" | "beneficiary" | "economic" | "csr" | "media" | "artists" | "education" | "members" | "member" | "owner"; memberId?: string; mustChangePassword?: boolean };
    if (configuredUser?.role === "beneficiary" && configuredUser.password === password) {
      sessionUser = { username: configuredUser.username, name: configuredUser.name, role: configuredUser.role };
    } else if (staffAccount) {
      await recordStaffLogin(staffAccount);
      sessionUser = { username: staffAccount.username, name: staffAccount.name || configuredUser?.name || staffAccount.username, role: staffAccount.role, mustChangePassword: staffAccount.mustChangePassword };
    } else {
      const account = await findMemberAccountByUsername(username);
      if (!account) {
        return NextResponse.json({ error: "نام کاربری یا رمز عبور نادرست است." }, { status: 401 });
      }
      if (account.status !== "active") {
        return NextResponse.json({ error: account.status === "pending_activation" ? "حساب شما هنوز فعال نشده است. پیوند فعال‌سازی ارسال‌شده به ایمیل را باز کنید." : "دسترسی این حساب غیرفعال است." }, { status: 403 });
      }
      if (!account.passwordHash || !verifyMemberPassword(password, account.passwordHash)) {
        return NextResponse.json({ error: "نام کاربری یا رمز عبور نادرست است." }, { status: 401 });
      }
      await recordMemberLogin(account);
      sessionUser = { username: account.username, name: account.fullName, role: "member", memberId: account.memberId };
    }

    const response = NextResponse.json({
      user: { username: sessionUser.username, name: sessionUser.name, role: sessionUser.role, ...(sessionUser.memberId ? { memberId: sessionUser.memberId } : {}), ...(sessionUser.mustChangePassword ? { mustChangePassword: true } : {}) },
    });

    response.cookies.set(COOKIE_NAME, encodeSession(sessionUser), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (error) {
    // Log only the server-side failure details; never log submitted credentials or request bodies.
    console.error("[auth/login] request failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    return NextResponse.json({ error: "درخواست ورود معتبر نیست." }, { status: 400 });
  }
}
