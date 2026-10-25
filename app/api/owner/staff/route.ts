import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession, getConfiguredUsers, ROLE_LABELS } from "@/lib/auth";
import { deleteStored, listStored, putStored } from "@/lib/persistent-store";
import { createPasswordHash, findStaffAccount, type StaffAccount, updateStaffPassword } from "@/lib/staff-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ownerOnly(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 }) };
  if (user.role !== "owner" || user.mustChangePassword) {
    return { user: null, response: NextResponse.json({ error: "دسترسی مالک سامانه لازم است." }, { status: 403 }) };
  }
  return { user, response: null };
}

function temporaryPassword() {
  return randomBytes(18).toString("base64url");
}

async function audit(actor: string, action: string, target: string, metadata: Record<string, string> = {}) {
  try {
    await putStored("security-audit", {
      id: randomUUID(),
      kind: "security-audit",
      actor,
      action,
      target,
      metadata,
      at: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

async function getAccount(username: string): Promise<StaffAccount | null> {
  const existing = await findStaffAccount(username);
  if (existing) return existing;
  const configured = getConfiguredUsers().find((item) => item.username === username && item.role !== "beneficiary");
  if (!configured) return null;
  const now = new Date().toISOString();
  return {
    id: username,
    kind: "staff-account",
    username,
    name: configured.name,
    role: configured.role as StaffAccount["role"],
    passwordHash: "",
    mustChangePassword: true,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

export async function GET(request: NextRequest) {
  const checked = ownerOnly(request);
  if (!checked.user) return checked.response!;
  try {
    const [stored, configured] = await Promise.all([
      listStored<StaffAccount>("staff-accounts"),
      Promise.resolve(getConfiguredUsers().filter((item) => item.role !== "beneficiary")),
    ]);
    const byUsername = new Map<string, StaffAccount>();
    for (const account of stored) byUsername.set(account.username, account);
    for (const item of configured) {
      if (!byUsername.has(item.username)) {
        byUsername.set(item.username, {
          id: item.username,
          kind: "staff-account",
          username: item.username,
          name: item.name,
          role: item.role as StaffAccount["role"],
          passwordHash: "",
          mustChangePassword: true,
          status: "active",
          createdAt: "",
          updatedAt: "",
        });
      }
    }
    const accounts = [...byUsername.values()]
      .filter((account) => account.role !== "owner")
      .map(({ username, name, role, status, mustChangePassword, createdAt, updatedAt, lastLoginAt }) => ({
        username, name: name || username, role, roleLabel: ROLE_LABELS[role],
        status: status || "active", mustChangePassword, createdAt, updatedAt, lastLoginAt,
      }));
    const auditItems = (await listStored<{ id: string; kind: string; actor: string; action: string; target: string; at: string; metadata?: Record<string, string> }>("security-audit"))
      .filter((item) => item.kind === "security-audit").slice(0, 50)
      .map(({ actor, action, target, at, metadata }) => ({ actor, action, target, at, metadata }));
    return NextResponse.json({ accounts, audit: auditItems });
  } catch {
    return NextResponse.json({ error: "دریافت فهرست حساب‌ها ناموفق بود." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const checked = ownerOnly(request);
  if (!checked.user) return checked.response!;
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "درخواست از مبدأ نامعتبر پذیرفته نشد." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = String(body.action || "");
    const username = String(body.username || "").trim();
    if (!username || username.length > 100) {
      return NextResponse.json({ error: "نام کاربری معتبر نیست." }, { status: 400 });
    }
    if (username === checked.user.username || username.toLowerCase() === "owner") {
      return NextResponse.json({ error: "مدیریت یا غیرفعال‌کردن حساب مالک از این پنل مجاز نیست." }, { status: 403 });
    }

    const account = await getAccount(username);
    if (!account || account.role === "owner") {
      return NextResponse.json({ error: "حساب موردنظر پیدا نشد." }, { status: 404 });
    }

    if (action === "reset-password") {
      const password = temporaryPassword();
      const updated = await updateStaffPassword(
        account.passwordHash ? account : { ...account, passwordHash: createPasswordHash(password) },
        password,
        true,
      );
      const auditRecorded = await audit(checked.user.username, "reset-password", username);
      return NextResponse.json({ success: true, username, temporaryPassword: password, mustChangePassword: updated.mustChangePassword, auditRecorded });
    }

    if (action === "deactivate" || action === "activate") {
      const updated: StaffAccount = {
        ...account,
        status: action === "deactivate" ? "disabled" : "active",
        updatedAt: new Date().toISOString(),
      };
      await putStored("staff-accounts", updated);
      const auditRecorded = await audit(checked.user.username, action, username, { role: account.role });
      return NextResponse.json({ success: true, username, status: updated.status, auditRecorded });
    }

    if (action === "transfer") {
      if (account.status === "disabled") {
        return NextResponse.json({ error: "حساب مبدأ غیرفعال است؛ ابتدا آن را فعال کنید یا انتقال دیگری انجام دهید." }, { status: 409 });
      }
      const newUsername = String(body.newUsername || "").trim();
      const newName = String(body.newName || "").trim();
      if (!/^[a-zA-Z0-9._-]{3,60}$/.test(newUsername) || newName.length < 2 || newName.length > 120) {
        return NextResponse.json({ error: "نام کاربری جدید باید ۳ تا ۶۰ نویسه انگلیسی و نام فرد باید معتبر باشد." }, { status: 400 });
      }
      if (newUsername.toLowerCase() === "owner" || newUsername === checked.user.username || await findStaffAccount(newUsername) || getConfiguredUsers().some((item) => item.username === newUsername)) {
        return NextResponse.json({ error: "نام کاربری جدید قبلاً استفاده شده یا مجاز نیست." }, { status: 409 });
      }
      const password = temporaryPassword();
      const now = new Date().toISOString();
      const successor: StaffAccount = {
        id: newUsername,
        kind: "staff-account",
        username: newUsername,
        name: newName,
        role: account.role,
        passwordHash: createPasswordHash(password),
        mustChangePassword: true,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      // Preserve the previous identity and history; the successor receives a separate account.
      await putStored("staff-accounts", successor);
      try {
        await putStored("staff-accounts", { ...account, status: "disabled", updatedAt: now });
      } catch (error) {
        await deleteStored("staff-accounts", newUsername).catch(() => undefined);
        throw error;
      }
      const auditRecorded = await audit(checked.user.username, "transfer-role", username, { successor: newUsername, role: account.role });
      return NextResponse.json({ success: true, previousUsername: username, username: newUsername, name: newName, role: account.role, temporaryPassword: password, auditRecorded });
    }

    return NextResponse.json({ error: "عملیات درخواستی پشتیبانی نمی‌شود." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "اجرای عملیات مدیریتی ناموفق بود." }, { status: 503 });
  }
}
