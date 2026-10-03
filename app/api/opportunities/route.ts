import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import {
  createOpportunity,
  readOpportunities,
  updateOpportunity,
  type Opportunity,
} from "@/lib/opportunities-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unitRoles = ["csr","media","artists","education","members","economic","finance"] as const;

const managementRoles = [
  "finance",
  "ceo",
  "deputy",
  "economic",
  "csr",
  "media",
  "artists",
  "education",
  "members",
] as const;

function today() {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replaceAll("/", "-");
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function currentUser() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(COOKIE_NAME)?.value);
}

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  }

  const all = readOpportunities();

  if (user.role === "beneficiary") {
    return NextResponse.json({
      items: all.filter((item) => item.creator === user.username),
    });
  }

  if (!managementRoles.includes(user.role as (typeof managementRoles)[number])) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 403 });
  }

  if (user.role === "finance") {
    return NextResponse.json({ items: all.filter((item) => (item.team || []).includes(user.role) || item.status === "قرارداد تنظیم شد" || item.status === "ثبت پروژه") });
  }

  if (unitRoles.includes(user.role as (typeof unitRoles)[number])) {
    return NextResponse.json({ items: all.filter((item) => (item.team || []).includes(user.role)) });
  }

  return NextResponse.json({ items: all });
}

export async function POST(request: Request) {
  const user = await currentUser();
  const proposalRoles = ["beneficiary","finance","ceo","deputy","economic","csr","media","artists","education","members"] as const;
  if (!user || !proposalRoles.includes(user.role as (typeof proposalRoles)[number])) {
    return NextResponse.json({ error: "این نقش امکان ثبت پیشنهاد اولیه ندارد." }, { status: 403 });
  }

  const body = await request.json();

  if (!String(body.title || "").trim() || !String(body.description || "").trim()) {
    return NextResponse.json(
      { error: "عنوان پیشنهاد و شرح کوتاه الزامی است." },
      { status: 400 }
    );
  }

  const proposal: Opportunity = {
    id: uid(),
    code: `OP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    type: body.type || "پروژه",
    title: String(body.title).trim(),
    clientName: String(body.clientName || "").trim(),
    clientContact: String(body.clientContact || "").trim(),
    description: String(body.description).trim(),
    expectedValue: Number(body.expectedValue) || 0,
    creator: user.username,
    creatorName: user.name,
    createdAt: today(),
    status: user.role === "deputy" ? "ارسال به مدیرعامل" : "در حال بررسی قائم‌مقام",
    assignedTo: user.role === "deputy" ? "ceo" : "deputy",
    assignedToName: user.role === "deputy" ? "مدیرعامل" : "قائم‌مقام",
    specialistBrief: "",
    proposalDetails: "",
    negotiationNote: "",
    contractNo: "",
    contractValue: 0,
    contractDate: "",
    financeNote: "",
    directCost: 0,
    rewardBase: 0,
    history: [
      {
        id: uid(),
        date: today(),
        actor: user.name,
        action: "ثبت پیشنهاد اولیه",
        note: user.role === "deputy" ? "پیشنهاد توسط قائم‌مقام ثبت و برای تصمیم مدیرعامل ارسال شد." : "پیشنهاد برای بررسی قائم‌مقام ارسال شد.",
      },
    ],
  };

  return NextResponse.json({ item: createOpportunity(proposal) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || user.role === "beneficiary") {
    return NextResponse.json({ error: "دسترسی مدیریتی لازم است." }, { status: 403 });
  }

  const body = await request.json();
  const id = String(body.id || "");
  const patch = (body.patch || {}) as Partial<Opportunity>;
  const action = String(body.action || "به‌روزرسانی پرونده");
  const note = String(body.note || "");

  if (!id) {
    return NextResponse.json({ error: "شناسه پرونده ارسال نشده است." }, { status: 400 });
  }

  const existing = readOpportunities().find((item) => item.id === id);
  if (!existing) {
    return NextResponse.json({ error: "پرونده پیدا نشد." }, { status: 404 });
  }

  const patchKeys = Object.keys(patch);

  // هر نقش فقط فیلدهایی را تغییر می‌دهد که متعلق به مرحله کاری خودش است.
  // این کنترل سمت سرور است تا حتی با دستکاری رابط کاربری، دسترسی‌ها دور زده نشوند.
  const keySet = (keys: string[]) => patchKeys.every((key) => keys.includes(key));

  const teamOnlyPatch = keySet(["team","assignedTo","assignedToName","unitNote"]);

  const ceoInitialApproval =
    user.role === "ceo" &&
    body.action === "تأیید مرحله اول و تشکیل تیم" &&
    patch.status === "تشکیل تیم پروژه";

  const ceoFinalApproval =
    user.role === "ceo" &&
    body.action === "تأیید نهایی" &&
    patch.status === "تأیید نهایی مدیرعامل";

  const ceoContractRegistration =
    user.role === "ceo" &&
    body.action === "ثبت تنظیم و امضای قرارداد" &&
    patch.status === "قرارداد تنظیم شد";

  const deputyTransition =
    user.role === "deputy" &&
    typeof patch.status === "string";

  const economicOrSpecialistPatch =
    ["economic","csr","media","artists","education","members"].includes(user.role) &&
    typeof patch.status === "string";

  const financeRegistration =
    user.role === "finance" &&
    patch.status === "ثبت پروژه";

  if (user.role === "ceo") {
    const allowed = teamOnlyPatch || ceoInitialApproval || ceoFinalApproval || ceoContractRegistration ||
      (body.action === "رد مرحله اول" && patch.status === "رد توسط مدیرعامل در مرحله اول") ||
      (body.action === "رد نهایی" && patch.status === "رد نهایی مدیرعامل");
    if (ceoInitialApproval && (!(Array.isArray(patch.team)) || patch.team.length === 0)) {
      return NextResponse.json({ error: "برای تأیید مرحله اول، حداقل یک عضو تیم پروژه باید انتخاب شود." }, { status: 400 });
    }

    if (!allowed) {
      return NextResponse.json({ error: "مدیرعامل فقط در محدوده اختیارات تعریف‌شده پرونده را می‌تواند تغییر دهد." }, { status: 403 });
    }
  } else if (user.role === "deputy" && deputyTransition) {
    const from = String(existing.status || "");
    const to = String(patch.status || "");
    const allowedKeys =
      (from === "در حال بررسی قائم‌مقام" && to === "ارسال به مدیرعامل") ? ["status"] :
      (from === "در حال تدوین طرح و پروپوزال" && to === "قیمت‌گذاری و بررسی مالی") ? ["status","specialistBrief","unitNote","proposalDetails","estimatedCost","proposedPrice"] :
      (from === "قیمت‌گذاری و بررسی مالی" && to === "مذاکرات اولیه") ? ["status","proposalDetails","estimatedCost","proposedPrice","unitNote","negotiationNote"] :
      (from === "مذاکرات اولیه" && to === "ارسال طرح نهایی به مدیرعامل") ? ["status","proposalDetails","negotiationNote","estimatedCost","proposedPrice"] :
      (from === "تأیید نهایی مدیرعامل" && to === "قرارداد تنظیم شد") ? ["status","contractNo","contractValue"] :
      (from === "تشکیل تیم پروژه" && to === "در حال تدوین طرح و پروپوزال") ? ["status","unitNote"] :
      (body.action === "درخواست تکمیل" && to === "نیازمند تکمیل") ? ["status"] :
      (body.action === "رد پیشنهاد" && to === "رد توسط قائم‌مقام") ? ["status"] :
      [];
    if (!allowedKeys.length || !keySet(allowedKeys)) {
      return NextResponse.json({ error: "این تغییر خارج از اختیارات قائم‌مقام در این مرحله است." }, { status: 403 });
    }
  } else if (economicOrSpecialistPatch) {
    const allowedKeys =
      user.role === "economic"
        ? ["status","proposalDetails","negotiationNote","estimatedCost","proposedPrice","unitNote"]
        : ["status","specialistBrief","proposalDetails","unitNote"];
    if (!keySet(allowedKeys)) {
      return NextResponse.json({ error: "این تغییر خارج از محدوده مأموریت واحد شماست." }, { status: 403 });
    }
  } else if (financeRegistration) {
    if (!keySet(["status","contractNo","contractValue","financeNote","directCost","rewardBase"])) {
      return NextResponse.json({ error: "این تغییر خارج از محدوده مالی پرونده است." }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "شما مجاز به ویرایش این بخش از پرونده نیستید." }, { status: 403 });
  }
  if (teamOnlyPatch && user.role === "ceo") {
    if (existing.status === "ثبت پروژه") {
      return NextResponse.json({ error: "پس از ثبت نهایی پرونده، تغییر اعضای تیم مجاز نیست." }, { status: 403 });
    }
    const updated = updateOpportunity(id, {
      team: patch.team,
      assignedTo: patch.assignedTo,
      assignedToName: patch.assignedToName,
      unitNote: patch.unitNote,
      history: [
        ...(existing.history || []),
        { id: uid(), date: today(), actor: user.name, action, note: note || "اعضای تیم پروژه توسط مدیرعامل اصلاح شد." },
      ],
    });
    return NextResponse.json({ item: updated });
  }

  if (unitRoles.includes(user.role as (typeof unitRoles)[number]) && !(existing.team || []).includes(user.role)) {
    return NextResponse.json({ error: "این پرونده به واحد شما ارجاع نشده است." }, { status: 403 });
  }

  if (patch.status && patch.status !== existing.status) {
    const nextStatus = String(patch.status).trim();
    const fromStatus = String(existing.status || "").trim();

    const allowed =
      (user.role === "deputy" && (
        (fromStatus === "در حال بررسی قائم‌مقام" && nextStatus === "ارسال به مدیرعامل") ||
        (fromStatus === "تشکیل تیم پروژه" && nextStatus === "در حال تدوین طرح و پروپوزال") ||
        (fromStatus === "در حال تدوین طرح و پروپوزال" && nextStatus === "قیمت‌گذاری و بررسی مالی") ||
        (fromStatus === "قیمت‌گذاری و بررسی مالی" && nextStatus === "مذاکرات اولیه") ||
        (fromStatus === "مذاکرات اولیه" && nextStatus === "ارسال طرح نهایی به مدیرعامل") ||
        (fromStatus === "تأیید نهایی مدیرعامل" && nextStatus === "قرارداد تنظیم شد") ||
        (body.action === "درخواست تکمیل" && fromStatus === "در حال بررسی قائم‌مقام" && nextStatus === "نیازمند تکمیل") ||
        (body.action === "رد پیشنهاد" && fromStatus === "در حال بررسی قائم‌مقام" && nextStatus === "رد توسط قائم‌مقام")
      )) ||
      ceoInitialApproval ||
      (user.role === "ceo" && (
        (fromStatus === "ارسال طرح نهایی به مدیرعامل" && nextStatus === "تأیید نهایی مدیرعامل") ||
        (fromStatus === "تأیید نهایی مدیرعامل" && nextStatus === "قرارداد تنظیم شد")
      )) ||
      (user.role === "finance" && fromStatus === "قرارداد تنظیم شد" && nextStatus === "ثبت پروژه");

    if (!allowed) {
      return NextResponse.json({
        error: "تغییر این مرحله برای نقش شما مجاز نیست.",
        currentStatus: fromStatus,
        requestedStatus: nextStatus,
        role: user.role,
      }, { status: 403 });
    }
  }

  const history = [
    ...(existing.history || []),
    {
      id: uid(),
      date: today(),
      actor: user.name,
      action,
      note,
    },
  ];

  try {
    const updated = updateOpportunity(id, {
      ...patch,
      history,
    });
    if (!updated) {
      return NextResponse.json({ error: "ذخیره پرونده انجام نشد." }, { status: 500 });
    }
    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("PATCH /api/opportunities failed:", error);
    return NextResponse.json(
      { error: "ذخیره پرونده انجام نشد. سرور نتوانست اطلاعات را در محل ذخیره‌سازی ثبت کند." },
      { status: 500 }
    );
  }
}
