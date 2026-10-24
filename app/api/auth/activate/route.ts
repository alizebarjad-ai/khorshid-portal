import { NextResponse } from "next/server";
import { COOKIE_NAME, encodeSession } from "@/lib/auth";
import { activateMemberAccount, findMemberAccountByActivationToken } from "@/lib/member-accounts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 12) return NextResponse.json({ error: "رمز عبور باید دست‌کم ۱۲ نویسه داشته باشد." }, { status: 400 });
    const account = await findMemberAccountByActivationToken(token);
    if (!account) return NextResponse.json({ error: "پیوند فعال‌سازی نامعتبر یا منقضی شده است. از معاونت اعضا پیوند تازه درخواست کنید." }, { status: 400 });
    const active = await activateMemberAccount(account, password, token);
    if (!active) return NextResponse.json({ error: "این پیوند قبلاً استفاده شده یا منقضی شده است. برای فعال‌سازی، پیوند تازه درخواست کنید." }, { status: 409 });
    const response = NextResponse.json({ success: true, user: { username: active.username, name: active.fullName, role: "member", memberId: active.memberId } });
    response.cookies.set(COOKIE_NAME, encodeSession({ username: active.username, name: active.fullName, role: "member", memberId: active.memberId }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (error) {
    console.error("Member activation failed", error);
    return NextResponse.json({ error: "فعال‌سازی حساب انجام نشد." }, { status: 503 });
  }
}
