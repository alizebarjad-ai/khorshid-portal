import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { changeMemberPassword, findMemberAccountByUsername, verifyMemberPassword } from "@/lib/member-accounts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (user.role !== "member") return NextResponse.json({ error: "این عملیات مخصوص اعضاست." }, { status: 403 });
  try {
    const body = await request.json();
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (newPassword.length < 12) return NextResponse.json({ error: "رمز جدید باید دست‌کم ۱۲ نویسه داشته باشد." }, { status: 400 });
    const account = await findMemberAccountByUsername(user.username);
    if (!account || account.status !== "active" || !verifyMemberPassword(currentPassword, account.passwordHash)) {
      return NextResponse.json({ error: "رمز عبور فعلی صحیح نیست." }, { status: 400 });
    }
    await changeMemberPassword(account, newPassword);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Member password change failed", error);
    return NextResponse.json({ error: "تغییر رمز عبور انجام نشد." }, { status: 503 });
  }
}
