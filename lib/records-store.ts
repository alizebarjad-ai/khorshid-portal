import { list, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

export type MemberRecord = {
  id: string;
  kind: "member";
  fullName: string;
  memberType: "artist" | "figure" | "supporter" | "expert" | "organization";
  status: "pending" | "active" | "inactive" | "suspended";
  phone: string;
  email: string;
  city: string;
  expertise: string;
  biography: string;
  clubIds: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type ClubRecord = {
  id: string;
  kind: "club";
  name: string;
  clubType: "professional" | "regional" | "thematic" | "support";
  status: "planning" | "active" | "paused" | "closed";
  city: string;
  description: string;
  coordinator: string;
  contact: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

type StoredRecord = MemberRecord | ClubRecord;
const token = () => process.env.BLOB_READ_WRITE_TOKEN;

function requireToken() {
  if (!token()) throw new Error("ذخیره‌سازی پایدار سامانه هنوز پیکربندی نشده است.");
  return token()!;
}

async function readRecords<T extends StoredRecord>(kind: "member" | "club"): Promise<T[]> {
  const blobs = await list({ prefix: `khorshid-records/${kind}/`, token: requireToken() });
  const records: T[] = [];
  for (const blob of blobs.blobs) {
    try {
      const response = await fetch(blob.url, {
        headers: { Authorization: `Bearer ${requireToken()}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("خواندن پرونده از فضای ذخیره‌سازی ناموفق بود.");
      const item = await response.json() as T;
      if (item.kind === kind && item.id) records.push(item);
    } catch (error) {
      console.error("Could not read record", blob.pathname, error);
      throw new Error("خواندن اطلاعات سامانه کامل نشد؛ عملیات متوقف شد تا اطلاعات ناقص نمایش داده نشود.");
    }
  }
  return records.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function writeRecord<T extends StoredRecord>(record: T): Promise<T> {
  await put(`khorshid-records/${record.kind}/${record.id}.json`, JSON.stringify(record), {
    access: "private",
    token: requireToken(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
  });
  return record;
}

export const readMembers = () => readRecords<MemberRecord>("member");
export const readClubs = () => readRecords<ClubRecord>("club");

export async function createRecord(kind: "member" | "club", data: Record<string, unknown>, actor: {username:string}) {
  const now = new Date().toISOString();
  const base = { id: randomUUID(), kind, createdAt: now, updatedAt: now, createdBy: actor.username, updatedBy: actor.username };
  if (kind === "member") {
    const item: MemberRecord = {
      ...base, kind, fullName: String(data.fullName || "").trim(),
      memberType: (data.memberType || "artist") as MemberRecord["memberType"],
      status: (data.status || "pending") as MemberRecord["status"],
      phone: String(data.phone || "").trim(), email: String(data.email || "").trim(),
      city: String(data.city || "").trim(), expertise: String(data.expertise || "").trim(),
      biography: String(data.biography || "").trim(),
      clubIds: Array.isArray(data.clubIds) ? data.clubIds.map(String).slice(0,50) : [],
      notes: String(data.notes || "").trim(),
    };
    if (!item.fullName) throw new Error("نام و نام خانوادگی عضو الزامی است.");
    return writeRecord(item);
  }
  const item: ClubRecord = {
    ...base, kind, name: String(data.name || "").trim(),
    clubType: (data.clubType || "professional") as ClubRecord["clubType"],
    status: (data.status || "planning") as ClubRecord["status"],
    city: String(data.city || "").trim(), description: String(data.description || "").trim(),
    coordinator: String(data.coordinator || "").trim(), contact: String(data.contact || "").trim(),
    notes: String(data.notes || "").trim(),
  };
  if (!item.name) throw new Error("نام باشگاه الزامی است.");
  return writeRecord(item);
}

export async function updateRecord(kind: "member" | "club", id: string, data: Record<string, unknown>, actor: {username:string}) {
  const all = kind === "member" ? await readMembers() : await readClubs();
  const existing = all.find(item => item.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  if (kind === "member") {
    const old = existing as MemberRecord;
    const next: MemberRecord = {
      ...old,
      fullName: String(data.fullName ?? old.fullName).trim(),
      memberType: (data.memberType ?? old.memberType) as MemberRecord["memberType"],
      status: (data.status ?? old.status) as MemberRecord["status"],
      phone: String(data.phone ?? old.phone).trim(), email: String(data.email ?? old.email).trim(),
      city: String(data.city ?? old.city).trim(), expertise: String(data.expertise ?? old.expertise).trim(),
      biography: String(data.biography ?? old.biography).trim(),
      clubIds: Array.isArray(data.clubIds) ? data.clubIds.map(String).slice(0,50) : old.clubIds,
      notes: String(data.notes ?? old.notes).trim(), updatedAt: now, updatedBy: actor.username,
    };
    if (!next.fullName) throw new Error("نام و نام خانوادگی عضو الزامی است.");
    return writeRecord(next);
  }
  const old = existing as ClubRecord;
  const next: ClubRecord = {
    ...old, name: String(data.name ?? old.name).trim(),
    clubType: (data.clubType ?? old.clubType) as ClubRecord["clubType"],
    status: (data.status ?? old.status) as ClubRecord["status"],
    city: String(data.city ?? old.city).trim(), description: String(data.description ?? old.description).trim(),
    coordinator: String(data.coordinator ?? old.coordinator).trim(), contact: String(data.contact ?? old.contact).trim(),
    notes: String(data.notes ?? old.notes).trim(), updatedAt: now, updatedBy: actor.username,
  };
  if (!next.name) throw new Error("نام باشگاه الزامی است.");
  return writeRecord(next);
}
