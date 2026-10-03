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
  | "members";

export type SessionUser = {
  username: string;
  name: string;
  role: UserRole;
  beneficiaryName?: string;
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
};

const COOKIE_NAME = "khorshid_session";

function secret() {
  return process.env.AUTH_SECRET || "CHANGE_ME_BEFORE_PRODUCTION";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function encodeSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  return payload + "." + sign(payload);
}

export function decodeSession(value?: string | null): SessionUser | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
    if (!user.username || !user.name || !ROLE_LABELS[user.role]) return null;
    return user;
  } catch {
    return null;
  }
}

type ConfiguredUser = { username: string; password: string; name: string; role: UserRole };

export function getConfiguredUsers() {
  const managementUsers: ConfiguredUser[] = [
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
    if (!beneficiaryUsers.some((item) => item.username === "user")) {
      beneficiaryUsers.push({ username: "user", password: "1234", name: "ذی‌نفع آزمایشی", role: "beneficiary" });
    }
  } catch {}
  return [...managementUsers, ...unitUsers, ...beneficiaryUsers];
}

export { COOKIE_NAME };
