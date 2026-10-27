import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { deleteCollection, getStored, listStored, putStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionUser = { username: string; name: string; role: string };
const projectRoles = ["finance", "ceo", "deputy", "economic", "csr", "media", "artists", "education", "members", "beneficiary"];

async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return decodeSession(store.get(COOKIE_NAME)?.value) as SessionUser | null;
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function changedKeys(existing: Record<string, unknown>, next: Record<string, unknown>) {
  return Object.keys(next).filter((key) => JSON.stringify(existing[key]) !== JSON.stringify(next[key]));
}

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("برای ادامه وارد سامانه شوید.", 401);
  if (!projectRoles.includes(user.role)) return fail("دسترسی به اطلاعات پروژه‌ها مجاز نیست.", 403);

  try {
    const [projects, proposals] = await Promise.all([
      listStored<Record<string, unknown>>("projects"),
      listStored<Record<string, unknown>>("project-proposals"),
    ]);
    const fullAccess = ["finance", "ceo", "deputy"].includes(user.role);
    const assignedProject = (item: Record<string, unknown>) => {
      const team = Array.isArray(item.team) ? item.team.map(String) : [];
      const people = Array.isArray(item.people) ? item.people as Array<Record<string, unknown>> : [];
      return item.creator === user.username
        || item.assignedTo === user.role
        || team.includes(user.role)
        || people.some((person) => person.name === user.name);
    };
    const assignedProposal = (item: Record<string, unknown>) => {
      const team = Array.isArray(item.team) ? item.team.map(String) : [];
      return item.creator === user.username || item.assignedTo === user.role || team.includes(user.role);
    };
    const redactProjectFinance = (item: Record<string, unknown>) => ({
      ...item,
      clientContact: "",
      contractNo: "",
      contractDate: "",
      contractValue: 0,
      paymentTerms: "",
      revenue: 0,
      directCosts: 0,
      overheadCosts: 0,
      tax: 0,
      otherCosts: 0,
      costs: 0,
      received: 0,
      rewardRate: 0,
      financialTransactions: [],
      collectionStages: [],
      financeNote: "",
      lastFinancialReview: "",
      paymentReceiptNo: "",
      rewardBase: 0,
      settlementDate: "",
      settlementNote: "",
      people: Array.isArray(item.people)
        ? (item.people as Array<Record<string, unknown>>).map((person) => ({
            id: person.id,
            name: person.name,
            role: person.role,
            relationship: person.relationship,
            roleApprovalStatus: person.roleApprovalStatus,
            roleBaseWeight: 0,
            rolePercent: 0,
            weight: 0,
            notes: "",
          }))
        : [],
    });
    const redactProposalFinance = (item: Record<string, unknown>, forBeneficiary = false) => ({
      ...item,
      ...(forBeneficiary ? { negotiationNote: "", proposalDetails: "" } : {}),
      contractNo: "",
      contractValue: 0,
      contractDate: "",
      financeNote: "",
      history: Array.isArray(item.history)
        ? item.history.map((entry: Record<string, unknown>) => ({
            ...entry,
            actor: forBeneficiary ? "سامانه" : entry.actor,
            note: forBeneficiary && !["درخواست تکمیل", "رد پیشنهاد"].includes(String(entry.action || "")) ? "" : entry.note,
          }))
        : [],
    });

    return NextResponse.json({
      projects: fullAccess
        ? projects
        : user.role === "beneficiary"
          ? []
          : projects.filter(assignedProject).map(redactProjectFinance),
      proposals: fullAccess
        ? proposals
        : user.role === "beneficiary"
          ? proposals.filter((item) => item.creator === user.username).map((item) => redactProposalFinance(item, true))
          : proposals.filter(assignedProposal).map((item) => redactProposalFinance(item)),
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("GET /api/project-rewards failed", error);
    return fail(error instanceof Error ? error.message : "خواندن اطلاعات انجام نشد.", 503);
  }
}

export async function PUT(request: NextRequest) {
  const user = await currentUser();
  if (!user) return fail("برای ادامه وارد سامانه شوید.", 401);
  if (!projectRoles.includes(user.role)) return fail("دسترسی مجاز نیست.", 403);

  try {
    const body = await request.json();
    const kind = body.kind === "project" || body.kind === "proposal" ? body.kind : null;
    const item = body.item as Record<string, unknown> | undefined;
    if (!kind || !item || typeof item.id !== "string" || !item.id) {
      return fail("نوع پرونده یا شناسه آن معتبر نیست.", 400);
    }

    const collection = kind === "project" ? "projects" : "project-proposals";
    const existing = await getStored<Record<string, unknown>>(collection, item.id);

    if (kind === "project") {
      if (user.role === "beneficiary") return fail("دسترسی به پروژه‌ها مجاز نیست.", 403);
      if (!existing && user.role !== "finance") return fail("ایجاد پروژه فقط در اختیار واحد مالی است.", 403);
      if (existing && user.role !== "finance") {
        if (user.role !== "ceo") return fail("ویرایش پروژه برای نقش شما مجاز نیست.", 403);
        const allowed = ["people", "approvalStatus", "approvedBy", "approvedAt", "status"];
        const changes = changedKeys(existing, item);
        if (changes.some((key) => !allowed.includes(key))) {
          return fail("مدیرعامل فقط می‌تواند ترکیب تیم و وضعیت تأیید پروژه را تغییر دهد.", 403);
        }
      }
      return NextResponse.json({ item: await putStored(collection, item as Record<string, unknown> & { id: string }) });
    }

    if (!existing) {
      if (user.role !== "beneficiary") return fail("پیشنهاد جدید فقط از مسیر حساب ذی‌نفع ثبت می‌شود؛ کارکنان باید از گردش فرصت‌ها استفاده کنند.", 403);
      const title = String(item.title || "").trim().slice(0, 160);
      const description = String(item.description || "").trim().slice(0, 3000);
      if (!title || !description) return fail("عنوان و شرح پیشنهاد الزامی است.", 400);
      const createdAt = today();
      const newItem: Record<string, unknown> & { id: string } = {
        ...item,
        id: item.id,
        title,
        description,
        creator: user.username,
        creatorName: user.name,
        createdAt,
        status: "در حال بررسی قائم‌مقام",
        assignedTo: "deputy",
        assignedToName: "قائم‌مقام",
        contractNo: "",
        contractValue: 0,
        contractDate: "",
        financeNote: "",
        specialistBrief: "",
        proposalDetails: "",
        negotiationNote: "",
        history: [{ id: randomUUID(), date: createdAt, actor: user.name, action: "ثبت پیشنهاد اولیه", note: "" }],
      };
      return NextResponse.json({ item: await putStored(collection, newItem as Record<string, unknown> & { id: string }) }, { status: 201 });
    }

    if (user.role === "beneficiary") return fail("پس از ثبت، ویرایش پیشنهاد باید از مسیر گردش کار انجام شود.", 403);
    const allowedByRole: Record<string, string[]> = {
      deputy: ["status", "assignedTo", "assignedToName", "specialistBrief", "proposalDetails", "negotiationNote", "contractNo", "contractValue", "contractDate", "financeNote"],
      ceo: ["status", "assignedTo", "assignedToName", "proposalDetails", "negotiationNote", "contractNo", "contractValue", "contractDate", "financeNote"],
      finance: ["status", "contractNo", "contractValue", "contractDate", "financeNote"],
    };
    const changes = changedKeys(existing, item);
    const changesWithoutHistory = changes.filter((key) => key !== "history");
    const allowed = allowedByRole[user.role] || [];
    if (!changesWithoutHistory.length) return fail("هیچ تغییر معتبری برای ثبت ارسال نشده است.", 400);
    if (changesWithoutHistory.some((key) => item[key] === undefined)) return fail("برای تغییر فیلدها، مقدار معتبر ارسال کنید.", 400);
    if (changesWithoutHistory.includes("status") && typeof item.status !== "string") return fail("وضعیت جدید معتبر نیست.", 400);
    if (changesWithoutHistory.some((key) => !allowed.includes(key))) {
      return fail("تغییرات ارسالی خارج از محدوده دسترسی این نقش است.", 403);
    }

    if (typeof item.status === "string" && item.status !== existing.status) {
      const from = String(existing.status || "");
      const to = item.status;
      const deputyTransitions: Record<string, string[]> = {
        "ثبت اولیه": ["در حال بررسی قائم‌مقام", "نیازمند تکمیل", "رد شده"],
        "در حال بررسی قائم‌مقام": ["تأیید اولیه", "نیازمند تکمیل", "رد شده"],
        "نیازمند تکمیل": ["تأیید اولیه", "رد شده"],
        "تأیید اولیه": ["در حال تدوین پروپوزال"],
        "در حال تدوین پروپوزال": ["بازگشت به قائم‌مقام"],
        "بازگشت به قائم‌مقام": ["آماده مذاکره"],
        "آماده مذاکره": ["در حال مذاکره", "قرارداد در حال تنظیم", "ارجاع به مالی", "رد شده", "متوقف شده"],
        "در حال مذاکره": ["قرارداد در حال تنظیم", "ارجاع به مالی", "رد شده", "متوقف شده"],
        "قرارداد در حال تنظیم": ["ارجاع به مالی", "متوقف شده"],
      };
      const allowedTransition = user.role === "deputy"
        ? (deputyTransitions[from] || []).includes(to)
        : user.role === "finance"
          ? from === "ارجاع به مالی" && to === "ثبت‌شده"
          : user.role === "ceo"
            ? ["رد شده", "متوقف شده"].includes(to) && !["ثبت‌شده", "رد شده", "متوقف شده"].includes(from)
            : false;
      if (!allowedTransition) return fail("تغییر وضعیت با گردش‌کار و اختیارات نقش شما سازگار نیست.", 403);
    }

    const incomingHistory = Array.isArray(item.history) ? item.history as Array<Record<string, unknown>> : [];
    const priorHistory = Array.isArray(existing.history) ? existing.history as Array<Record<string, unknown>> : [];
    const candidate = incomingHistory.length > priorHistory.length ? incomingHistory[incomingHistory.length - 1] : undefined;
    const auditNote = typeof candidate?.note === "string" ? candidate.note.trim().slice(0, 2000) : "";
    const actionLabel = existing.status !== item.status
      ? `تغییر وضعیت از «${String(existing.status || "")}» به «${String(item.status || "")}»`
      : "به‌روزرسانی اطلاعات پیشنهاد";
    const nextItem = {
      ...existing,
      ...item,
      history: [...priorHistory, { id: randomUUID(), date: today(), actor: user.name, action: actionLabel, note: auditNote }],
    };
    return NextResponse.json({ item: await putStored(collection, nextItem as Record<string, unknown> & { id: string }) });
  } catch (error) {
    console.error("PUT /api/project-rewards failed", error);
    return fail(error instanceof Error ? error.message : "ذخیره اطلاعات انجام نشد.", 503);
  }
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser();
  if (!user) return fail("برای ادامه وارد سامانه شوید.", 401);
  if (user.role !== "finance") return fail("پاک‌سازی پرونده‌های پروژه فقط در اختیار واحد مالی است.", 403);
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind !== "projects") return fail("درخواست حذف معتبر نیست.", 400);
  try {
    const body = await request.json().catch(() => ({})) as { confirmation?: unknown };
    if (body.confirmation !== "حذف همه پروژه‌ها") {
      return fail("برای حذف گروهی، تأیید صریح و معتبر الزامی است.", 400);
    }
    const count = (await listStored<Record<string, unknown>>("projects")).length;
    const operationId = randomUUID();
    await putStored("project-rewards-audit", {
      id: operationId,
      kind: "bulk-delete-projects",
      status: "started",
      actor: user.username,
      count,
      at: new Date().toISOString(),
    });
    await deleteCollection("projects");
    await putStored("project-rewards-audit", {
      id: operationId + "-completed",
      kind: "bulk-delete-projects",
      status: "completed",
      actor: user.username,
      count,
      at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, deletedCount: count });
  } catch (error) {
    console.error("DELETE /api/project-rewards failed", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
    return fail("حذف گروهی پروژه‌ها انجام نشد.", 503);
  }
}
