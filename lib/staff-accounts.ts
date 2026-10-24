import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getStored, putStored } from "@/lib/persistent-store";
import type { UserRole } from "@/lib/auth";

export type StaffAccount = {
  id: string;
  kind: "staff-account";
  username: string;
  name?: string;
  role: Exclude<UserRole, "member" | "beneficiary">;
  passwordHash: string;
  mustChangePassword: boolean;
  status?: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}

export function verifyStaffPassword(password: string, encoded: string) {
  const [salt, expectedHex] = encoded.split(":");
  if (!salt || !expectedHex) return false;
  try {
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createPasswordHash(password: string) {
  return hashPassword(password);
}

export async function findStaffAccount(username: string) {
  const account = await getStored<StaffAccount>("staff-accounts", username);
  return account?.kind === "staff-account" ? account : null;
}

/** First successful env-based login creates a persistent credential and requires a password change. */
export async function authenticateStaff(
  configured: { username: string; password: string; name?: string; role: StaffAccount["role"] },
  suppliedPassword: string,
) {
  const existing = await findStaffAccount(configured.username);
  if (existing) {
    if (existing.status === "disabled" || existing.role !== configured.role || !verifyStaffPassword(suppliedPassword, existing.passwordHash)) return null;
    return existing;
  }
  if (!configured.password || configured.password !== suppliedPassword) return null;
  const now = new Date().toISOString();
  const account: StaffAccount = {
    id: configured.username,
    kind: "staff-account",
    username: configured.username,
    name: configured.name,
    role: configured.role,
    passwordHash: hashPassword(suppliedPassword),
    mustChangePassword: true,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await putStored("staff-accounts", account);
  return account;
}

export async function updateStaffPassword(account: StaffAccount, password: string, mustChangePassword = false) {
  const updated: StaffAccount = {
    ...account,
    passwordHash: hashPassword(password),
    mustChangePassword,
    updatedAt: new Date().toISOString(),
  };
  await putStored("staff-accounts", updated);
  return updated;
}

export async function recordStaffLogin(account: StaffAccount) {
  const updated = { ...account, lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await putStored("staff-accounts", updated);
  return updated;
}
