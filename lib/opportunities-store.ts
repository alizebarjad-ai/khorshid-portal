import { getStored, listStored, putStored } from "@/lib/persistent-store";

export type OpportunityHistory = {
  id: string;
  date: string;
  actor: string;
  action: string;
  note: string;
};

export type Opportunity = {
  id: string;
  code: string;
  type: string;
  title: string;
  clientName: string;
  clientContact: string;
  description: string;
  expectedValue: number;
  creator: string;
  creatorName: string;
  createdAt: string;
  status: string;
  assignedTo: string;
  assignedToName: string;
  subjectArea?: string;
  specialistBrief: string;
  proposalDetails: string;
  negotiationNote: string;
  contractNo: string;
  contractValue: number;
  contractDate: string;
  financeNote: string;
  directCost: number;
  rewardBase: number;
  history: OpportunityHistory[];
  team?: string[];
  estimatedCost?: number;
  proposedPrice?: number;
  unitNote?: string;
};

const COLLECTION = "opportunities";

export async function readOpportunities(): Promise<Opportunity[]> {
  const items = await listStored<Opportunity>(COLLECTION);
  return items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function createOpportunity(item: Opportunity): Promise<Opportunity> {
  const existing = await getStored<Opportunity>(COLLECTION, item.id);
  if (existing) throw new Error("شناسه این فرصت از قبل ثبت شده است.");
  return putStored(COLLECTION, item);
}

export async function updateOpportunity(id: string, patch: Partial<Opportunity>): Promise<Opportunity | null> {
  const existing = await getStored<Opportunity>(COLLECTION, id);
  if (!existing) return null;
  return putStored(COLLECTION, { ...existing, ...patch, id });
}
