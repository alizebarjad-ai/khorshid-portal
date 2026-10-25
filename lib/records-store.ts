import { deleteStored, listStored, putStored } from "@/lib/persistent-store";
import { randomUUID } from "node:crypto";

export type MembershipTier = "affiliate" | "professional" | "supporter_partner";
export type MembershipGrade = "volunteer" | "professional" | "club_manager";
export type MembershipRank = "volunteer" | "professional" | "club_manager";
export type MembershipRankHistory = { from: MembershipRank | null; to: MembershipRank; at: string; actor: string; reason: string };
export type MemberPointEvent = { id: string; points: number; title: string; note: string; createdAt: string; actor: string };

export type MemberRecord = {
  id: string;
  kind: "member";
  fullName: string;
  memberType: "individual" | "artist" | "figure" | "supporter" | "expert" | "organization" | "media";
  membershipType?: "affiliate";
  membershipTier?: MembershipTier;
  membershipGrade?: MembershipGrade;
  membershipRank?: MembershipRank;
  rankHistory?: MembershipRankHistory[];
  pointsBalance?: number;
  pointEvents?: MemberPointEvent[];
  artistProfile?: Record<string, unknown>;
  expertProfile?: Record<string, unknown>;
  upgradeRequests?: { id: string; target: "artist" | "expert" | "consultant"; status: "pending" | "approved" | "rejected" | "needs_info"; assignedRole: "artists" | "csr"; submittedAt: string; reviewedAt?: string; reviewer?: string; note?: string }[];
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
  const normalized = records.filter((item) => item.kind === kind).map((item) => {
    if (item.kind !== "member") return item;
    const member = item as unknown as MemberRecord;
    return {
      ...member,
      membershipType: "affiliate" as const,
      membershipTier: "affiliate" as const,
      membershipRank: isMembershipRank(member.membershipRank) ? member.membershipRank : (isMembershipGrade(member.membershipGrade) ? member.membershipGrade : "volunteer" as const),
      rankHistory: Array.isArray(member.rankHistory) ? member.rankHistory : [],
    } as unknown as T;
  });
  return normalized.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function writeRecord<T extends StoredRecord>(record: T): Promise<T> {
  const collection = record.kind === "member" ? "members" : "clubs";
  return putStored(collection, record);
}

function isMembershipTier(value: unknown): value is MembershipTier { return value === "affiliate" || value === "professional" || value === "supporter_partner"; }
function isMembershipGrade(value: unknown): value is MembershipGrade { return value === "volunteer" || value === "professional" || value === "club_manager"; }
function isMembershipRank(value: unknown): value is MembershipRank { return value === "volunteer" || value === "professional" || value === "club_manager"; }
function validPointEvents(value: unknown): MemberPointEvent[] { return Array.isArray(value) ? value.filter((x): x is MemberPointEvent => !!x && typeof x === "object" && typeof x.id === "string" && Number.isFinite(Number(x.points)) && typeof x.title === "string").slice(-300) : []; }

export const readMembers = () => readRecords<MemberRecord>("member");
export const readClubs = () => readRecords<ClubRecord>("club");

export async function createRecord(kind: "member" | "club", data: Record<string, unknown>, actor: {username:string}) {
  const now = new Date().toISOString();
  const base = { id: randomUUID(), kind, createdAt: now, updatedAt: now, createdBy: actor.username, updatedBy: actor.username };
  if (kind === "member") {
    const item: MemberRecord = {
      ...base, kind, fullName: String(data.fullName || "").trim(),
      memberType: (data.memberType || "artist") as MemberRecord["memberType"],
      membershipType: "affiliate",
      membershipTier: "affiliate",
      membershipGrade: isMembershipGrade(data.membershipGrade) ? data.membershipGrade : "volunteer",
      membershipRank: isMembershipRank(data.membershipRank) ? data.membershipRank : "volunteer",
      rankHistory: [],
      pointsBalance: Math.max(0, Number(data.pointsBalance) || 0),
      pointEvents: validPointEvents(data.pointEvents),
      ...(data.artistProfile && typeof data.artistProfile === "object" ? { artistProfile: data.artistProfile as Record<string, unknown> } : {}),
      ...(data.expertProfile && typeof data.expertProfile === "object" ? { expertProfile: data.expertProfile as Record<string, unknown> } : {}),
      upgradeRequests: Array.isArray(data.upgradeRequests) ? data.upgradeRequests as MemberRecord["upgradeRequests"] : [],
      ...(data.supplementalData && typeof data.supplementalData === "object" && !Array.isArray(data.supplementalData) ? { supplementalData: data.supplementalData as Record<string, string> } : {}),
      sourceApplicationIds: typeof data.sourceApplicationId === "string" && data.sourceApplicationId ? [data.sourceApplicationId] : [],
      membershipHistory: [{ from: null, to: "affiliate", at: now, actor: actor.username, ...(typeof data.sourceApplicationId === "string" && data.sourceApplicationId ? { applicationId: data.sourceApplicationId } : {}) }],
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
      membershipType: "affiliate",
      membershipTier: "affiliate",
      ...(isMembershipGrade(data.membershipGrade) ? { membershipGrade: data.membershipGrade } : {}),
      ...(isMembershipRank(data.membershipRank) ? {
        membershipRank: data.membershipRank,
        rankHistory: data.membershipRank !== old.membershipRank
          ? [...(old.rankHistory || []), { from: isMembershipRank(old.membershipRank) ? old.membershipRank : null, to: data.membershipRank, at: now, actor: actor.username, reason: String(data.rankReason || "تغییر رده عضویت").slice(0, 500) }]
          : (old.rankHistory || []),
      } : {}),
      ...(Number.isFinite(Number(data.pointsBalance)) && data.pointsBalance !== undefined ? { pointsBalance: Math.max(0, Number(data.pointsBalance)) } : {}),
      ...(data.pointEvents !== undefined ? { pointEvents: validPointEvents(data.pointEvents) } : {}),
      ...(data.artistProfile && typeof data.artistProfile === "object" ? { artistProfile: data.artistProfile as Record<string, unknown> } : {}),
      ...(data.expertProfile && typeof data.expertProfile === "object" ? { expertProfile: data.expertProfile as Record<string, unknown> } : {}),
      ...(Array.isArray(data.upgradeRequests) ? { upgradeRequests: data.upgradeRequests as MemberRecord["upgradeRequests"] } : {}),
      ...(data.supplementalData && typeof data.supplementalData === "object" && !Array.isArray(data.supplementalData) ? { supplementalData: data.supplementalData as Record<string, string> } : {}),
      sourceApplicationIds: typeof data.sourceApplicationId === "string" && data.sourceApplicationId ? Array.from(new Set([...(old.sourceApplicationIds || []), data.sourceApplicationId])) : (old.sourceApplicationIds || []),
      membershipHistory: old.membershipHistory || [],
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
