"use client";

import { useEffect, useMemo, useState } from "react";

type RoleGuideItem = { name: string; weight: number; desc: string };

type Person = {
  id: string;
  name: string;
  role: string;
  roleBaseWeight: number;
  rolePercent: number;
  weight: number;
  relationship: string;
  roleApprovalStatus: "در انتظار تأیید" | "تأیید شده";
  notes: string;
};

type FinancialTransaction = {
  id: string; type: "وصول" | "هزینه"; description: string; amount: number; date: string;
  status: "در انتظار تأیید" | "تأیید شده"; notes: string;
};

type CollectionStage = {
  id: string; title: string; plannedAmount: number; receivedDate: string;
  status: "برنامه‌ریزی‌شده" | "در انتظار وصول" | "وصول شد" | "لغو شد"; notes: string;
};

type ProposalStatus =
  | "ثبت اولیه"
  | "در حال بررسی قائم‌مقام"
  | "نیازمند تکمیل"
  | "تأیید اولیه"
  | "در حال تدوین پروپوزال"
  | "بازگشت به قائم‌مقام"
  | "آماده مذاکره"
  | "در حال مذاکره"
  | "قرارداد در حال تنظیم"
  | "ارجاع به مالی"
  | "ثبت‌شده"
  | "رد شده"
  | "متوقف شده";

type ProposalHistory = {
  id: string;
  date: string;
  actor: string;
  action: string;
  note: string;
};

type Proposal = {
  id: string;
  code: string;
  type: "پروژه" | "مشتری" | "اسپانسر" | "فرصت همکاری";
  title: string;
  clientName: string;
  clientContact: string;
  description: string;
  expectedValue: number;
  creator: string;
  creatorName: string;
  createdAt: string;
  status: ProposalStatus;
  assignedTo: string;
  assignedToName: string;
  specialistBrief: string;
  proposalDetails: string;
  negotiationNote: string;
  contractNo: string;
  contractValue: number;
  contractDate: string;
  financeNote: string;
  history: ProposalHistory[];
};

type Project = {
  id: string;
  code: string;
  name: string;
  clientName: string;
  clientType: string;
  clientContact: string;
  executiveArm: string;
  projectType: string;
  projectSource: string;
  referrer: string;
  manager: string;
  description: string;
  objectives: string;
  deliverables: string;
  startDate: string;
  endDate: string;
  location: string;
  contractNo: string;
  contractDate: string;
  contractValue: number;
  currency: string;
  paymentTerms: string;
  confidentiality: string;
  priority: string;
  notes: string;
  createdAt: string;
  creator: string;
  revenue: number;
  directCosts: number;
  overheadCosts: number;
  tax: number;
  otherCosts: number;
  costs: number;
  received: number;
  rewardRate: number;
  status: "پیش‌نویس" | "فعال" | "تسویه‌شده";
  people: Person[];
  approvalStatus: "در انتظار تأیید" | "تأیید شده";
  approvedBy: string;
  approvedAt: string;
  settlementDate: string;
  settlementNote: string;
  financialTransactions: FinancialTransaction[];
  collectionStages: CollectionStage[];
  financeNote: string;
  lastFinancialReview: string;
  paymentReceiptNo: string;
  rewardBase: number;
  sourceOpportunityId: string;
};

const KEY = "khorshid-project-rewards-v1";
// Vercel deployment trigger: 2026-09-23

const ROLE_GUIDE: RoleGuideItem[] = [
  { name: "مدیر پروژه", weight: 10, desc: "برنامه‌ریزی و مسئولیت کلی نتیجه پروژه" },
  { name: "مدیر اجرایی", weight: 9, desc: "اجرای عملیاتی و هماهنگی روزانه" },
  { name: "تهیه‌کننده", weight: 8, desc: "تولید، منابع، زمان‌بندی و تحویل" },
  { name: "مدیر هنری", weight: 8, desc: "جهت‌گیری و کیفیت هنری" },
  { name: "کارگردان", weight: 8, desc: "هدایت هنری و اجرایی تولید" },
  { name: "توسعه مشارکت و حامی", weight: 7, desc: "جذب و مدیریت حامی یا شریک" },
  { name: "نویسنده / محتوا", weight: 6, desc: "نگارش و تولید محتوای متنی" },
  { name: "تولید و فنی", weight: 6, desc: "اجرای فنی و عملیات تولید" },
  { name: "تصویربردار / عکاس", weight: 5, desc: "ثبت تصویری پروژه" },
  { name: "تدوین / پس‌تولید", weight: 5, desc: "تدوین و آماده‌سازی خروجی" },
  { name: "طراحی گرافیک", weight: 5, desc: "طراحی بصری" },
  { name: "پژوهش", weight: 4, desc: "تحقیق و داده" },
  { name: "روابط عمومی / رسانه", weight: 4, desc: "انتشار و ارتباطات رسانه‌ای" },
  { name: "مالی / اداری", weight: 3, desc: "امور مالی و اداری" },
  { name: "پشتیبانی", weight: 2, desc: "خدمات و پشتیبانی اجرایی" },
  { name: "سایر", weight: 3, desc: "نقش‌های خارج از فهرست" },
];

const steps = [
  { n: 1, title: "اطلاعات پایه و قرارداد" },
  { n: 2, title: "اعضای پروژه" },
  { n: 3, title: "مالی و جریان نقدی" },
  { n: 4, title: "محاسبه پاداش" },
  { n: 5, title: "تأیید و تسویه" },
];

const money = (n: number) =>
  new Intl.NumberFormat("fa-IR").format(Math.max(0, Math.round(n)));

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function newCode() {
  return `KH-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
}

function today() {
  const d = new Date();
  const [y,m,day] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return y + "-" + String(m).padStart(2,"0") + "-" + String(day).padStart(2,"0");
}

function normalizeStoredDate(value: string) {
  if (!value) return "";
  if (/^14\d{2}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return value;
  const gy = Number(m[1]);
  if (gy < 1900) return value;
  const [jy,jm,jd] = gregorianToJalali(gy, Number(m[2]), Number(m[3]));
  return jy + "-" + String(jm).padStart(2,"0") + "-" + String(jd).padStart(2,"0");
}

function normalizeProposal(raw: Partial<Proposal>): Proposal {
  return {
    id: raw.id || uid(),
    code: raw.code || `OP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    type: raw.type || "پروژه",
    title: raw.title || "",
    clientName: raw.clientName || "",
    clientContact: raw.clientContact || "",
    description: raw.description || "",
    expectedValue: Number(raw.expectedValue || 0),
    creator: raw.creator || "",
    creatorName: raw.creatorName || "",
    createdAt: raw.createdAt || today(),
    status: raw.status || "ثبت اولیه",
    assignedTo: raw.assignedTo || "",
    assignedToName: raw.assignedToName || "",
    specialistBrief: raw.specialistBrief || "",
    proposalDetails: raw.proposalDetails || "",
    negotiationNote: raw.negotiationNote || "",
    contractNo: raw.contractNo || "",
    contractValue: Number(raw.contractValue || 0),
    contractDate: raw.contractDate || "",
    financeNote: raw.financeNote || "",
    history: (raw.history || []).map((h) => ({
      id: h.id || uid(),
      date: h.date || today(),
      actor: h.actor || "",
      action: h.action || "",
      note: h.note || "",
    })),
  };
}

function normalizeProject(raw: Partial<Project>): Project {
  const direct = Number(raw.directCosts ?? raw.costs ?? 0) || 0;
  return {
    id: raw.id || uid(),
    code: raw.code || newCode(),
    name: raw.name || "",
    clientName: raw.clientName || "",
    clientType: raw.clientType || "شرکت / سازمان",
    clientContact: raw.clientContact || "",
    executiveArm: raw.executiveArm || "",
    projectType: raw.projectType || "تولید محتوا",
    projectSource: raw.projectSource || "مذاکره مستقیم",
    referrer: raw.referrer || "",
    manager: raw.manager || "",
    description: raw.description || "",
    objectives: raw.objectives || "",
    deliverables: raw.deliverables || "",
    startDate: normalizeStoredDate(raw.startDate || ""),
    endDate: normalizeStoredDate(raw.endDate || ""),
    location: raw.location || "",
    contractNo: raw.contractNo || "",
    contractDate: normalizeStoredDate(raw.contractDate || ""),
    contractValue: Number(raw.contractValue ?? raw.revenue ?? 0) || 0,
    currency: raw.currency || "ریال",
    paymentTerms: raw.paymentTerms || "",
    confidentiality: raw.confidentiality || "عادی",
    priority: raw.priority || "عادی",
    notes: raw.notes || "",
    createdAt: raw.createdAt || today(),
    creator: raw.creator || "",
    revenue: Number(raw.revenue ?? raw.contractValue ?? 0) || 0,
    directCosts: direct,
    overheadCosts: Number(raw.overheadCosts || 0),
    tax: Number(raw.tax || 0),
    otherCosts: Number(raw.otherCosts || 0),
    costs:
      direct +
      Number(raw.overheadCosts || 0) +
      Number(raw.tax || 0) +
      Number(raw.otherCosts || 0),
    received: Number(raw.received || 0),
    rewardRate: Number(raw.rewardRate ?? 20) || 20,
    status: raw.status || "پیش‌نویس",
    people: (raw.people || []).map((p) => ({
      id: p.id || uid(),
      name: p.name || "",
      role: p.role || "سایر",
      roleBaseWeight: Number(p.roleBaseWeight || 3),
      rolePercent: Number(p.rolePercent || 100),
      weight: Number(p.weight || 3),
      relationship: p.relationship || "عضو داخلی",
      roleApprovalStatus: p.roleApprovalStatus || "در انتظار تأیید",
      notes: p.notes || "",
    })),
    approvalStatus: raw.approvalStatus || "در انتظار تأیید",
    approvedBy: raw.approvedBy || "",
    approvedAt: raw.approvedAt || "",
    settlementDate: normalizeStoredDate(raw.settlementDate || ""),
    settlementNote: raw.settlementNote || "",
    financialTransactions: (raw.financialTransactions || []).map((t) => ({ id: t.id || uid(), type: t.type === "هزینه" ? "هزینه" : "وصول", description: t.description || "", amount: Number(t.amount || 0), date: t.date || "", status: t.status === "تأیید شده" ? "تأیید شده" : "در انتظار تأیید", notes: t.notes || "" })),
    collectionStages: (raw.collectionStages || []).map((s) => ({ id: s.id || uid(), title: s.title || "", plannedAmount: Number(s.plannedAmount || 0), receivedDate: s.receivedDate || "", status: s.status || "برنامه‌ریزی‌شده", notes: s.notes || "" })),
    financeNote: raw.financeNote || "", lastFinancialReview: raw.lastFinancialReview || "", paymentReceiptNo: raw.paymentReceiptNo || "",
    rewardBase: Number((raw as any).rewardBase ?? raw.contractValue ?? raw.revenue ?? 0) || 0,
    sourceOpportunityId: (raw as any).sourceOpportunityId || "",
  };
}

