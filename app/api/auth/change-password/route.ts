import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession, encodeSession } from "@/lib/auth";
import { changeMemberPassword, findMemberAccountByUsername, verifyMemberPassword } from "@/lib/member-accounts";
import { findStaffAccount, updateStaffPassword, verifyStaffPassword } from "@/lib/staff-accounts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });

  try {
    const body = await request.json();
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (newPassword.length < 12) return NextResponse.json({ error: "رمز جدید باید دست‌کم ۱۲ نویسه داشته باشد." }, { status: 400 });
    if (newPassword === currentPassword) return NextResponse.json({ error: "رمز جدید باید با رمز فعلی متفاوت باشد." }, { status: 400 });

    if (session.role === "member") {
      const account = await findMemberAccountByUsername(session.username);
      if (!account || account.status !== "active" || !verifyMemberPassword(currentPassword, account.passwordHash)) {
        return NextResponse.json({ error: "رمز عبور فعلی صحیح نیست." }, { status: 400 });
      }
      await changeMemberPassword(account, newPassword);
      return NextResponse.json({ success: true });
    }

    if (session.role === "beneficiary") {
      return NextResponse.json({ error: "تغییر رمز این نوع حساب از این مسیر پشتیبانی نمی‌شود." }, { status: 403 });
    }

    const account = await findStaffAccount(session.username);
    if (!account || account.role !== session.role || !verifyStaffPassword(currentPassword, account.passwordHash)) {
      return NextResponse.json({ error: "رمز عبور فعلی صحیح نیست." }, { status: 400 });
    }

    await updateStaffPassword(account, newPassword);
    const response = NextResponse.json({ success: true, mustChangePassword: false });
    response.cookies.set(COOKIE_NAME, encodeSession({
      username: session.username,
      name: session.name,
      role: session.role,
    }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (error) {
    console.error("Password change failed", error);
    return NextResponse.json({ error: "تغییر رمز عبور انجام نشد." }, { status: 503 });
  }
}
