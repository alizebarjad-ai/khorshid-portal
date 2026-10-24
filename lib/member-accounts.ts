import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getStored, listStored, putStored } from "@/lib/persistent-store";
import { randomUUID } from "node:crypto";

export type MemberAccount = {
  id: string;
  kind: "member-account";
  memberId: string;
  username: string;
  fullName: string;
  email: string;
  status: "pending_activation" | "active" | "suspended";
  passwordHash: string;
  activationTokenHash?: string;
  activationExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

function asciiDigits(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export function normalizeMemberUsername(value: string) {
  let digits = asciiDigits(value).replace(/\D/g, "");
  if (digits.startsWith("0098") && digits.length === 14) digits = "0" + digits.slice(4);
  else if (digits.startsWith("98") && digits.length === 12) digits = "0" + digits.slice(2);
  return digits;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}

export function verifyMemberPassword(password: string, encoded: string) {
  const [salt, expectedHex] = encoded.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export async function findMemberAccountByUsername(username: string) {
  const normalized = normalizeMemberUsername(username);
  const accounts = await listStored<MemberAccount>("member-accounts");
  return accounts.find((account) => account.username === normalized) || null;
}

export async function prepareMemberActivation(input: { memberId: string; phone: string; fullName: string; email: string }) {
  const username = normalizeMemberUsername(input.phone);
  if (username.length < 8) throw new Error("شماره تماس عضو برای ساخت نام کاربری معتبر نیست.");
  const accounts = await listStored<MemberAccount>("member-accounts");
  const existing = accounts.find((account) => account.memberId === input.memberId || account.username === username) || null;
  if (existing?.status === "active") {
    const updated = { ...existing, memberId: input.memberId, fullName: input.fullName, email: input.email.trim().toLowerCase(), updatedAt: new Date().toISOString() };
    await putStored("member-accounts", updated);
    return { account: updated, activationToken: null as string | null };
  }
  const activationToken = randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  const account: MemberAccount = {
    id: existing?.id || randomUUID(),
    kind: "member-account",
    memberId: input.memberId,
    username,
    fullName: input.fullName,
    email: input.email.trim().toLowerCase(),
    status: "pending_activation",
    passwordHash: existing?.passwordHash || "",
    activationTokenHash: tokenHash(activationToken),
    activationExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await putStored("member-accounts", account);
  return { account, activationToken };
}

export async function findMemberAccountByActivationToken(token: string) {
  if (!token || token.length < 40) return null;
  const hash = tokenHash(token);
  const accounts = await listStored<MemberAccount>("member-accounts");
  const account = accounts.find((item) => item.activationTokenHash === hash) || null;
  if (!account || account.status !== "pending_activation" || !account.activationExpiresAt || new Date(account.activationExpiresAt).getTime() < Date.now()) return null;
  return account;
}

export async function activateMemberAccount(account: MemberAccount, password: string) {
  const updated: MemberAccount = {
    ...account,
    passwordHash: passwordHash(password),
    status: "active",
    activationTokenHash: undefined,
    activationExpiresAt: undefined,
    updatedAt: new Date().toISOString(),
  };
  await putStored("member-accounts", updated);
  return updated;
}

export async function changeMemberPassword(account: MemberAccount, password: string) {
  const updated = { ...account, passwordHash: passwordHash(password), updatedAt: new Date().toISOString() };
  await putStored("member-accounts", updated);
  return updated;
}

export async function recordMemberLogin(account: MemberAccount) {
  const updated = { ...account, lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await putStored("member-accounts", updated);
  return updated;
}
