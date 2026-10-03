import fs from "node:fs";
import path from "node:path";

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

const filePath = path.join(process.cwd(), "data", "opportunities.json");

function ensureFile() {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]\n", "utf8");
}

export function readOpportunities(): Opportunity[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeOpportunities(items: Opportunity[]) {
  ensureFile();
  const tempPath = filePath + ".tmp";
  fs.writeFileSync(tempPath, JSON.stringify(items, null, 2) + "\n", "utf8");
  fs.renameSync(tempPath, filePath);
}

export function createOpportunity(item: Opportunity) {
  const items = readOpportunities();
  writeOpportunities([item, ...items]);
  return item;
}

export function updateOpportunity(id: string, patch: Partial<Opportunity>) {
  const items = readOpportunities();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next = { ...items[index], ...patch };
  items[index] = next;
  writeOpportunities(items);
  return next;
}
