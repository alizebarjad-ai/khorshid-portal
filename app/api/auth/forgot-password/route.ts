import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { findMemberAccountByEmail, setMemberPasswordResetToken } from "@/lib/member-accounts";
import { getStored, putStored, withPersistentAdvisoryLock } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const genericResponse = {
  ok: true,
  message: "اگر حساب فعالی با این ایمیل وجود داشته باشد، پیوند بازیابی برای آن ارسال می‌شود.",
};
const RATE_LIMIT_MS = 60_000;

function keyFor(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function consumeRateLimit(id: string) {
  return withPersistentAdvisoryLock("password-reset:" + id, async () => {
    const previous = await getStored<{ id: string; requestedAt: string }>("password-reset-throttle", id);
    const requestedAt = previous ? Date.parse(previous.requestedAt) : 0;
    if (Number.isFinite(requestedAt) && Date.now() - requestedAt < RATE_LIMIT_MS) return false;
    await putStored("password-reset-throttle", { id, requestedAt: new Date().toISOString() });
    return true;
  });
}

function generic() {
  return NextResponse.json(genericResponse, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic();

    const ip = (request.headers.get("x-real-ip") || (request.headers.get("x-forwarded-for") || "").split(",")[0] || "unknown").trim().slice(0, 100);
    const ipKey = keyFor("ip:" + ip);
    const emailKey = keyFor("email:" + email);

    // Apply limits before looking up the account so response status and throttling
    // cannot be used to enumerate registered email addresses.
    const [ipAllowed, emailAllowed] = await Promise.all([
      consumeRateLimit(ipKey),
      consumeRateLimit(emailKey),
    ]);
    if (!ipAllowed || !emailAllowed) return generic();

    const account = await findMemberAccountByEmail(email);
    if (!account || account.status !== "active") return generic();

    const token = randomBytes(32).toString("hex");
    await setMemberPasswordResetToken(account, token);

    const base = (process.env.WEBSITE_PASSWORD_RESET_EMAIL_URL || "https://www.khorshid-mafakher.ir/api/portal/password-reset-email").trim();
    const apiKey = process.env.PORTAL_MEMBERSHIP_API_KEY || "";
    const sent = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-membership-key": apiKey },
      body: JSON.stringify({
        name: account.fullName,
        email: account.email,
        resetUrl: new URL("/reset-password?token=" + encodeURIComponent(token), portalOrigin).toString(),
      }),
      cache: "no-store",
    });

    if (!sent.ok) {
      console.error("Password reset email dispatch failed:", sent.status);
      // Never expose whether the account exists or whether mail delivery succeeded.
      return generic();
    }
    return generic();
  } catch (error) {
    console.error("Password reset request failed:", error instanceof Error ? error.name : "UnknownError");
    // Keep the public response indistinguishable from an unknown email address.
    return generic();
  }
}
