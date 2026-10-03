import { NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession, encodeSession, getConfiguredUsers } from "@/lib/auth";

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const user = decodeSession(match?.[1] || null);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: { username: user.username, name: user.name, role: user.role } });
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

    const user = getConfiguredUsers().find(
      (item) => item.username === username && item.password && item.password === password
    );

    if (!user) {
      return NextResponse.json({ error: "نام کاربری یا رمز عبور نادرست است." }, { status: 401 });
    }

    const response = NextResponse.json({
      user: { username: user.username, name: user.name, role: user.role },
    });

    response.cookies.set(COOKIE_NAME, encodeSession({
      username: user.username,
      name: user.name,
      role: user.role,
    }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "درخواست ورود معتبر نیست." }, { status: 400 });
  }
}
