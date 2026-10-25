import { deleteStored, listStored, putStored } from "@/lib/persistent-store";
import { randomUUID } from "node:crypto";

export type MembershipTier = "affiliate" | "professional" | "supporter_partner";
export type MemberRank = "volunteer" | "professional" | "club_manager";

export type MemberRecord = {
  id: string;
  kind: "member";
  fullName: string;
  memberType: "artist" | "figure" | "supporter" | "expert" | "organization";
  membershipTier?: MembershipTier;
  memberRank?: MemberRank;
  rankHistory?: { from: MemberRank | null; to: MemberRank; at: string; actor: string }[];
  supplementalData?: Record<string, string>;
  sourceApplicationIds?: string[];
  membershipHistory?: { from: MembershipTier | null; to: MembershipTier; at: string; actor: string; applicationId?: string }[];
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

export type RecordAudit = {
  id: string;
  kind: "member" | "club";
  recordId: string;
  recordName: string;
  action: "create" | "update" | "delete";
  actor: string;
  occurredAt: string;
};

async function writeAudit(event: Omit<RecordAudit, "id" | "occurredAt">) {
  try {
    await putStored("record-audit", {
      ...event,
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
    } satisfies RecordAudit);
  } catch (error) {
    // Audit storage must not turn a successful primary operation into a reported failure.
    console.error("Record audit write failed", error);
  }
}

export async function readRecordAudit(limit = 200): Promise<RecordAudit[]> {
  const events = await listStored<RecordAudit>("record-audit");
  return events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, Math.min(500, Math.max(1, limit)));
}

async function readRecords<T extends StoredRecord>(kind: "member" | "club"): Promise<T[]> {
  const collection = kind === "member" ? "members" : "clubs";
  const records = await listStored<T>(collection);
  return records.filter((item) => item.kind === kind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function writeRecord<T extends StoredRecord>(record: T): Promise<T> {
  const collection = record.kind === "member" ? "members" : "clubs";
  return putStored(collection, record);
}

function isMembershipTier(value: unknown): value is MembershipTier { return value === "affiliate" || value === "professional" || value === "supporter_partner"; }
function isMemberRank(value: unknown): value is MemberRank { return value === "volunteer" || value === "professional" || value === "club_manager"; }

export const readMembers = () => readRecords<MemberRecord>("member");
export const readClubs = () => readRecords<ClubRecord>("club");

export async function createRecord(kind: "member" | "club", data: Record<string, unknown>, actor: {username:string}) {
  const now = new Date().toISOString();
  const base = { id: randomUUID(), kind, createdAt: now, updatedAt: now, createdBy: actor.username, updatedBy: actor.username };
  if (kind === "member") {
    const item: MemberRecord = {
      ...base, kind, fullName: String(data.fullName || "").trim(),
      memberType: (data.memberType || "artist") as MemberRecord["memberType"],
      ...(isMembershipTier(data.membershipTier) ? { membershipTier: data.membershipTier } : { membershipTier: "affiliate" as const }),
      memberRank: isMemberRank(data.memberRank) ? data.memberRank : "volunteer",
      rankHistory: [],
      ...(data.supplementalData && typeof data.supplementalData === "object" && !Array.isArray(data.supplementalData) ? { supplementalData: data.supplementalData as Record<string, string> } : {}),
      sourceApplicationIds: typeof data.sourceApplicationId === "string" && data.sourceApplicationId ? [data.sourceApplicationId] : [],
      membershipHistory: isMembershipTier(data.membershipTier) ? [{ from: null, to: data.membershipTier, at: now, actor: actor.username, ...(typeof data.sourceApplicationId === "string" ? { applicationId: data.sourceApplicationId } : {}) }] : [],
      status: (data.status || "pending") as MemberRecord["status"],
      phone: String(data.phone || "").trim(), email: String(data.email || "").trim(),
      city: String(data.city || "").trim(), expertise: String(data.expertise || "").trim(),
      biography: String(data.biography || "").trim(),
      clubIds: Array.isArray(data.clubIds) ? data.clubIds.map(String).slice(0,50) : [],
      notes: String(data.notes || "").trim(),
    };
    if (!item.fullName) throw new Error("نام و نام خانوادگی عضو الزامی است.");
    const saved = await writeRecord(item);
    await writeAudit({ kind: "member", recordId: saved.id, recordName: saved.fullName, action: "create", actor: actor.username });
    return saved;
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
  const saved = await writeRecord(item);
  await writeAudit({ kind: "club", recordId: saved.id, recordName: saved.name, action: "create", actor: actor.username });
  return saved;
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
      ...(isMembershipTier(data.membershipTier) ? { membershipTier: data.membershipTier } : {}),
      memberRank: isMemberRank(data.memberRank) ? data.memberRank : (old.memberRank || "volunteer"),
      rankHistory: isMemberRank(data.memberRank) && data.memberRank !== (old.memberRank || "volunteer") ? [...(old.rankHistory || []), { from: old.memberRank || "volunteer", to: data.memberRank, at: now, actor: actor.username }] : (old.rankHistory || []),
      ...(data.supplementalData && typeof data.supplementalData === "object" && !Array.isArray(data.supplementalData) ? { supplementalData: data.supplementalData as Record<string, string> } : {}),
      sourceApplicationIds: typeof data.sourceApplicationId === "string" && data.sourceApplicationId ? Array.from(new Set([...(old.sourceApplicationIds || []), data.sourceApplicationId])) : (old.sourceApplicationIds || []),
      membershipHistory: isMembershipTier(data.membershipTier) && data.membershipTier !== old.membershipTier ? [...(old.membershipHistory || []), { from: old.membershipTier || null, to: data.membershipTier, at: now, actor: actor.username, ...(typeof data.sourceApplicationId === "string" ? { applicationId: data.sourceApplicationId } : {}) }] : (old.membershipHistory || []),
      status: (data.status ?? old.status) as MemberRecord["status"],
      phone: String(data.phone ?? old.phone).trim(), email: String(data.email ?? old.email).trim(),
      city: String(data.city ?? old.city).trim(), expertise: String(data.expertise ?? old.expertise).trim(),
      biography: String(data.biography ?? old.biography).trim(),
      clubIds: Array.isArray(data.clubIds) ? data.clubIds.map(String).slice(0,50) : old.clubIds,
      notes: String(data.notes ?? old.notes).trim(), updatedAt: now, updatedBy: actor.username,
    };
    if (!next.fullName) throw new Error("نام و نام خانوادگی عضو الزامی است.");
    const saved = await writeRecord(next);
    await writeAudit({ kind: "member", recordId: saved.id, recordName: saved.fullName, action: "update", actor: actor.username });
    return saved;
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
  const saved = await writeRecord(next);
  await writeAudit({ kind: "club", recordId: saved.id, recordName: saved.name, action: "update", actor: actor.username });
  return saved;
}


export async function deleteRecord(kind: "member" | "club", id: string, actor: {username:string}) {
  const existing = kind === "member" ? (await readMembers()).find(item => item.id === id) : (await readClubs()).find(item => item.id === id);
  if (kind === "club") {
    const linkedMembers = (await readMembers()).filter((member) => (member.clubIds || []).includes(id));
    if (linkedMembers.length > 0) {
      return { deleted: false as const, linkedMemberCount: linkedMembers.length };
    }
  }
  await deleteStored(kind === "member" ? "members" : "clubs", id);
  if (existing) await writeAudit({ kind, recordId: id, recordName: kind === "member" ? (existing as MemberRecord).fullName : (existing as ClubRecord).name, action: "delete", actor: actor.username });
  return { deleted: true as const, linkedMemberCount: 0 };
}