export default function ProjectRewardsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState("");
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [rewardRate, setRewardRate] = useState("20");
  const [personName, setPersonName] = useState("");
  const [personRole, setPersonRole] = useState(ROLE_GUIDE[0].name);
  const [personPercent, setPersonPercent] = useState("100");
  const [personRoleWeight, setPersonRoleWeight] = useState(String(ROLE_GUIDE[0].weight));
  const [personRelationship, setPersonRelationship] = useState("عضو داخلی");
  const [personNotes, setPersonNotes] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [transactionType, setTransactionType] = useState<"وصول" | "هزینه">("وصول");
  const [transactionDescription, setTransactionDescription] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [transactionStatus, setTransactionStatus] = useState<FinancialTransaction["status"]>("در انتظار تأیید");
  const [transactionNotes, setTransactionNotes] = useState("");
  const [stageTitle, setStageTitle] = useState("");
  const [stageAmount, setStageAmount] = useState("");
  const [stageDate, setStageDate] = useState("");
  const [stageStatus, setStageStatus] = useState<CollectionStage["status"]>("برنامه‌ریزی‌شده");
  const [stageNotes, setStageNotes] = useState("");
  const [view, setView] = useState<"projects" | "dashboard" | "proposals">("projects");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState("");
  const [proposalType, setProposalType] = useState<Proposal["type"]>("پروژه");
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalClient, setProposalClient] = useState("");
  const [proposalContact, setProposalContact] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [proposalExpectedValue, setProposalExpectedValue] = useState("");
  const [proposalAssignee, setProposalAssignee] = useState("");
  const [proposalAssigneeName, setProposalAssigneeName] = useState("");
  const [proposalBrief, setProposalBrief] = useState("");
  const [proposalDetails, setProposalDetails] = useState("");
  const [proposalNegotiation, setProposalNegotiation] = useState("");
  const [proposalContractNo, setProposalContractNo] = useState("");
  const [proposalContractValue, setProposalContractValue] = useState("");
  const [proposalContractDate, setProposalContractDate] = useState("");
  const [proposalFinanceNote, setProposalFinanceNote] = useState("");
  const [proposalNote, setProposalNote] = useState("");
  const [sessionUser, setSessionUser] = useState<{ username: string; name: string; role: "finance" | "ceo" | "deputy" | "beneficiary" | "economic" | "csr" | "media" | "artists" | "education" | "members" } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const canEdit = sessionUser?.role === "finance";
  const canEditTeam = sessionUser?.role === "ceo";
  const readOnly = !canEdit;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view");
    const isNewProposal = params.get("new") === "1";

    // مسیر پیشنهاد باید مستقل از زمان پاسخ API فوراً به نمای پیشنهادها برود.
    if (requestedView === "proposals") {
      setView("proposals");
      if (isNewProposal) setSelectedProposal("");
    }

    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        setSessionUser(data.user || null);
        if (data.user?.role === "ceo" || data.user?.role === "deputy") {
          setStep(2);
        }
        if (data.user?.role === "beneficiary") {
          setView("proposals");
          if (isNewProposal) setSelectedProposal("");
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  const selectedRole =
    ROLE_GUIDE.find((role) => role.name === personRole) ?? ROLE_GUIDE[0];

  useEffect(() => {
    setPersonRoleWeight(String(selectedRole.weight));
  }, [selectedRole]);

  const effectiveWeight =
    (Number(personRoleWeight) || 0) *
    (Math.max(0, Math.min(100, Number(personPercent) || 0)) / 100);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = (JSON.parse(raw) as Partial<Project>[]).map(normalizeProject);
        setProjects(parsed);
        if (parsed[0]) setSelected(parsed[0].id);
      }
    } catch {}

    // پرونده‌هایی که مالی در گردش فرصت‌ها تکمیل و «ثبت پروژه» شده‌اند،
    // به‌صورت خودکار وارد ماژول پروژه و استخر پاداش می‌شوند.
    fetch("/api/opportunities", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        const completed = (data.items || []).filter((item: any) => item.status === "ثبت پروژه");
        if (!completed.length) return;
        setProjects((current) => {
          const existingSources = new Set(current.map((p) => p.sourceOpportunityId).filter(Boolean));
          const imported = completed
            .filter((item: any) => !existingSources.has(item.id))
            .map((item: any) => normalizeProject({
              id: uid(),
              code: item.code || newCode(),
              name: item.title,
              clientName: item.clientName,
              clientContact: item.clientContact,
              description: item.description,
              contractNo: item.contractNo,
              contractDate: item.contractDate,
              contractValue: Number(item.contractValue || item.proposedPrice || 0),
              revenue: Number(item.contractValue || item.proposedPrice || 0),
              directCosts: Number(item.directCost || 0),
              rewardBase: Number(item.rewardBase || item.contractValue || item.proposedPrice || 0),
              projectSource: "گردش فرصت و قرارداد",
              creator: item.creatorName || "سامانه",
              createdAt: item.createdAt || today(),
              status: "پیش‌نویس",
              financeNote: item.financeNote || "",
              sourceOpportunityId: item.id,
              people: [],
            }));
          if (!imported.length) return current;
          return [...imported, ...current];
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("khorshid-opportunities-v1");
      if (raw) {
        const parsed = (JSON.parse(raw) as Partial<Proposal>[]).map(normalizeProposal);
        setProposals(parsed);
        // هیچ پیشنهادی به‌صورت خودکار انتخاب نمی‌شود؛ کاربر باید خودش پرونده را انتخاب کند.
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("khorshid-opportunities-v1", JSON.stringify(proposals));
  }, [proposals]);


  const project = projects.find((p) => p.id === selected) ?? null;
  const totalCosts = project
    ? project.directCosts + project.overheadCosts + project.tax + project.otherCosts
    : 0;
  // مبنای پاداش بر اساس منابع خالص وصول‌شده است، نه صرفاً مبلغ قرارداد یا درآمد ثبت‌شده.
  const confirmedReceived = project ? project.financialTransactions.filter((t) => t.type === "وصول" && t.status === "تأیید شده").reduce((s,t) => s+t.amount,0) : 0;
  const effectiveReceived = project && project.financialTransactions.length ? confirmedReceived : (project?.received ?? 0);
  const net = project ? Math.max(0, effectiveReceived - totalCosts) : 0;
  const pool = project ? net * (project.rewardRate / 100) : 0;
  const totalWeight =
    project?.people.reduce((sum, person) => sum + person.weight, 0) ?? 0;

  const dashboard = useMemo(() => {
    const totalContract = projects.reduce((s, p) => s + p.contractValue, 0);
    const totalRevenue = projects.reduce((s, p) => s + p.revenue, 0);
    const totalReceived = projects.reduce((s, p) => {
      const confirmed = p.financialTransactions.filter((t) => t.type === "وصول" && t.status === "تأیید شده").reduce((x,t) => x+t.amount,0);
      return s + (p.financialTransactions.length ? confirmed : p.received);
    }, 0);
    const totalCostsAll = projects.reduce((s, p) => s + p.directCosts + p.overheadCosts + p.tax + p.otherCosts, 0);
    const netReceived = Math.max(0, totalReceived - totalCostsAll);
    const rewardPool = projects.reduce((s, p) => {
      const costs = p.directCosts + p.overheadCosts + p.tax + p.otherCosts;
      const confirmed = p.financialTransactions.filter((t) => t.type === "وصول" && t.status === "تأیید شده").reduce((x,t) => x+t.amount,0);
      const received = p.financialTransactions.length ? confirmed : p.received;
      return s + Math.max(0, received - costs) * (p.rewardRate / 100);
    }, 0);
    const active = projects.filter((p) => p.status === "فعال").length;
    const drafts = projects.filter((p) => p.status === "پیش‌نویس").length;
    const settled = projects.filter((p) => p.status === "تسویه‌شده").length;
    const receivables = Math.max(0, totalRevenue - totalReceived);
    const collectionRate = totalRevenue > 0 ? (totalReceived / totalRevenue) * 100 : 0;
    return { totalContract, totalRevenue, totalReceived, totalCostsAll, netReceived, rewardPool, active, drafts, settled, receivables, collectionRate };
  }, [projects]);

  const payouts = useMemo(
    () =>
      project
        ? project.people.map((person) => ({
            ...person,
            amount: totalWeight ? (pool * person.weight) / totalWeight : 0,
          }))
        : [],
    [project, pool, totalWeight]
  );

  function resetDraft() {
    setName("");
    setRewardRate("20");
    setSelected("");
    setStep(1);
  }

  function createProject() {
    if (!name.trim()) {
      alert("نام پروژه را ثبت کنید.");
      return;
    }
    const projectData = normalizeProject({
      id: uid(),
      code: newCode(),
      name: name.trim(),
      rewardRate: Number(rewardRate) || 20,
      createdAt: today(),
      status: "پیش‌نویس",
      people: [],
    });
    setProjects((old) => [projectData, ...old]);
    setSelected(projectData.id);
    setStep(1);
    setName("");
    setRewardRate("20");
  }

  function updateProject(patch: Partial<Project>) {
    if (!project) return;
    setProjects((old) =>
      old.map((item) => {
        if (item.id !== project.id) return item;
        const next = { ...item, ...patch };
        next.costs =
          Number(next.directCosts || 0) +
          Number(next.overheadCosts || 0) +
          Number(next.tax || 0) +
          Number(next.otherCosts || 0);
        return next;
      })
    );
  }

  function addPerson() {
    if (!canEditTeam || !project || !personName.trim()) return;
    const percent = Math.max(0, Math.min(100, Number(personPercent) || 0));
    if (percent <= 0) {
      alert("درصد مشارکت در نقش باید بیشتر از صفر باشد.");
      return;
    }
    const existingRolePercent = project.people.filter((p) => p.role === selectedRole.name).reduce((s,p) => s+p.rolePercent,0);
    if (existingRolePercent + percent > 100) { alert(`مجموع سهم نقش «${selectedRole.name}» نباید از ۱۰۰٪ بیشتر شود. سهم فعلی: ${existingRolePercent}٪`); return; }
    const person: Person = {
      id: uid(),
      name: personName.trim(),
      role: selectedRole.name,
      roleBaseWeight: Number(personRoleWeight) || 0,
      rolePercent: percent,
      weight: Number(effectiveWeight.toFixed(2)),
      relationship: personRelationship,
      roleApprovalStatus: "در انتظار تأیید",
      notes: personNotes.trim(),
    };
    updateProject({ people: [...project.people, person] });
    setPersonName("");
    setPersonPercent("100");
    setPersonRoleWeight(String(ROLE_GUIDE[0].weight));
    setPersonNotes("");
  }

  function approveRole(id: string) {
    if (!canEditTeam || !project) return;
    updateProject({ people: project.people.map((p) => p.id === id ? { ...p, roleApprovalStatus: "تأیید شده" } : p) });
  }

  function addTransaction() {
    if (!project || !transactionDescription.trim() || Number(transactionAmount) <= 0) { alert("شرح و مبلغ معتبر تراکنش را ثبت کنید."); return; }
    const t: FinancialTransaction = { id: uid(), type: transactionType, description: transactionDescription.trim(), amount: Number(transactionAmount), date: transactionDate, status: transactionStatus, notes: transactionNotes.trim() };
    updateProject({ financialTransactions: [...project.financialTransactions, t], received: transactionType === "وصول" && transactionStatus === "تأیید شده" ? project.received + Number(transactionAmount) : project.received });
    setTransactionDescription(""); setTransactionAmount(""); setTransactionDate(""); setTransactionNotes("");
  }

  function removeTransaction(id: string) {
    if (!project) return;
    updateProject({ financialTransactions: project.financialTransactions.filter((t) => t.id !== id) });
  }

  function addCollectionStage() {
    if (!project || !stageTitle.trim()) { alert("عنوان مرحله وصول را ثبت کنید."); return; }
    const s: CollectionStage = { id: uid(), title: stageTitle.trim(), plannedAmount: Number(stageAmount) || 0, receivedDate: stageDate, status: stageStatus, notes: stageNotes.trim() };
    updateProject({ collectionStages: [...project.collectionStages, s] });
    setStageTitle(""); setStageAmount(""); setStageDate(""); setStageNotes("");
  }

  function removeCollectionStage(id: string) {
    if (!project) return;
    updateProject({ collectionStages: project.collectionStages.filter((stage) => stage.id !== id) });
  }

  function removePerson(id: string) {
    if (!canEditTeam || !project) return;
    updateProject({ people: project.people.filter((person) => person.id !== id) });
  }

  function nextStep() {
    if (!project) return;
    if (step === 1 && (!project.name.trim() || !project.clientName.trim())) {
      alert("نام پروژه و نام مشتری/کارفرما را ثبت کنید.");
      return;
    }
    if (step === 2 && project.people.length === 0) {
      alert("حداقل یک عضو پروژه را ثبت کنید.");
      return;
    }
    if (step === 3 && project.revenue <= 0) {
      alert("درآمد یا مبلغ قرارداد پروژه را ثبت کنید.");
      return;
    }
    setStep((current) => { const next = current + 1; return !canEdit && next === 3 ? 4 : Math.min(5, next); });
  }

  function previousStep() {
    setStep((current) => { const prev = current - 1; return !canEdit && prev === 3 ? 2 : Math.max(1, prev); });
  }

  function resetAll() {
    if (!confirm("همه پروژه‌های ذخیره‌شده در این مرورگر حذف شوند؟")) return;
    localStorage.removeItem(KEY);
    setProjects([]);
    resetDraft();
  }

  function approveProject() {
    if (!project) return;
    updateProject({
      approvalStatus: "تأیید شده",
      approvedAt: today(),
      status: "فعال",
    });
  }

  function settleProject() {
    if (!project) return;
    updateProject({
      status: "تسویه‌شده",
      settlementDate: today(),
    });
  }

  const visibleProposals = useMemo(() => {
    if (!sessionUser) return [];
    if (sessionUser.role === "beneficiary") {
      return proposals.filter((p) => p.creator === sessionUser.username || p.creatorName === sessionUser.name);
    }
    return proposals;
  }, [proposals, sessionUser]);

  const selectedProposalData = proposals.find((p) => p.id === selectedProposal) ?? null;

  function proposalHistory(p: Proposal, action: string, note = "") {
    return [...p.history, {
      id: uid(),
      date: today(),
      actor: sessionUser?.name || "سیستم",
      action,
      note,
    }];
  }

  function createProposal() {
    if (!sessionUser || sessionUser.role !== "beneficiary") return;
    if (!proposalTitle.trim() || !proposalDescription.trim()) {
      alert("عنوان و شرح کوتاه پیشنهاد را ثبت کنید.");
      return;
    }
    const p = normalizeProposal({
      id: uid(),
      code: `OP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      type: proposalType,
      title: proposalTitle.trim(),
      clientName: proposalClient.trim(),
      clientContact: proposalContact.trim(),
      description: proposalDescription.trim(),
      expectedValue: Number(proposalExpectedValue) || 0,
      creator: sessionUser.username,
      creatorName: sessionUser.name,
      createdAt: today(),
      status: "در حال بررسی قائم‌مقام",
      history: [{
        id: uid(), date: today(), actor: sessionUser.name,
        action: "ثبت پیشنهاد اولیه", note: "پیشنهاد برای بررسی قائم‌مقام ارسال شد."
      }],
    });
    setProposals((old) => [p, ...old]);
    setSelectedProposal(p.id);
    setProposalTitle(""); setProposalClient(""); setProposalContact("");
    setProposalDescription(""); setProposalExpectedValue("");
  }

  function updateProposal(patch: Partial<Proposal>) {
    if (!selectedProposalData) return;
    setProposals((old) => old.map((item) => item.id === selectedProposalData.id ? normalizeProposal({...item, ...patch}) : item));
  }

  function deputyApproveProposal() {
    if (!selectedProposalData || sessionUser?.role !== "deputy") return;
    const next = {
      ...selectedProposalData,
      status: "تأیید اولیه" as ProposalStatus,
      history: proposalHistory(selectedProposalData, "تأیید اولیه", proposalNote),
    };
    setProposals((old) => old.map((p) => p.id === next.id ? next : p));
    setProposalNote("");
  }

  function deputyRequestCompletion() {
    if (!selectedProposalData || sessionUser?.role !== "deputy") return;
    const next = {
      ...selectedProposalData,
      status: "نیازمند تکمیل" as ProposalStatus,
      history: proposalHistory(selectedProposalData, "درخواست تکمیل", proposalNote),
    };
    setProposals((old) => old.map((p) => p.id === next.id ? next : p));
    setProposalNote("");
  }

  function deputyRejectProposal() {
    if (!selectedProposalData || sessionUser?.role !== "deputy") return;
    const next = {
      ...selectedProposalData,
      status: "رد شده" as ProposalStatus,
      history: proposalHistory(selectedProposalData, "رد پیشنهاد", proposalNote),
    };
    setProposals((old) => old.map((p) => p.id === next.id ? next : p));
    setProposalNote("");
  }

  function assignSpecialist() {
    if (!selectedProposalData || sessionUser?.role !== "deputy" || !proposalAssigneeName.trim()) return;
    const next = {
      ...selectedProposalData,
      status: "در حال تدوین پروپوزال" as ProposalStatus,
      assignedTo: proposalAssignee.trim(),
      assignedToName: proposalAssigneeName.trim(),
      specialistBrief: proposalBrief.trim(),
      history: proposalHistory(selectedProposalData, "ارجاع به معاونت/مسئول تخصصی", `${proposalAssigneeName.trim()} · ${proposalBrief.trim()}`),
    };
    setProposals((old) => old.map((p) => p.id === next.id ? next : p));
    setProposalAssignee(""); setProposalAssigneeName(""); setProposalBrief("");
  }

  function specialistComplete() {
    if (!selectedProposalData || sessionUser?.role !== "deputy") return;
    if (!proposalDetails.trim()) { alert("جزئیات پروپوزال را تکمیل کنید."); return; }
    const next = {
      ...selectedProposalData,
      status: "بازگشت به قائم‌مقام" as ProposalStatus,
      proposalDetails: proposalDetails.trim(),
      history: proposalHistory(selectedProposalData, "تکمیل پروپوزال و بازگشت به قائم‌مقام", ""),
    };
    setProposals((old) => old.map((p) => p.id === next.id ? next : p));
    setProposalDetails("");
  }

  function sendToPartnerships() {
    if (!selectedProposalData || sessionUser?.role !== "deputy") return;
    const next = {
      ...selectedProposalData,
      status: "آماده مذاکره" as ProposalStatus,
      assignedTo: "partnership-development",
      assignedToName: "معاونت توسعه مشارکت‌های اقتصادیی اقتصادی",
      history: proposalHistory(selectedProposalData, "ارجاع برای شروع مذاکره", proposalNote),
    };
    setProposals((old) => old.map((p) => p.id === next.id ? next : p));
    setProposalNote("");
  }

  function sendToCustomNegotiator() {
    if (!selectedProposalData || sessionUser?.role !== "deputy" || !proposalAssigneeName.trim()) return;
    const next = {
      ...selectedProposalData,
      status: "آماده مذاکره" as ProposalStatus,
      assignedTo: proposalAssignee.trim(),
      assignedToName: proposalAssigneeName.trim(),
      history: proposalHistory(selectedProposalData, "ارجاع به مسئول مذاکره", proposalNote),
    };
    setProposals((old) => old.map((p) => p.id === next.id ? next : p));
    setProposalAssignee(""); setProposalAssigneeName(""); setProposalNote("");
  }

  function recordContractAndSendFinance() {
    if (!selectedProposalData || sessionUser?.role !== "deputy") return;
    if (!proposalContractNo.trim() || Number(proposalContractValue) <= 0) {
      alert("شماره قرارداد و مبلغ قرارداد را ثبت کنید.");
      return;
    }
    const next = {
      ...selectedProposalData,
      status: "ارجاع به مالی" as ProposalStatus,
      contractNo: proposalContractNo.trim(),
      contractValue: Number(proposalContractValue) || 0,
      contractDate: proposalContractDate || today(),
      negotiationNote: proposalNegotiation.trim(),
      history: proposalHistory(selectedProposalData, "قرارداد نهایی شد و به مالی ارجاع شد", `${proposalContractNo.trim()} · ${proposalContractValue}`),
    };
    setProposals((old) => old.map((p) => p.id === next.id ? next : p));
    setProposalNegotiation("");
  }

  function financeRegisterProposal() {
    if (!selectedProposalData || sessionUser?.role !== "finance") return;
    const projectData = normalizeProject({
      id: uid(),
      code: newCode(),
      name: selectedProposalData.title,
      clientName: selectedProposalData.clientName,
      clientContact: selectedProposalData.clientContact,
      description: selectedProposalData.description,
      contractNo: selectedProposalData.contractNo,
      contractDate: selectedProposalData.contractDate,
      contractValue: selectedProposalData.contractValue,
      revenue: selectedProposalData.contractValue,
      projectSource: "پیشنهاد ثبت‌شده در سامانه",
      creator: selectedProposalData.creatorName,
      createdAt: today(),
      status: "پیش‌نویس",
      people: [],
    });
    setProjects((old) => [projectData, ...old]);
    setSelected(projectData.id);
    const next = {
      ...selectedProposalData,
      status: "ثبت‌شده" as ProposalStatus,
      financeNote: proposalFinanceNote.trim(),
      history: proposalHistory(selectedProposalData, "ثبت رسمی توسط مالی و ایجاد پرونده پروژه", proposalFinanceNote),
    };
    setProposals((old) => old.map((p) => p.id === next.id ? next : p));
    setProposalFinanceNote("");
    setView("projects");
    setStep(1);
  }

  return (
    <main className="internal-rewards min-h-screen bg-[#F3EFE7] pt-24 pb-16 text-[#14213D]">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-reward-results, #print-reward-results * { visibility: visible !important; }
          #print-reward-results {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 24px !important;
            background: white !important;
            color: black !important;
            direction: rtl !important;
          }
          #print-reward-results table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 12px !important;
          }
          #print-reward-results th, #print-reward-results td {
            border: 1px solid #222 !important;
            padding: 8px 6px !important;
            text-align: right !important;
          }
        }
        .internal-rewards fieldset {
          background:#F3EFE7 !important;
          color:#17263B !important;
        }
        .internal-rewards fieldset .bg-white {
          background:#FBF8F2 !important;
          color:#17263B !important;
        }
        .internal-rewards fieldset .bg-\\[\\#FAF8F4\\] {
          background:#F4EFE6 !important;
          color:#17263B !important;
        }
        .internal-rewards fieldset .bg-\\[\\#F4EEE4\\] {
          background:#EAE3D8 !important;
          color:#17263B !important;
        }
        .internal-rewards fieldset .bg-\\[\\#FFF8E6\\] {
          background:#FFF4D6 !important;
          color:#17263B !important;
        }
        .internal-rewards fieldset .text-white {
          color:#17263B !important;
        }
        .internal-rewards fieldset h2,
        .internal-rewards fieldset h3,
        .internal-rewards fieldset h4,
        .internal-rewards fieldset strong {
          color:#17263B !important;
        }
        .internal-rewards fieldset p,
        .internal-rewards fieldset span,
        .internal-rewards fieldset td,
        .internal-rewards fieldset th {
          color:#3F4B5A;
        }
        .internal-rewards aside.internal-card,
        .internal-rewards section.internal-card {
          background:#F8F5EE !important;
          color:#14213D !important;
        }
        .internal-rewards .internal-card {
          background:#F8F5EE !important;
          border:1px solid #D6CCBC !important;
          box-shadow:0 10px 28px rgba(20,33,61,.10) !important;
          color:#14213D !important;
        }
        .internal-rewards .internal-card > div > .border-b {
          background:#F8F5EE !important;
        }
        .internal-rewards .internal-card .grid.gap-2.sm\\:grid-cols-5 {
          background:#F8F5EE !important;
          border-radius:16px;
          padding:4px;
        }
        .internal-rewards .internal-card .grid.gap-2.sm\\:grid-cols-5 > button.border-\\[\\#F2A900\\] {
          background:#D89500 !important;
          border-color:#A96800 !important;
          color:#14213D !important;
          box-shadow:0 4px 12px rgba(168,104,0,.18) !important;
        }
        .internal-rewards .internal-card .grid.gap-2.sm\\:grid-cols-5 > button.border-\\[\\#F2A900\\] span {
          color:#14213D !important;
        }
        .internal-rewards aside.internal-card .mt-4.space-y-2 > button {
          min-height:72px;
          text-align:right !important;
          background:#FBF8F2 !important;
          color:#14213D !important;
          border:1px solid #C9C0B2 !important;
          box-shadow:0 2px 7px rgba(20,33,61,.05);
        }
        .internal-rewards aside.internal-card .mt-4.space-y-2 > button span {
          color:#14213D !important;
        }
        .internal-rewards aside.internal-card .mt-4.space-y-2 > button span:not(.font-bold) {
          color:#596474 !important;
        }
        .internal-rewards aside.internal-card .mt-4.space-y-2 > button:hover {
          background:#F1EBDD !important;
          border-color:#AFA38F !important;
        }
        .internal-rewards aside.internal-card .mt-4.space-y-2 > button.border-\\[\\#F2A900\\] {
          background:#FFF0C2 !important;
          border-color:#D89500 !important;
          box-shadow:0 4px 12px rgba(216,149,0,.15);
        }
        .internal-rewards aside.internal-card .mt-4.space-y-2 > button.border-\\[\\#F2A900\\] span {
          color:#14213D !important;
        }
        .internal-rewards .internal-card .btn-primary,
        .internal-rewards .internal-card .btn-secondary {
          color:#14213D !important;
          border-color:#B8AE9E !important;
          box-shadow:none !important;
        }
        .internal-rewards .internal-card .btn-primary {
          background:#D89500 !important;
        }
        .internal-rewards .internal-card .btn-primary:hover {
          background:#C47D00 !important;
        }
        .internal-rewards .internal-card .btn-secondary {
          background:#E9E2D6 !important;
        }
        .internal-rewards .internal-card .btn-secondary:hover {
          background:#DDD4C5 !important;
        }
        .internal-rewards .internal-card .grid.gap-2.sm\\:grid-cols-5 > button {
          background:#FBF8F2 !important;
          color:#14213D !important;
          border-color:#C9C0B2 !important;
          text-align:right !important;
        }
        .internal-rewards .internal-card .grid.gap-2.sm\\:grid-cols-5 > button span {
          color:#14213D !important;
        }
        .internal-rewards .internal-card .grid.gap-2.sm\\:grid-cols-5 > button span:first-child {
          color:#3F4B5A !important;
        }
        .internal-rewards .internal-card .grid.gap-2.sm\\:grid-cols-5 > button.bg-\\[\\#FFF0C2\\] span {
          color:#14213D !important;
        }
        .internal-rewards .internal-card .grid.gap-2.sm\\:grid-cols-5 > button:hover {
          background:#F1EBDD !important;
        }
        .internal-rewards aside.internal-card .mt-4.space-y-2 > button {
          background:#FBF8F2 !important;
          color:#14213D !important;
          border-color:#C9C0B2 !important;
        }
        .internal-rewards aside.internal-card .mt-4.space-y-2 > button:hover {
          background:#F1EBDD !important;
        }
        .internal-rewards aside.internal-card .mt-4.space-y-2 > button.bg-\\[\\#FFF0C2\\] {
          background:#FFF0C2 !important;
          border-color:#F2A900 !important;
        }
        .internal-rewards .internal-card h1,
        .internal-rewards .internal-card h2,
        .internal-rewards .internal-card h3,
        .internal-rewards .internal-card h4 {
          color:#14213D !important;
        }
        .internal-rewards .internal-card p,
        .internal-rewards .internal-card span,
        .internal-rewards .internal-card div {
          color:inherit;
        }
        .internal-rewards label {
          display:block;
          color:#26354A !important;
          font-weight:700;
        }
        .internal-rewards .form-input {
          appearance:none;
          width:100%;
          background:#FFFDF8 !important;
          border:1px solid #B8AE9E !important;
          border-radius:12px;
          color:#17263B !important;
          caret-color:#17263B;
          min-height:46px;
          padding:10px 12px;
          outline:none;
          box-shadow:inset 0 1px 2px rgba(20,33,61,.04);
        }
        .internal-rewards .form-input::placeholder {
          color:#687382 !important;
          opacity:1;
        }
        .internal-rewards .form-input:focus {
          background:#FFFFFF !important;
          border-color:#D89500 !important;
          box-shadow:0 0 0 3px rgba(216,149,0,.16) !important;
        }
        .internal-rewards select.form-input,
        .internal-rewards input.form-input,
        .internal-rewards textarea.form-input {
          color:#17263B !important;
          background:#FFFDF8 !important;
        }
        .internal-rewards option {
          color:#17263B !important;
          background:#FFFDF8 !important;
        }
        .internal-rewards fieldset:disabled .form-input {
          background:#EDE8DE !important;
          color:#697383 !important;
          border-color:#C9C0B2 !important;
        }
        .internal-rewards fieldset:disabled .form-input::placeholder {
          color:#7C8490 !important;
        }
        .internal-rewards .bg-white\/10 {
          background:#E9E2D6 !important;
          color:#26354A !important;
        }
        .internal-rewards .bg-white\/10 * {
          color:#26354A !important;
        }
        .internal-rewards .text-\[\#5B6470\] {
          color:#4F5B69 !important;
        }
        .internal-rewards .text-\[\#14213D\] {
          color:#14213D !important;
        }
        .internal-rewards .text-\[\#D9622B\] {
          color:#B94E24 !important;
        }
        .internal-rewards .text-\[\#F2A900\] {
          color:#C47D00 !important;
        }
        /* Unified internal-form design system */
        .internal-jalali-calendar .calendar-nav,
        .internal-jalali-calendar .calendar-nav * {
          color:#14213D !important;
          background:#EEE8DE !important;
        }
        .internal-jalali-calendar .calendar-nav:hover {
          background:#E2D9CA !important;
          border-color:#AFA18E !important;
        }
        .internal-jalali-calendar .calendar-select {
          color:#14213D !important;
          background:#FFFDF8 !important;
        }
        .internal-jalali-calendar .calendar-select option {
          color:#14213D !important;
          background:#FFFDF8 !important;
        }
        .internal-jalali-calendar button {
          color:#26354A;
        }
        .internal-jalali-calendar button:hover {
          background:#FFF0C2;
        }
        .internal-rewards .proposal-shell {
          background:#FFFDF8 !important;
          color:#14213D !important;
          border:1px solid #D7CCBC !important;
        }
        .internal-rewards .proposal-shell h2,
        .internal-rewards .proposal-shell h3 {
          color:#14213D !important;
        }
        .internal-rewards .proposal-shell p,
        .internal-rewards .proposal-shell span,
        .internal-rewards .proposal-shell div {
          color:inherit;
        }
        .internal-rewards .proposal-shell .proposal-subcard {
          background:#FBF8F2 !important;
          color:#14213D !important;
          border:1px solid #DDD3C4 !important;
        }
        .internal-rewards .proposal-shell .proposal-subcard h3,
        .internal-rewards .proposal-shell .proposal-subcard b {
          color:#14213D !important;
        }
        .internal-rewards .proposal-shell .proposal-history-item {
          background:#F1EBE1 !important;
          color:#26354A !important;
          border:1px solid #DDD3C4 !important;
        }
        .internal-rewards .proposal-shell .proposal-action {
          background:#FFF5D9 !important;
          color:#26354A !important;
          border:1px solid #E4C979 !important;
        }
        .internal-rewards .proposal-shell .proposal-action h3,
        .internal-rewards .proposal-shell .proposal-action label {
          color:#26354A !important;
        }
        .internal-rewards .proposal-shell .proposal-empty {
          background:#F8F5EE !important;
          color:#26354A !important;
          border:1px dashed #C9C0B2 !important;
        }
        .internal-rewards {
          --ir-bg:#F3EFE7;
          --ir-surface:#F8F5EE;
          --ir-surface-2:#FBF8F2;
          --ir-input:#FFFDF8;
          --ir-border:#D2C7B7;
          --ir-border-soft:#E4DCCE;
          --ir-ink:#14213D;
          --ir-body:#26354A;
          --ir-muted:#596474;
          --ir-gold:#D89500;
          --ir-gold-dark:#A96800;
          --ir-gold-soft:#FFF0C2;
          --ir-green:#2D6A4F;
        }
        .internal-rewards .internal-card {
          border-radius:24px !important;
        }
        .internal-rewards .internal-card > .border-b {
          border-color:#DDD3C4 !important;
        }
        .internal-rewards .internal-card fieldset {
          border:0;
        }
        .internal-rewards fieldset > div > div.rounded-2xl,
        .internal-rewards fieldset > div > div.rounded-2xl.bg-\[\#F4EEE4\],
        .internal-rewards fieldset > div > div.rounded-2xl.bg-\[\#FAF8F4\] {
          border-color:#DED4C6 !important;
        }
        .internal-rewards fieldset > div > div.bg-white,
        .internal-rewards fieldset > div > div.bg-\[\#FAF8F4\] {
          background:#FBF8F2 !important;
        }
        .internal-rewards fieldset > div > div.bg-\[\#F4EEE4\] {
          background:#F1EBE1 !important;
        }
        .internal-rewards fieldset > div > div.bg-\[\#FFF8E6\] {
          background:#FFF5D9 !important;
          border-color:#E4C979 !important;
        }
        .internal-rewards .form-input {
          min-height:48px;
          border-radius:11px !important;
          border-color:#BFB4A4 !important;
          background:#FFFDF8 !important;
          color:#17263B !important;
          font-size:14px;
          transition:border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }
        .internal-rewards textarea.form-input {
          min-height:112px;
          line-height:1.9;
        }
        .internal-rewards .form-input:hover {
          border-color:#9F9382 !important;
        }
        .internal-rewards .form-input:focus {
          border-color:#D89500 !important;
          box-shadow:0 0 0 3px rgba(216,149,0,.14) !important;
        }
        .internal-rewards label {
          color:#26354A !important;
          line-height:1.7;
        }
        .internal-rewards label > input,
        .internal-rewards label > select,
        .internal-rewards label > textarea {
          font-weight:500;
        }
        .internal-rewards label span {
          line-height:1.6;
        }
        .internal-rewards .btn-primary,
        .internal-rewards .btn-secondary {
          min-height:44px;
          border-radius:11px !important;
          font-weight:800 !important;
          transition:transform .15s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease;
        }
        .internal-rewards .btn-primary,
        .internal-rewards .btn-secondary {
          min-height:46px;
          border-radius:12px !important;
          font-weight:800 !important;
          font-size:14px !important;
          line-height:1.2 !important;
          display:inline-flex !important;
          align-items:center;
          justify-content:center;
          gap:7px;
          white-space:nowrap;
          padding:0 18px !important;
          transition:transform .15s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease;
        }
        .internal-rewards .btn-action {
          min-height:48px !important;
          padding:0 20px !important;
          border-radius:13px !important;
        }
        .internal-rewards .btn-compact {
          min-height:42px !important;
          padding:0 15px !important;
          font-size:13px !important;
        }
        .internal-rewards .btn-primary {
          background:#D89500 !important;
          border:1px solid #B87800 !important;
          color:#14213D !important;
          box-shadow:0 3px 9px rgba(168,104,0,.14) !important;
        }
        .internal-rewards .btn-primary:hover {
          background:#C98200 !important;
          border-color:#A96800 !important;
          box-shadow:0 5px 14px rgba(168,104,0,.18) !important;
          transform:translateY(-1px);
        }
        .internal-rewards .btn-secondary {
          background:#E9E2D6 !important;
          border:1px solid #C8BDAE !important;
          color:#26354A !important;
        }
        .internal-rewards .btn-secondary:hover {
          background:#DED5C7 !important;
          border-color:#ADA190 !important;
          transform:translateY(-1px);
        }
        .internal-rewards button:disabled {
          cursor:not-allowed;
        }
        .internal-rewards .rounded-full.bg-\[\#E8F4F1\] {
          background:#E2F0EA !important;
          color:#286046 !important;
          border:1px solid #BDD9CC;
        }
        .internal-rewards .rounded-lg.bg-\[\#FFF8E6\] {
          background:#FFF1C9 !important;
          color:#875A00 !important;
          border:1px solid #E3C675;
        }
        .internal-rewards .rounded-2xl.bg-\[\#F4EEE4\].p-4,
        .internal-rewards .rounded-2xl.bg-\[\#F4EEE4\].p-6 {
          background:#F1EBE1 !important;
          border:1px solid #DDD2C3;
        }
        .internal-rewards .rounded-2xl.bg-\[\#F4EEE4\] strong {
          color:#14213D !important;
        }
        .internal-rewards table {
          color:#26354A;
        }
        .internal-rewards table thead {
          color:#14213D !important;
        }
        .internal-rewards table thead th {
          background:#EAE3D8 !important;
          color:#26354A !important;
          font-weight:800;
        }
        .internal-rewards table tbody tr {
          border-color:#DDD3C5 !important;
        }
        .internal-rewards table tbody tr:hover {
          background:#F6F0E7 !important;
        }
        .internal-rewards .rounded-xl.border.border-\[\#14213D\]\/10.bg-\[\#FAF8F4\] {
          background:#FBF8F2 !important;
          border-color:#D5CAB9 !important;
        }
        .internal-rewards .h-3.overflow-hidden.rounded-full.bg-\[\#EEE8DE\] {
          background:#DED7CC !important;
        }
        .internal-rewards .h-full.rounded-full.bg-\[\#F2A900\] {
          background:#D89500 !important;
        }
        .internal-rewards .h-full.rounded-full.bg-\[\#14213D\] {
          background:#52627A !important;
        }
        .internal-rewards .text-\[\#D9622B\] {
          color:#B84D25 !important;
        }
        .internal-rewards .text-\[\#F2A900\] {
          color:#A96800 !important;
        }
        .internal-rewards .text-\[\#D99000\] {
          color:#A96800 !important;
        }
        .internal-rewards .text-\[\#2D6A4F\] {
          color:#286046 !important;
        }
        .internal-rewards .text-\[\#DDE3EC\],
        .internal-rewards .text-\[\#E6EAF0\] {
          color:#536074 !important;
        }
        .internal-rewards .rounded-xl.border.border-\[\#14213D\]\/10.bg-white {
          border-color:#D7CCBC !important;
          background:#FBF8F2 !important;
        }
        .internal-rewards .rounded-xl.border.border-\[\#14213D\]\/10.bg-white:hover {
          border-color:#B9AD9C !important;
        }
        .internal-rewards .text-\[\#E6EAF0\],
        .internal-rewards .text-\[\#DDE3EC\] {
          color:#445268 !important;
        }
      `}</style>

      <div className="container-site">
        <div className="mb-5 flex flex-col gap-3 rounded-3xl bg-[#14213D] p-5 text-white md:flex-row md:items-center md:justify-between md:p-7">
          <div>
            <p className="text-sm font-bold text-[#F2A900]">سامانه داخلی خورشید</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold md:text-3xl">پرونده و پاداش پروژه</h1>
              {sessionUser && (
                <span className="rounded-full border border-[#F2B544]/30 bg-[#F2B544]/10 px-3 py-1 text-xs font-bold text-[#F2B544]">
                  {sessionUser.name} · {sessionUser.role === "finance" ? "ویرایشگر" : "مشاهده"}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {sessionUser?.role !== "beneficiary" && <button onClick={() => setView("dashboard")} className={`rounded-xl px-4 py-2 text-sm font-bold ${view === "dashboard" ? "bg-[#F2A900] text-[#14213D]" : "bg-white/10 text-white"}`}>داشبورد و گزارش</button>}
            {sessionUser?.role !== "beneficiary" && <button onClick={() => { window.location.href = "/internal/opportunities"; }} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white">پیشنهادها و کارتابل</button>}
            <button type="button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white">خروج</button>
          </div>
        </div>
        {view === "dashboard" && (
          <>
            <div className="mb-4 flex justify-start">
              <button onClick={() => setView("projects")} className="rounded-xl border border-[#D8D0C4] bg-[#FFFDF8] px-4 py-2 text-sm font-bold text-[#18304A] shadow-sm hover:bg-[#FFF4D6]">بازگشت به صفحه اصلی</button>
            </div>
            <Dashboard projects={projects} dashboard={dashboard} />
          </>
        )}
        {view === "proposals" && (
          <section className="proposal-shell grid gap-6 lg:grid-cols-[330px_1fr] rounded-3xl">
            <div className="lg:col-span-2 flex justify-start">
              <button onClick={() => { setView("projects"); setSelectedProposal(""); }} className="rounded-xl border border-[#D8D0C4] bg-[#FFFDF8] px-4 py-2 text-sm font-bold text-[#18304A] shadow-sm hover:bg-[#FFF4D6]">بازگشت به صفحه اصلی</button>
            </div>
            <aside className="internal-card proposal-subcard rounded-3xl p-5">
              <h2 className="text-lg font-bold">پیشنهادها و کارتابل</h2>
              <p className="mt-1 text-xs">کارتابل گردش فرصت‌ها</p>
              {sessionUser?.role === "beneficiary" && (
                <button className="btn-primary mt-4 w-full px-4 py-3 text-sm" onClick={() => setSelectedProposal("")}>+ ثبت پیشنهاد جدید</button>
              )}
              <div className="mt-4 space-y-2">
                {visibleProposals.map((p) => (
                  <button key={p.id} onClick={() => setSelectedProposal(p.id)} className="w-full rounded-xl border bg-white px-4 py-3 text-right">
                    <span className="block font-bold">{p.title}</span>
                    <span className="mt-1 block text-xs">{p.code} · {p.status}</span>
                  </button>
                ))}
              </div>
            </aside>
            <section className="internal-card proposal-subcard rounded-3xl p-6 md:p-8">
              {!selectedProposalData && sessionUser?.role === "beneficiary" && (
                <div className="proposal-shell rounded-2xl p-1">
                  <h2 className="text-2xl font-extrabold">ثبت پیشنهاد اولیه</h2>
                  <p className="mt-2 text-sm leading-7">فرم اولیه کوتاه است؛ ادامه مسیر توسط قائم‌مقام و واحدهای مربوط انجام می‌شود.</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <SelectField label="نوع فرصت" value={proposalType} onChange={(v)=>setProposalType(v as Proposal["type"])} options={["پروژه","مشتری","اسپانسر","فرصت همکاری"]} />
                    <Field label="عنوان پیشنهاد *" value={proposalTitle} onChange={setProposalTitle} />
                    <Field label="مشتری / برند / اسپانسر" value={proposalClient} onChange={setProposalClient} />
                    <Field label="اطلاعات تماس" value={proposalContact} onChange={setProposalContact} />
                    <Field label="برآورد اولیه ارزش" type="number" value={proposalExpectedValue} onChange={setProposalExpectedValue} />
                    <TextArea label="شرح کوتاه *" value={proposalDescription} onChange={setProposalDescription} />
                  </div>
                  <button className="btn-primary mt-5 px-6 py-3" onClick={createProposal}>ارسال برای قائم‌مقام</button>
                </div>
              )}
              {!selectedProposalData && sessionUser?.role !== "beneficiary" && (
                <div className="proposal-empty rounded-2xl border border-dashed p-8 text-center">
                  <h2 className="text-xl font-bold">کارتابل پیشنهادها</h2>
                  <p className="mt-2 text-sm">یک پیشنهاد را از فهرست انتخاب کنید.</p>
                </div>
              )}
              {selectedProposalData && (
                <div>
                  <div className="border-b pb-5">
                    <p className="text-xs font-bold">{selectedProposalData.code}</p>
                    <h2 className="mt-1 text-2xl font-extrabold">{selectedProposalData.title}</h2>
                    <p className="mt-1 text-xs">ثبت‌کننده: {selectedProposalData.creatorName} · وضعیت: {selectedProposalData.status}</p>
                  </div>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="proposal-subcard rounded-2xl bg-white p-5">
                      <h3 className="font-bold">اطلاعات اولیه</h3>
                      <div className="mt-4 grid gap-3">
                        <Field label="مشتری / برند / اسپانسر" value={selectedProposalData.clientName} onChange={(v)=>updateProposal({clientName:v})} />
                        <Field label="اطلاعات تماس" value={selectedProposalData.clientContact} onChange={(v)=>updateProposal({clientContact:v})} />
                        <TextArea label="شرح" value={selectedProposalData.description} onChange={(v)=>updateProposal({description:v})} />
                      </div>
                    </div>
                    <div className="proposal-subcard rounded-2xl bg-white p-5">
                      <h3 className="font-bold">تاریخچه</h3>
                      <div className="mt-4 space-y-2">{[...selectedProposalData.history].reverse().map(h=><div key={h.id} className="proposal-history-item rounded-xl bg-[#F4EEE4] p-3"><b>{h.action}</b><div className="text-xs">{h.date} · {h.actor}</div>{h.note && <div className="text-xs">{h.note}</div>}</div>)}</div>
                    </div>
                  </div>
                  {sessionUser?.role === "deputy" && ["در حال بررسی قائم‌مقام","نیازمند تکمیل"].includes(selectedProposalData.status) && (
                    <div className="proposal-action mt-5 rounded-2xl bg-[#FFF8E6] p-5">
                      <h3 className="font-bold">بررسی قائم‌مقام</h3>
                      <TextArea label="یادداشت تصمیم" value={proposalNote} onChange={setProposalNote} />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button className="btn-primary px-4 py-2" onClick={deputyApproveProposal}>تأیید اولیه</button>
                        <button className="btn-secondary px-4 py-2" onClick={deputyRequestCompletion}>نیازمند تکمیل</button>
                        <button className="btn-secondary px-4 py-2" onClick={deputyRejectProposal}>رد</button>
                      </div>
                    </div>
                  )}
                  {sessionUser?.role === "deputy" && selectedProposalData.status === "تأیید اولیه" && (
                    <div className="mt-5 rounded-2xl bg-white p-5">
                      <h3 className="font-bold">ارجاع برای تدوین پروپوزال</h3>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <Field label="معاونت / واحد" value={proposalAssignee} onChange={setProposalAssignee} />
                        <Field label="مسئول مشخص" value={proposalAssigneeName} onChange={setProposalAssigneeName} />
                        <TextArea label="شرح مأموریت" value={proposalBrief} onChange={setProposalBrief} />
                      </div>
                      <button className="btn-primary mt-4 px-4 py-2" onClick={assignSpecialist}>ارجاع و شروع تدوین</button>
                    </div>
                  )}
                  {sessionUser?.role === "deputy" && selectedProposalData.status === "در حال تدوین پروپوزال" && (
                    <div className="mt-5 rounded-2xl bg-white p-5">
                      <h3 className="font-bold">تکمیل پروپوزال و بازگشت به قائم‌مقام</h3>
                      <TextArea label="جزئیات پروپوزال" value={proposalDetails || selectedProposalData.proposalDetails} onChange={setProposalDetails} />
                      <button className="btn-secondary mt-4 px-4 py-2" onClick={specialistComplete}>ثبت تکمیل</button>
                    </div>
                  )}
                  {sessionUser?.role === "deputy" && selectedProposalData.status === "بازگشت به قائم‌مقام" && (
                    <div className="mt-5 rounded-2xl bg-[#FFF8E6] p-5">
                      <h3 className="font-bold">بازبینی و ارجاع برای مذاکره</h3>
                      <TextArea label="یادداشت تصمیم" value={proposalNote} onChange={setProposalNote} />
                      <button className="btn-primary mt-4 px-4 py-2" onClick={sendToPartnerships}>ارجاع به توسعه مشارکت‌ها</button>
                    </div>
                  )}
                  {sessionUser?.role === "deputy" && selectedProposalData.status === "آماده مذاکره" && (
                    <div className="mt-5 rounded-2xl bg-white p-5">
                      <h3 className="font-bold">مذاکره و قرارداد</h3>
                      <TextArea label="یادداشت مذاکرات" value={proposalNegotiation} onChange={setProposalNegotiation} />
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <Field label="شماره قرارداد" value={proposalContractNo} onChange={setProposalContractNo} />
                        <Field label="مبلغ قرارداد" type="number" value={proposalContractValue} onChange={setProposalContractValue} />
                        <Field label="تاریخ قرارداد" value={proposalContractDate} onChange={setProposalContractDate} />
                      </div>
                      <button className="btn-primary mt-4 px-4 py-2" onClick={recordContractAndSendFinance}>ثبت قرارداد و ارجاع به مالی</button>
                    </div>
                  )}
                  {sessionUser?.role === "finance" && selectedProposalData.status === "ارجاع به مالی" && (
                    <div className="mt-5 rounded-2xl bg-white p-5">
                      <h3 className="font-bold">ثبت مالی</h3>
                      <TextArea label="یادداشت مالی" value={proposalFinanceNote} onChange={setProposalFinanceNote} />
                      <button className="btn-primary mt-4 px-4 py-2" onClick={financeRegisterProposal}>ثبت رسمی</button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </section>
        )}

        <div className={view !== "projects" ? "hidden" : ""}>

        <div className="mb-8 rounded-3xl bg-[#14213D] p-7 text-white md:p-10">
          <p className="text-sm font-bold text-[#F2A900]">سامانه داخلی خورشید</p>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">پرونده و پاداش پروژه</h1>
          <p className="mt-3 max-w-4xl text-sm leading-8 text-[#E6EAF0]">
            پرونده دیجیتال پروژه از تعریف و قرارداد تا اعضا، مالی، پاداش، تأیید و تسویه در یک مسیر واحد ثبت می‌شود.
            اطلاعات این صفحه برای کاهش فرم‌های پراکنده و حفظ سابقه تصمیم‌ها طراحی شده است.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="internal-card glass rounded-3xl p-5">
            <h2 className="text-lg font-bold">پرونده پروژه‌ها</h2>
            {canEdit && (
              <button
                className="btn-primary mt-4 w-full px-5 py-3 text-sm"
                onClick={resetDraft}
              >
                + پروژه جدید
              </button>
            )}

            <div className="mt-4 space-y-2">
              {projects.length === 0 && (
                <p className="text-sm !text-[#3F4B5A]">هنوز پروژه‌ای ثبت نشده است.</p>
              )}
              {projects.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelected(item.id);
                    setStep(sessionUser?.role === "finance" ? 1 : 2);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-right text-sm transition ${
                    selected === item.id
                      ? "border-[#F2A900] bg-[#FFF0C2]"
                      : "border-[#14213D]/10 bg-white hover:bg-[#F7F1E8]"
                  }`}
                >
                  <span className="block font-bold text-[#14213D]">{item.name || "بدون نام"}</span>
                  <span className="mt-1 block text-[11px] !text-[#3F4B5A]">
                    {item.code} · {item.clientName || "مشتری ثبت نشده"}
                  </span>
                  <span className="text-xs !text-[#3F4B5A]">
                    {item.status} · {item.people.length} نفر
                  </span>
                </button>
              ))}
            </div>

            {canEdit && projects.length > 0 && (
              <button className="mt-6 text-xs text-[#D9622B]" onClick={resetAll}>
                حذف همه پروژه‌ها
              </button>
            )}
          </aside>

          <section className="internal-card glass rounded-3xl p-6 md:p-8">
            {project ? (
              <>
                <div className="border-b border-[#14213D]/10 pb-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#D9622B]">پرونده پروژه · {project.code}</p>
                      <input
                        className="mt-1 w-full bg-transparent text-2xl font-extrabold text-[#14213D] outline-none"
                        value={project.name}
                        onChange={(e) => updateProject({ name: e.target.value })}
                      />
                      <p className="mt-1 text-xs !text-[#3F4B5A]">
                        ایجاد: {project.createdAt || "-"} {project.clientName ? `· مشتری: ${project.clientName}` : ""}
                      </p>
                    </div>
                    <select className="form-input md:w-44" value={project.status} onChange={(e) => updateProject({ status: e.target.value as Project["status"] })}>
                      <option>پیش‌نویس</option>
                      <option>فعال</option>
                      <option>تسویه‌شده</option>
                    </select>
                  </div>

                  <div className="mt-6 grid gap-2 sm:grid-cols-5">
                    {steps.map((item) => (item.n === 1 || item.n === 3) && !canEdit ? null : (
                      <button
                        key={item.n}
                        onClick={() => setStep(item.n)}
                        className={`rounded-xl border px-3 py-3 text-right transition ${
                          step === item.n
                            ? "border-[#F2A900] bg-[#FFF0C2]"
                            : step > item.n
                              ? "border-[#BFD8D0] bg-[#E8F4F1]"
                              : "border-[#14213D]/10 bg-white"
                        }`}
                      >
                        <span className="block text-xs !text-[#3F4B5A]">مرحله {item.n}</span>
                        <span className="mt-1 block text-xs font-bold text-[#14213D]">{item.title}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <fieldset disabled={!canEdit} className="min-w-0">
                {step === 1 && canEdit && (
                  <div className="mt-8">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                      <div>
                        <h2 className="text-xl font-bold">اطلاعات پایه و قرارداد پروژه</h2>
                        <p className="mt-1 text-sm leading-7 !text-[#3F4B5A]">
                          این بخش شناسنامه پروژه است. اطلاعات مشتری، بازوی اجرایی، منبع پروژه، زمان، قرارداد و شرح خروجی باید در همین پرونده قابل ردیابی باشد.
                        </p>
                      </div>
                      <span className="rounded-full bg-[#E8F4F1] px-3 py-1 text-xs font-bold">ذخیره خودکار</span>
                    </div>

                    <div className="mt-6 rounded-2xl border border-[#14213D]/10 bg-white p-5">
                      <h3 className="font-bold">۱. شناسنامه و طرفین پروژه</h3>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="نام پروژه *" value={project.name} onChange={(v) => updateProject({ name: v })} />
                        <Field label="کد پرونده" value={project.code} onChange={(v) => updateProject({ code: v })} />
                        <Field label="نام مشتری / کارفرما *" value={project.clientName} onChange={(v) => updateProject({ clientName: v })} placeholder="نام شرکت، سازمان یا شخص" />
                        <SelectField label="نوع مشتری" value={project.clientType} onChange={(v) => updateProject({ clientType: v })} options={["شرکت / سازمان", "نهاد عمومی", "برند", "شخص حقیقی", "سایر"]} />
                        <Field label="اطلاعات تماس مشتری" value={project.clientContact} onChange={(v) => updateProject({ clientContact: v })} placeholder="نام رابط، تلفن، ایمیل" />
                        <Field label="بازوی اجرایی / شرکت وابسته" value={project.executiveArm} onChange={(v) => updateProject({ executiveArm: v })} placeholder="در صورت اجرا توسط شرکت یا بازوی وابسته" />
                        <SelectField label="نوع پروژه" value={project.projectType} onChange={(v) => updateProject({ projectType: v })} options={["تولید محتوا", "پروژه هنری", "مسئولیت اجتماعی / CSR", "تبلیغات و برندینگ", "رویداد", "آموزش و پژوهش", "رسانه", "مشاوره", "سایر"]} />
                        <SelectField label="منبع ایجاد پروژه" value={project.projectSource} onChange={(v) => updateProject({ projectSource: v })} options={["مذاکره مستقیم", "معرفی / شبکه ارتباطی", "حامی / شریک راهبردی", "فراخوان / مناقصه", "مشتری قبلی", "سایر"]} />
                        <Field label="معرف / منشأ ارتباط" value={project.referrer} onChange={(v) => updateProject({ referrer: v })} placeholder="نام فرد یا مجموعه معرف، در صورت وجود" />
                        <Field label="مدیر پروژه" value={project.manager} onChange={(v) => updateProject({ manager: v })} />
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-[#14213D]/10 bg-white p-5">
                      <h3 className="font-bold">۲. شرح، هدف و محدوده</h3>
                      <div className="mt-4 grid gap-4">
                        <TextArea label="شرح پروژه" value={project.description} onChange={(v) => updateProject({ description: v })} placeholder="مسئله، نیاز مشتری و ماهیت کلی پروژه" />
                        <TextArea label="اهداف و نتایج مورد انتظار" value={project.objectives} onChange={(v) => updateProject({ objectives: v })} placeholder="اهداف قابل سنجش یا نتایج مورد انتظار" />
                        <TextArea label="خروجی‌ها / اقلام قابل تحویل" value={project.deliverables} onChange={(v) => updateProject({ deliverables: v })} placeholder="مثلاً فیلم، گزارش، رویداد، کمپین، محتوای شبکه اجتماعی..." />
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-[#14213D]/10 bg-white p-5">
                      <h3 className="font-bold">۳. زمان، مکان و قرارداد</h3>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <JalaliDateField label="تاریخ شروع" value={project.startDate} onChange={(v) => updateProject({ startDate: v })} />
                        <JalaliDateField label="تاریخ پایان / تحویل" value={project.endDate} onChange={(v) => updateProject({ endDate: v })} />
                        <Field label="محل اجرا" value={project.location} onChange={(v) => updateProject({ location: v })} />
                        <Field label="شماره قرارداد / سفارش" value={project.contractNo} onChange={(v) => updateProject({ contractNo: v })} />
                        <JalaliDateField label="تاریخ قرارداد" value={project.contractDate} onChange={(v) => updateProject({ contractDate: v })} />
                        <Field label="مبلغ قرارداد" type="number" value={project.contractValue ? String(project.contractValue) : ""} onChange={(v) => updateProject({ contractValue: Number(v) || 0, revenue: Number(v) || 0 })} />
                        <SelectField label="واحد مبلغ" value={project.currency} onChange={(v) => updateProject({ currency: v })} options={["ریال", "تومان", "دلار", "یورو", "سایر"]} />
                        <SelectField label="اولویت پروژه" value={project.priority} onChange={(v) => updateProject({ priority: v })} options={["عادی", "مهم", "فوری", "راهبردی"]} />
                        <SelectField label="سطح محرمانگی" value={project.confidentiality} onChange={(v) => updateProject({ confidentiality: v })} options={["عادی", "داخلی", "محرمانه", "محرمانه ویژه"]} />
                        <Field label="ثبت‌کننده پرونده" value={project.creator} onChange={(v) => updateProject({ creator: v })} />
                      </div>
                      <div className="mt-4">
                        <TextArea label="شرایط پرداخت / مفاد مالی مهم" value={project.paymentTerms} onChange={(v) => updateProject({ paymentTerms: v })} placeholder="پیش‌پرداخت، اقساط، زمان پرداخت، شروط تحویل و موارد مهم" />
                      </div>
                    </div>

                    <div className="mt-5">
                      <TextArea label="یادداشت‌ها و ملاحظات پرونده" value={project.notes} onChange={(v) => updateProject({ notes: v })} placeholder="ریسک‌ها، تعهدات خاص، نکات مذاکره و توضیحات تکمیلی" />
                    </div>
                  </div>
                )}

                </fieldset>

                {step === 2 && (
                  <div className="mt-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-xl font-bold">اعضای پروژه، همکاران و سهم مشارکت</h2>
                        {canEditTeam && <p className="mt-2 text-xs font-bold text-[#9A6500]">مدیرعامل فقط در مرحله اعضای پروژه امکان ویرایش اعضای تیم را دارد؛ سایر مراحل برای او فقط نمایشی هستند.</p>}
                        <p className="mt-1 text-sm leading-7 !text-[#3F4B5A]">
                          علاوه بر نقش و وزن، رابطه فرد با پروژه، اطلاعات تماس، معرف و توضیحات همکاری ثبت می‌شود تا مبنای پاداش و سابقه پروژه روشن باشد.
                        </p>
                      </div>
                      <button type="button" className="btn-secondary btn-compact" onClick={() => setShowGuide((v) => !v)}>
                        {showGuide ? "بستن راهنمای نقش‌ها" : "راهنمای نقش و وزن"}
                      </button>
                    </div>

                    {showGuide && (
                      <div className="mt-5 rounded-2xl border border-[#F2A900]/40 bg-[#FFF8E6] p-5">
                        <h3 className="font-bold">راهنمای تعیین وزن</h3>
                        <p className="mt-2 text-sm leading-7 !text-[#3F4B5A]">
                          وزن مؤثر = ضریب پایه نقش × درصد مشارکت ÷ ۱۰۰. این ضرایب پیشنهادی اولیه‌اند و باید در نسخه نهایی سیاست پاداش خورشید تصویب و قابل ویرایش توسط مدیر مجاز شوند.
                        </p>
                        <div className="mt-4 overflow-x-auto rounded-xl border border-[#14213D]/10 bg-white">
                          <table className="w-full min-w-[680px] text-right text-sm">
                            <thead className="bg-[#F4EEE4]"><tr><th className="p-3">نقش</th><th className="p-3">ضریب پایه</th><th className="p-3">شرح</th></tr></thead>
                            <tbody>{ROLE_GUIDE.map((role) => <tr key={role.name} className="border-t border-[#14213D]/10"><td className="p-3 font-semibold">{role.name}</td><td className="p-3">{role.weight}</td><td className="p-3 !text-[#3F4B5A]">{role.desc}</td></tr>)}</tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <fieldset disabled={!canEditTeam} className="mt-5 rounded-2xl bg-[#F4EEE4] p-5 disabled:opacity-70">
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        <Field label="نام فرد" value={personName} onChange={setPersonName} placeholder="نام و نام خانوادگی" />
                        <SelectField label="نقش" value={personRole} onChange={setPersonRole} options={ROLE_GUIDE.map((r) => r.name)} />
                        <SelectField label="نوع همکاری" value={personRelationship} onChange={setPersonRelationship} options={["عضو داخلی", "همکار تخصصی", "معرف", "شریک", "پیمانکار", "حامی / شریک اقتصادی", "سایر"]} />
                        <label className="block text-sm font-semibold">
                          درصد مشارکت در نقش
                          <input className="form-input mt-2 bg-white" inputMode="decimal" min="1" max="100" value={personPercent} onChange={(e) => setPersonPercent(e.target.value)} />
                        </label>
                        <label className="block text-sm font-semibold">
                          ضریب نقش
                          <input className="form-input mt-2 bg-white" inputMode="decimal" min="0" step="0.1" value={personRoleWeight} onChange={(e) => setPersonRoleWeight(e.target.value)} />
                          <span className="mt-1 block text-[11px] font-normal !text-[#3F4B5A]">پیشنهاد اولیه: {selectedRole.weight}</span>
                        </label>
                        <div><span className="block text-sm font-semibold">وزن مؤثر</span><div className="form-input mt-2 bg-white font-bold">{effectiveWeight.toFixed(2)}</div></div>
                        <Field label="یادداشت همکاری" value={personNotes} onChange={setPersonNotes} placeholder="توضیح کوتاه" />
                        <div className="flex items-end md:col-span-2 lg:col-span-3"><button type="button" className="btn-primary btn-action w-full sm:w-auto sm:min-w-[190px]" onClick={addPerson}>+ افزودن عضو / همکار</button></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {ROLE_GUIDE.map((role) => {
                          const total = project.people.filter((p) => p.role === role.name).reduce((sum, p) => sum + p.rolePercent, 0);
                          return <span key={role.name} className={total === 100 ? "rounded-full border border-[#BFD8D0] bg-[#E8F4F1] px-3 py-1 font-semibold text-[#2D6A4F]" : "rounded-full border border-[#14213D]/10 bg-[#FAF8F4] px-3 py-1 font-semibold !text-[#3F4B5A]"}>{role.name}: {total}٪</span>;
                        })}
                      </div>
                      <p className="mt-3 text-xs !text-[#3F4B5A]">
                        {selectedRole.name}: ضریب {selectedRole.weight} × {Math.max(0, Math.min(100, Number(personPercent) || 0))}٪ = وزن مؤثر {effectiveWeight.toFixed(2)}. مجموع سهم هر نقش باید دقیقاً ۱۰۰٪ شود.
                      </p>
                    </fieldset>

                    <div className="mt-5 overflow-x-auto rounded-2xl border border-[#14213D]/10">
                      <table className="w-full min-w-[1000px] text-right text-sm">
                        <thead className="bg-[#F4EEE4]">
                          <tr><th className="p-4">عضو</th><th className="p-4">نقش</th><th className="p-4">نوع همکاری</th><th className="p-4">درصد نقش</th><th className="p-4">ضریب</th><th className="p-4">وزن مؤثر</th><th className="p-4">سهم</th><th className="p-4">وضعیت نقش</th><th className="p-4">مبلغ پاداش</th><th /></tr>
                        </thead>
                        <tbody>
                          {payouts.map((person) => {
                            const share = totalWeight ? (person.weight / totalWeight) * 100 : 0;
                            return <tr key={person.id} className="border-t border-[#14213D]/10">
                              <td className="p-4 font-semibold">{person.name}</td>
                              <td className="p-4">{person.role}</td>
                              <td className="p-4 !text-[#3F4B5A]">{person.relationship}</td>
                              <td className="p-4">{person.rolePercent}٪</td>
                              <td className="p-4">{person.roleBaseWeight}</td>
                              <td className="p-4 font-bold">{person.weight.toFixed(2)}</td>
                              <td className="p-4">{share.toFixed(1)}٪</td>
                              <td className="p-4">{person.roleApprovalStatus === "تأیید شده" ? <span className="rounded-full bg-[#E8F4F1] px-2 py-1 text-xs font-bold text-[#2D6A4F]">تأیید شده</span> : canEditTeam ? <button type="button" className="rounded-lg bg-[#FFF8E6] px-2 py-1 text-xs font-bold text-[#9A6500]" onClick={() => approveRole(person.id)}>تأیید نقش</button> : <span className="text-xs !text-[#687382]">در انتظار تأیید</span>}</td>
                              <td className="p-4 font-bold">{money(person.amount)}</td>
                              <td className="p-4">{canEditTeam && <button className="text-xs text-[#D9622B]" onClick={() => removePerson(person.id)}>حذف</button>}</td>
                            </tr>;
                          })}
                          {payouts.length === 0 && <tr><td colSpan={10} className="p-8 text-center !text-[#3F4B5A]">هنوز عضوی ثبت نشده است.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {step === 3 && canEdit && (
                  <div className="mt-8">
                    <h2 className="text-xl font-bold">مالی پروژه و جریان نقدی</h2>
                    <p className="mt-1 text-sm leading-7 !text-[#3F4B5A]">
                      مبلغ قرارداد، درآمد، هزینه‌های مستقیم و غیرمستقیم، مالیات و دریافتی‌ها جدا ثبت می‌شوند تا سود قابل محاسبه و وضعیت نقدینگی پروژه از هم تفکیک شود.
                    </p>

                    <div className="mt-6 rounded-2xl border border-[#14213D]/10 bg-white p-5">
                      <h3 className="font-bold">درآمد و قرارداد</h3>
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <Field label="مبلغ قرارداد" type="number" value={project.contractValue ? String(project.contractValue) : ""} onChange={(v) => updateProject({ contractValue: Number(v) || 0, revenue: Number(v) || 0 })} />
                        <Field label="درآمد قطعی ثبت‌شده" type="number" value={project.revenue ? String(project.revenue) : ""} onChange={(v) => updateProject({ revenue: Number(v) || 0 })} />
                        <Field label="مبلغ دریافت‌شده" type="number" value={project.received ? String(project.received) : ""} onChange={(v) => updateProject({ received: Number(v) || 0 })} />
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-[#14213D]/10 bg-white p-5">
                      <h3 className="font-bold">هزینه‌های قابل ثبت</h3>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="هزینه‌های مستقیم پروژه" type="number" value={project.directCosts ? String(project.directCosts) : ""} onChange={(v) => updateProject({ directCosts: Number(v) || 0 })} />
                        <Field label="سربار و هزینه‌های غیرمستقیم" type="number" value={project.overheadCosts ? String(project.overheadCosts) : ""} onChange={(v) => updateProject({ overheadCosts: Number(v) || 0 })} />
                        <Field label="مالیات و عوارض قابل منظور" type="number" value={project.tax ? String(project.tax) : ""} onChange={(v) => updateProject({ tax: Number(v) || 0 })} />
                        <Field label="سایر هزینه‌های قابل کسر" type="number" value={project.otherCosts ? String(project.otherCosts) : ""} onChange={(v) => updateProject({ otherCosts: Number(v) || 0 })} />
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Summary label="کل هزینه‌ها" value={money(totalCosts)} />
                      <Summary label="مبلغ مبنای پاداش" value={money(net)} />
                      <Summary label="استخر پاداش" value={money(pool)} />
                      <Summary label="مطالبات باقی‌مانده" value={money(Math.max(0, project.revenue - project.received))} />
                    </div>

                    <div className="mt-6 grid gap-5 lg:grid-cols-2">
                      <div className="rounded-2xl border border-[#14213D]/10 bg-white p-5">
                        <h3 className="font-bold">مراحل وصول</h3>
                        <p className="mt-1 text-xs leading-6 !text-[#3F4B5A]">هر مرحله باید با وصول واقعی و تأییدشده قابل تطبیق باشد.</p>
                        <div className="mt-4 grid gap-3">
                          <Field label="عنوان مرحله" value={stageTitle} onChange={setStageTitle} placeholder="مثلاً پیش‌پرداخت" />
                          <Field label="مبلغ برنامه‌ریزی‌شده" type="number" value={stageAmount} onChange={setStageAmount} />
                          <JalaliDateField label="تاریخ وصول" value={stageDate} onChange={setStageDate} />
                          <SelectField label="وضعیت مرحله" value={stageStatus} onChange={(v)=>setStageStatus(v as CollectionStage["status"])} options={["برنامه‌ریزی‌شده","در انتظار وصول","وصول شد","لغو شد"]} />
                          <TextArea label="توضیحات" value={stageNotes} onChange={setStageNotes} />
                          <button type="button" className="btn-secondary btn-action" onClick={addCollectionStage}>+ افزودن مرحله وصول</button>
                        </div>
                        <div className="mt-4 space-y-2">{project.collectionStages.map(s=><div key={s.id} className="rounded-xl border border-[#14213D]/10 bg-[#FAF8F4] p-3"><div className="flex items-center justify-between gap-3"><div><strong>{s.title}</strong><div className="mt-1 text-xs !text-[#3F4B5A]">{money(s.plannedAmount)} · {s.status} · {s.receivedDate || "تاریخ ثبت نشده"}</div></div>{canEdit&&<button type="button" className="text-xs text-[#D9622B]" onClick={()=>removeCollectionStage(s.id)}>حذف</button>}</div></div>)}</div>
                      </div>
                      <div className="rounded-2xl border border-[#14213D]/10 bg-white p-5">
                        <h3 className="font-bold">دفتر تراکنش‌های مالی</h3>
                        <p className="mt-1 text-xs leading-6 !text-[#3F4B5A]">وصولی تأییدشده مبنای محاسبه پاداش است.</p>
                        <div className="mt-4 grid gap-3">
                          <SelectField label="نوع تراکنش" value={transactionType} onChange={(v)=>setTransactionType(v as "وصول"|"هزینه")} options={["وصول","هزینه"]} />
                          <Field label="شرح تراکنش" value={transactionDescription} onChange={setTransactionDescription} placeholder="مثلاً وصول مرحله اول قرارداد" />
                          <Field label="مبلغ" type="number" value={transactionAmount} onChange={setTransactionAmount} />
                          <JalaliDateField label="تاریخ تراکنش" value={transactionDate} onChange={setTransactionDate} />
                          <SelectField label="وضعیت تأیید" value={transactionStatus} onChange={(v)=>setTransactionStatus(v as FinancialTransaction["status"])} options={["در انتظار تأیید","تأیید شده"]} />
                          <TextArea label="توضیحات مالی" value={transactionNotes} onChange={setTransactionNotes} placeholder="شماره سند، مغایرت یا توضیح تکمیلی" />
                          <button type="button" className="btn-secondary btn-action" onClick={addTransaction}>+ ثبت تراکنش</button>
                        </div>
                        <div className="mt-4 space-y-2">{project.financialTransactions.map(t=><div key={t.id} className="rounded-xl border border-[#14213D]/10 bg-[#FAF8F4] p-3"><div className="flex items-center justify-between gap-3"><div><strong>{t.type} · {t.description}</strong><div className="mt-1 text-xs !text-[#3F4B5A]">{money(t.amount)} · {t.date || "تاریخ ثبت نشده"} · {t.status}</div></div>{canEdit&&<button type="button" className="text-xs text-[#D9622B]" onClick={()=>removeTransaction(t.id)}>حذف</button>}</div></div>)}</div>
                      </div>
                    </div>
                    <div className="mt-5 rounded-2xl border border-[#14213D]/10 bg-white p-5">
                      <h3 className="font-bold">کنترل مالی و سوابق</h3>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <JalaliDateField label="تاریخ آخرین بررسی مالی" value={project.lastFinancialReview} onChange={(v)=>updateProject({lastFinancialReview:v})} />
                        <Field label="شماره سند / رسید پرداخت" value={project.paymentReceiptNo} onChange={(v)=>updateProject({paymentReceiptNo:v})} placeholder="پس از پرداخت پاداش تکمیل شود" />
                      </div>
                      <div className="mt-4"><TextArea label="یادداشت معاون مالی" value={project.financeNote} onChange={(v)=>updateProject({financeNote:v})} placeholder="مغایرت، تأیید هزینه‌ها، وضعیت اسناد و توضیحات کنترل مالی" /></div>
                    </div>

                    <div className="mt-5 rounded-2xl bg-[#FFF8E6] p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-bold">قاعده پاداش</p>
                          <p className="mt-1 text-sm !text-[#3F4B5A]">درصد استخر پاداش از مبلغ مبنای پاداش پس از کسر هزینه‌های ثبت‌شده محاسبه می‌شود.</p>
                        </div>
                        <label className="w-full md:w-40 text-sm font-semibold">
                          درصد استخر پاداش
                          <input className="form-input mt-2 bg-white" inputMode="decimal" value={project.rewardRate} onChange={(e) => updateProject({ rewardRate: Number(e.target.value) || 0 })} />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <fieldset disabled={!canEdit} className="min-w-0">
                {step === 4 && (
                  <div className="mt-8">
                    <h2 className="text-xl font-bold">محاسبه و بررسی پاداش</h2>
                    <p className="mt-1 text-sm leading-7 !text-[#3F4B5A]">
                      نتیجه محاسبه بر اساس مبلغ مبنا، نرخ پاداش و وزن مؤثر اعضای ثبت‌شده است. این جدول همان جدول نهایی قابل چاپ پرونده است.
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Summary label="درآمد" value={money(project.revenue)} />
                      <Summary label="کل هزینه‌ها" value={money(totalCosts)} />
                      <Summary label="مبنای پاداش از وصولی" value={money(net)} />
                      <Summary label="استخر پاداش" value={money(pool)} />
                    </div>

                    <div id="print-reward-results" className="mt-6 overflow-x-auto rounded-2xl border border-[#14213D]/10">
                      <div className="mb-5 hidden print:block">
                        <div className="border-b-2 border-[#14213D] pb-4">
                          <div className="flex items-start justify-between gap-6">
                            <div>
                              <p className="text-xs font-bold text-[#D9622B]">خورشید · پرونده پروژه</p>
                              <h1 className="mt-1 text-2xl font-extrabold">{project.name}</h1>
                            </div>
                            <div className="text-left text-xs leading-6">
                              <div><strong>کد پرونده:</strong> {project.code}</div>
                              <div><strong>تاریخ:</strong> {project.createdAt || "-"}</div>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
                            <div><strong>مشتری / کارفرما:</strong><br />{project.clientName || "-"}</div>
                            <div><strong>بازوی اجرایی:</strong><br />{project.executiveArm || "-"}</div>
                            <div><strong>مدیر پروژه:</strong><br />{project.manager || "-"}</div>
                            <div><strong>نوع پروژه:</strong><br />{project.projectType || "-"}</div>
                            <div><strong>بازه اجرا:</strong><br />{project.startDate || "-"} تا {project.endDate || "-"}</div>
                            <div><strong>مبلغ مبنای پاداش:</strong><br />{money(net)} {project.currency}</div>
                            <div><strong>خالص منابع وصول‌شده:</strong><br />{money(net)} {project.currency}</div>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
                          <div><strong>نرخ پاداش:</strong> {project.rewardRate}٪</div>
                          <div><strong>استخر پاداش:</strong> {money(pool)} {project.currency}</div>
                          <div><strong>مبنای محاسبه:</strong> منابع خالص وصول‌شده</div>
                          <div><strong>تعداد اعضا:</strong> {project.people.length} نفر</div>
                        </div>
                      </div>
                      <table className="w-full min-w-[620px] text-right text-sm">
                        <thead className="bg-[#F4EEE4]">
                          <tr><th className="p-4">عضو</th><th className="p-4">نقش</th><th className="p-4">درصد مشارکت</th><th className="p-4">سهم</th><th className="p-4">مبلغ پاداش</th></tr>
                        </thead>
                        <tbody>
                          {payouts.map((person) => (
                            <tr key={person.id} className="border-t border-[#14213D]/10">
                              <td className="p-4 font-semibold">{person.name}</td>
                              <td className="p-4 !text-[#3F4B5A]">{person.role}</td>
                              <td className="p-4">{person.rolePercent}٪</td>
                              <td className="p-4">{totalWeight ? ((person.weight / totalWeight) * 100).toFixed(1) : 0}٪</td>
                              <td className="p-4 font-bold">{money(person.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button type="button" className="btn-secondary px-6 py-3" onClick={() => window.print()}>چاپ نتایج پاداش</button>
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="mt-8">
                    <h2 className="text-xl font-bold">تأیید، پرداخت و تسویه پروژه</h2>
                    <p className="mt-2 text-sm leading-7 !text-[#3F4B5A]">
                      پیش از تسویه، اطلاعات پایه، مالی و جدول پاداش بررسی می‌شود. تأیید و تاریخ تسویه در پرونده ثبت می‌گردد.
                    </p>

                    <div className="mt-6 rounded-2xl border border-[#14213D]/10 bg-white p-5">
                      <h3 className="font-bold">خلاصه پرونده</h3>
                      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        <Summary label="پروژه" value={project.name || "-"} />
                        <Summary label="مشتری" value={project.clientName || "-"} />
                        <Summary label="بازوی اجرایی" value={project.executiveArm || "-"} />
                        <Summary label="مدیر پروژه" value={project.manager || "-"} />
                        <Summary label="مبنای پاداش از وصولی" value={money(net)} />
                        <Summary label="استخر پاداش" value={money(pool)} />
                        <Summary label="دریافت‌شده" value={money(project.received)} />
                        <Summary label="وضعیت" value={project.status} />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <Field label="تأییدکننده" value={project.approvedBy} onChange={(v) => updateProject({ approvedBy: v })} placeholder="نام مسئول تأیید" />
                      <JalaliDateField label="تاریخ تسویه" value={project.settlementDate} onChange={(v) => updateProject({ settlementDate: v })} />
                    </div>
                    <div className="mt-4">
                      <TextArea label="یادداشت تأیید / تسویه" value={project.settlementNote} onChange={(v) => updateProject({ settlementNote: v })} placeholder="توضیح درباره تأیید، پرداخت یا مغایرت احتمالی" />
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button className="btn-secondary px-6 py-3" onClick={approveProject}>
                        {project.approvalStatus === "تأیید شده" ? "پروژه تأیید شده است" : "تأیید اطلاعات و فعال‌سازی پروژه"}
                      </button>
                      <button className="btn-primary px-6 py-3" onClick={settleProject} disabled={project.approvalStatus !== "تأیید شده"}>
                        ثبت تسویه نهایی
                      </button>
                    </div>
                    {project.approvalStatus === "تأیید شده" && (
                      <p className="mt-3 text-xs text-[#2D6A4F]">تأیید شده در تاریخ {project.approvedAt || "-"} توسط {project.approvedBy || "مسئول ثبت‌شده"}</p>
                    )}
                  </div>
                )}


                </fieldset>

                <div className="mt-10 flex flex-col-reverse gap-3 border-t border-[#14213D]/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <button className="btn-secondary px-6 py-3 disabled:opacity-40" onClick={previousStep} disabled={step === 1}>مرحله قبل</button>
                  <div className="text-center text-xs !text-[#3F4B5A]">مرحله {step} از {steps.length}</div>
                  {step < 5 ? (
                    <button className="btn-primary px-7 py-3" onClick={nextStep}>
                      {readOnly ? "مرحله بعد" : (step === 1 ? "ثبت اطلاعات و رفتن به اعضای پروژه" : step === 2 ? "ثبت اعضا و رفتن به اطلاعات مالی" : step === 3 ? "ثبت مالی و محاسبه پاداش" : "تأیید محاسبات و رفتن به تسویه")}
                    </button>
                  ) : (
                    <button className="btn-secondary px-7 py-3" onClick={() => setStep(4)}>بازگشت به محاسبه پاداش</button>
                  )}
                </div>
              </>
            ) : (
              <div className="mx-auto max-w-3xl">
                {canEdit ? (
                  <>
                <h2 className="text-2xl font-bold">ایجاد پرونده پروژه</h2>
                <p className="mt-2 text-sm leading-7 !text-[#3F4B5A]">
                  برای شروع فقط نام پروژه لازم است. پس از ایجاد، پرونده کامل پروژه در همین مرحله تکمیل می‌شود.
                </p>
                <div className="mt-7 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold md:col-span-2">
                    نام پروژه *
                    <input className="form-input mt-2" placeholder="مثلاً تولید محتوای کمپین اجتماعی" value={name} onChange={(e) => setName(e.target.value)} />
                  </label>
                  <label className="block text-sm font-semibold">
                    درصد استخر پاداش
                    <input className="form-input mt-2" inputMode="decimal" value={rewardRate} onChange={(e) => setRewardRate(e.target.value)} />
                  </label>
                </div>
                <button className="btn-primary mt-6 w-full px-5 py-3" onClick={createProject}>
                  ایجاد پرونده و تکمیل اطلاعات پروژه
                </button>
                  </>
                ) : (
                  <div className="rounded-2xl border border-[#14213D]/10 bg-[#F4EEE4] p-6">
                    <h2 className="text-xl font-bold text-[#14213D]">دسترسی فقط نمایشی</h2>
                    <p className="mt-2 text-sm leading-7 !text-[#3F4B5A]">
                      حساب شما امکان ایجاد یا ویرایش پروژه را ندارد. برای مشاهده، یک پرونده را از فهرست سمت راست انتخاب کنید.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
        </div>
      </div>
    </main>
  );
}


function Dashboard({
  projects,
  dashboard,
}: {
  projects: Project[];
  dashboard: {
    totalContract: number; totalRevenue: number; totalReceived: number; totalCostsAll: number;
    netReceived: number; rewardPool: number; active: number; drafts: number; settled: number;
    receivables: number; collectionRate: number;
  };
}) {
  const statusItems = [
    { label: "پیش‌نویس", value: dashboard.drafts },
    { label: "فعال", value: dashboard.active },
    { label: "تسویه‌شده", value: dashboard.settled },
  ];
  return (
    <section>
      <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#14213D]/10 md:p-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div><p className="text-xs font-bold text-[#D9622B]">تصویر مدیریتی</p><h2 className="mt-1 text-2xl font-extrabold text-[#14213D]">داشبورد پروژه‌ها</h2></div>
          <p className="text-xs !text-[#3F4B5A]">اعداد از پرونده‌های ذخیره‌شده همین سامانه محاسبه می‌شوند.</p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="تعداد پروژه‌ها" value={money(projects.length)} />
          <Summary label="ارزش قراردادها" value={money(dashboard.totalContract)} />
          <Summary label="دریافتی" value={money(dashboard.totalReceived)} />
          <Summary label="مطالبات" value={money(dashboard.receivables)} />
          <Summary label="کل هزینه‌ها" value={money(dashboard.totalCostsAll)} />
          <Summary label="خالص منابع وصول‌شده" value={money(dashboard.netReceived)} />
          <Summary label="استخر پاداش" value={money(dashboard.rewardPool)} />
          <Summary label="نرخ وصول" value={dashboard.collectionRate.toFixed(1) + "٪"} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#14213D]/10">
          <h3 className="font-bold text-[#14213D]">وضعیت سبد پروژه‌ها</h3>
          <div className="mt-6 space-y-4">
            {statusItems.map((item) => {
              const percent = projects.length ? (item.value / projects.length) * 100 : 0;
              return <div key={item.label}>
                <div className="mb-1 flex justify-between text-sm"><span>{item.label}</span><strong>{item.value}</strong></div>
                <div className="h-3 overflow-hidden rounded-full bg-[#EEE8DE]"><div className="h-full rounded-full bg-[#F2A900]" style={{ width: percent + "%" }} /></div>
              </div>;
            })}
          </div>
        </div>
        <div className="rounded-3xl bg-[#14213D] p-6 text-white shadow-sm">
          <h3 className="font-bold">اینفوگرافیک مالی سبد</h3>
          <p className="mt-1 text-xs text-[#DDE3EC]">مقایسه قرارداد، وصولی و هزینه‌ها</p>
          <div className="mt-6 space-y-5">
            {[
              ["قرارداد", dashboard.totalContract],
              ["وصولی", dashboard.totalReceived],
              ["هزینه", dashboard.totalCostsAll],
              ["استخر پاداش", dashboard.rewardPool],
            ].map(([label, value]) => {
              const n = Number(value);
              const width = dashboard.totalContract > 0 ? Math.min(100, (n / dashboard.totalContract) * 100) : 0;
              return <div key={String(label)}>
                <div className="mb-1 flex justify-between text-xs"><span>{label}</span><strong>{money(n)}</strong></div>
                <div className="h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#F2A900]" style={{ width: width + "%" }} /></div>
              </div>;
            })}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-4"><span className="text-xs text-[#DDE3EC]">پروژه فعال</span><strong className="mt-1 block text-2xl">{dashboard.active}</strong></div>
            <div className="rounded-2xl bg-white/10 p-4"><span className="text-xs text-[#DDE3EC]">تسویه‌شده</span><strong className="mt-1 block text-2xl">{dashboard.settled}</strong></div>
          </div>
        </div>
      </div>
      <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#14213D]/10">
        <div className="flex items-center justify-between"><h3 className="font-bold text-[#14213D]">نمای پروژه‌ها</h3><span className="text-xs !text-[#3F4B5A]">مبنای پاداش بر اساس وصولی خالص</span></div>
        <div className="mt-5 space-y-4">
          {projects.length === 0 ? <p className="text-sm !text-[#3F4B5A]">هنوز پروژه‌ای برای نمایش وجود ندارد.</p> : projects.slice(0, 10).map((p) => {
            const costs = p.directCosts + p.overheadCosts + p.tax + p.otherCosts;
            const net = Math.max(0, p.received - costs);
            const maxReceived = Math.max(1, ...projects.map((x) => x.received));
            const receivedForChart = p.financialTransactions.length ? p.financialTransactions.filter((t) => t.type === "وصول" && t.status === "تأیید شده").reduce((s,t) => s+t.amount,0) : p.received;
            const width = (receivedForChart / maxReceived) * 100;
            return <div key={p.id}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs"><strong>{p.name || "بدون نام"}</strong><span>{p.status} · {money(net)} مبنای پاداش</span></div>
              <div className="h-3 overflow-hidden rounded-full bg-[#EEE8DE]"><div className="h-full rounded-full bg-[#14213D]" style={{ width: width + "%" }} /></div>
            </div>;
          })}
        </div>
      </div>
    </section>
  );
}

const JALALI_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];

function div(a: number, b: number) { return Math.floor(a / b); }

function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const gdm = [0,31,59,90,120,151,181,212,243,273,304,334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) - 80 + gd + gdm[gm - 1];
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) { jy += div(days - 1, 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  // Standard Jalali conversion. The previous implementation omitted the
  // 1595 epoch offset, producing Gregorian years around 2452 and therefore
  // incorrect weekdays in the calendar.
  jy += 1595;
  let days =
    -355668 +
    365 * jy +
    div(jy, 33) * 8 +
    div((jy % 33) + 3, 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }

  const gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const md = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  let rem = gd;
  while (rem > md[gm - 1]) {
    rem -= md[gm - 1];
    gm++;
  }
  return [gy, gm, rem];
}

function jalaliDaysInMonth(year: number, month: number) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return [1,5,9,13,17,21,26,30].includes(year % 33) ? 30 : 29;
}

function todayJalali() {
  const d = new Date();
  return gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function JalaliDateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").map(Number) : null;
  const initial = parsed ? { y: parsed[0], m: parsed[1], d: parsed[2] } : (() => { const [y,m,d] = todayJalali(); return { y,m,d }; })();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(initial.y);
  const [month, setMonth] = useState(initial.m);
  const [selectedDay, setSelectedDay] = useState(initial.d);
  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y,m,d] = value.split("-").map(Number); setYear(y); setMonth(m); setSelectedDay(d);
    }
  }, [value]);
  const days = Array.from({length: jalaliDaysInMonth(year,month)}, (_,i) => i+1);
  const [gy,gm,gd] = jalaliToGregorian(year,month,1);
  // JS: Sunday=0 ... Saturday=6. Our Persian week starts Saturday.
  const first = (new Date(gy,gm-1,gd).getDay()+1)%7;
  function choose(day:number) {
    onChange(year+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0"));
    setSelectedDay(day); setOpen(false);
  }
  function move(delta:number) {
    let y=year,m=month+delta; if(m<1){m=12;y--;} if(m>12){m=1;y++;} setYear(y);setMonth(m);
  }
  return (
    <div className="relative">
      <span className="block text-sm font-semibold">{label}</span>
      <button type="button" className="form-input mt-2 flex items-center justify-between text-right !text-[#14213D]" onClick={() => setOpen(v=>!v)}>
        <span className={value ? "!text-[#14213D] font-semibold" : "!text-[#687382]"}>{value || "انتخاب تاریخ شمسی"}</span><span className="!text-[#A96800]">▾</span>
      </button>
      {open && <div className="internal-jalali-calendar absolute right-0 top-full z-50 mt-2 w-full min-w-[310px] rounded-2xl border border-[#D2C7B7] bg-[#FBF8F2] p-4 text-[#14213D] shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-label="ماه قبل" className="calendar-nav rounded-lg border border-[#C8BDAE] bg-[#EEE8DE] px-3 py-2 font-extrabold !text-[#14213D] hover:bg-[#E2D9CA]" onClick={()=>move(-1)}>‹</button>
          <div className="flex items-center gap-2">
            <select className="calendar-select rounded-lg border border-[#C8BDAE] bg-[#FFFDF8] px-2 py-2 text-sm font-bold !text-[#14213D]" value={month} onChange={e=>setMonth(Number(e.target.value))}>{JALALI_MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select>
            <select className="rounded-lg border border-[#14213D]/15 bg-white px-2 py-2 text-sm font-bold" value={year} onChange={e=>setYear(Number(e.target.value))}>{Array.from({length:21},(_,i)=>year-10+i).map(y=><option key={y} value={y}>{y}</option>)}</select>
          </div>
          <button type="button" aria-label="ماه بعد" className="calendar-nav rounded-lg border border-[#C8BDAE] bg-[#EEE8DE] px-3 py-2 font-extrabold !text-[#14213D] hover:bg-[#E2D9CA]" onClick={()=>move(1)}>›</button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold !text-[#596474]">{["ش","ی","د","س","چ","پ","ج"].map(d=><span key={d} className="py-1">{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">{Array.from({length:first},(_,i)=><span key={"p"+i}/>)}{days.map(day=><button key={day} type="button" onClick={()=>choose(day)} className={selectedDay===day ? "rounded-lg bg-[#F2A900] py-2 text-sm font-extrabold text-[#14213D]" : "rounded-lg py-2 text-sm hover:bg-[#FFF3CC]"}>{day}</button>)}</div>
        <div className="mt-3 flex justify-between border-t border-[#14213D]/10 pt-3">
          <button type="button" className="text-xs font-bold text-[#D9622B]" onClick={()=>{onChange("");setOpen(false)}}>پاک کردن</button>
          <button type="button" className="text-xs font-bold text-[#2D6A4F]" onClick={()=>{const [y,m,d]=todayJalali();setYear(y);setMonth(m);choose(d)}}>امروز</button>
        </div>
      </div>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        className="form-input mt-2"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <select className="form-input mt-2" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <textarea className="form-input mt-2 min-h-28 resize-y" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#F4EEE4] p-4">
      <p className="text-xs !text-[#3F4B5A]">{label}</p>
      <strong className="mt-2 block text-lg">{value}</strong>
    </div>
  );
}
