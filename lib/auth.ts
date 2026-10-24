import { createHmac, timingSafeEqual } from "crypto";

export type UserRole =
  | "finance"
  | "ceo"
  | "deputy"
  | "beneficiary"
  | "economic"
  | "csr"
  | "media"
  | "artists"
  | "education"
  | "members"
  | "member"
  | "owner";

export type SessionUser = {
  username: string;
  name: string;
  role: UserRole;
  beneficiaryName?: string;
  memberId?: string;
  mustChangePassword?: boolean;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  finance: "معاون توسعه منابع مالی و اداری",
  ceo: "مدیرعامل",
  deputy: "قائم‌مقام و معاون برنامه‌ریزی و راهبردی",
  beneficiary: "ذی‌نفع پروژه",
  economic: "معاونت توسعه مشارکت‌های اقتصادی",
  csr: "معاونت اجتماعی برنامه‌های حمایتی",
  media: "معاونت رسانه و محتوا",
  artists: "معاونت امور هنرمندان",
  education: "معاونت آموزش، پژوهش و نوآوری",
  members: "معاونت مفاخر و امور اعضا",
  member: "عضو خورشید مفاخر",
  owner: "مالک سامانه",
};

const COOKIE_NAME = "khorshid_session";

function secret(): string | null {
  const configured = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    return configured && configured.length >= 32 ? configured : null;
  }
  return configured || "local-development-only-secret";
}

function sign(value: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(value).digest("base64url");
}

export function encodeSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 }), "utf8").toString("base64url");
  const signature = sign(payload);
  if (!signature) throw new Error("AUTH_SECRET باید در محیط production با حداقل ۳۲ نویسه تنظیم شود.");
  return payload + "." + signature;
}

export function decodeSession(value?: string | null): SessionUser | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (!expected) return null;
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser & { exp?: number };
    if (!user.exp || user.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!user.username || !user.name || !ROLE_LABELS[user.role]) return null;
    return user;
  } catch {
    return null;
  }
}

type ConfiguredUser = { username: string; password: string; name: string; role: Exclude<UserRole, "member"> };

export function getConfiguredUsers() {
  const managementUsers: ConfiguredUser[] = [
    {
      username: process.env.AUTH_OWNER_USERNAME || "owner",
      password: process.env.AUTH_OWNER_PASSWORD || "",
      name: process.env.AUTH_OWNER_NAME || "مالک سامانه",
      role: "owner",
    },
    {
      username: process.env.AUTH_FINANCE_USERNAME || "finance",
      password: process.env.AUTH_FINANCE_PASSWORD || "1234",
      name: process.env.AUTH_FINANCE_NAME || "معاون توسعه منابع مالی و اداری",
      role: "finance",
    },
    {
      username: process.env.AUTH_CEO_USERNAME || "ceo",
      password: process.env.AUTH_CEO_PASSWORD || "1234",
      name: process.env.AUTH_CEO_NAME || "مدیرعامل",
      role: "ceo",
    },
    {
      username: process.env.AUTH_DEPUTY_USERNAME || "deputy",
      password: process.env.AUTH_DEPUTY_PASSWORD || "1234",
      name: process.env.AUTH_DEPUTY_NAME || "قائم‌مقام و معاون برنامه‌ریزی و راهبردی",
      role: "deputy",
    },
  ];

  const unitUsers: ConfiguredUser[] = [
    { username: process.env.AUTH_ECONOMIC_USERNAME || "economic", password: process.env.AUTH_ECONOMIC_PASSWORD || "1234", name: process.env.AUTH_ECONOMIC_NAME || "معاونت توسعه مشارکت‌های اقتصادی", role: "economic" },
    { username: process.env.AUTH_CSR_USERNAME || "csr", password: process.env.AUTH_CSR_PASSWORD || "1234", name: process.env.AUTH_CSR_NAME || "معاونت اجتماعی برنامه‌های حمایتی", role: "csr" },
    { username: process.env.AUTH_MEDIA_USERNAME || "media", password: process.env.AUTH_MEDIA_PASSWORD || "1234", name: process.env.AUTH_MEDIA_NAME || "معاونت رسانه و محتوا", role: "media" },
    { username: process.env.AUTH_ARTISTS_USERNAME || "artists", password: process.env.AUTH_ARTISTS_PASSWORD || "1234", name: process.env.AUTH_ARTISTS_NAME || "معاونت امور هنرمندان", role: "artists" },
    { username: process.env.AUTH_EDUCATION_USERNAME || "education", password: process.env.AUTH_EDUCATION_PASSWORD || "1234", name: process.env.AUTH_EDUCATION_NAME || "معاونت آموزش، پژوهش و نوآوری", role: "education" },
    { username: process.env.AUTH_MEMBERS_USERNAME || "members", password: process.env.AUTH_MEMBERS_PASSWORD || "1234", name: process.env.AUTH_MEMBERS_NAME || "معاونت مفاخر و امور اعضا", role: "members" },
  ];

  let beneficiaryUsers: ConfiguredUser[] = [];
  try {
    const raw = process.env.AUTH_BENEFICIARIES_JSON || JSON.stringify([
      { username: "user", password: "1234", name: "ذی‌نفع آزمایشی" },
    ]);
    const parsed = JSON.parse(raw) as Array<{ username: string; password: string; name: string }>;
    beneficiaryUsers = parsed
      .filter((item) => item.username && item.password && item.name)
      .map((item) => ({ ...item, role: "beneficiary" }));
    if (process.env.NODE_ENV !== "production" && !beneficiaryUsers.some((item) => item.username === "user")) {
      beneficiaryUsers.push({ username: "user", password: "1234", name: "ذی‌نفع آزمایشی", role: "beneficiary" });
    }
  } catch {}
  const allUsers = [...managementUsers, ...unitUsers, ...beneficiaryUsers];
  if (process.env.NODE_ENV !== "production") return allUsers;
  // Never expose sample/default credentials in production. Every staff account must be
  // explicitly configured, and beneficiary accounts must come from the configured list.
  return allUsers.filter((item) => {
    if (item.role === "beneficiary") return Boolean(process.env.AUTH_BENEFICIARIES_JSON);
    const prefix = "AUTH_" + item.role.toUpperCase();
    return Boolean(process.env[prefix + "_USERNAME"] && process.env[prefix + "_PASSWORD"]);
  });
}

export { COOKIE_NAME };
