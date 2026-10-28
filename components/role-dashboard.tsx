"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/auth";
import { dashboardPathForRole } from "@/lib/dashboard-path";

type ManagementRole = Exclude<UserRole, "beneficiary" | "member" | "owner">;
type Opportunity = {
  id: string;
  code?: string;
  title?: string;
  clientName?: string;
  type?: string;
  subjectArea?: string;
  status?: string;
  createdAt?: string;
  assignedToName?: string;
  creatorName?: string;
  expectedValue?: number;
  proposedPrice?: number;
  contractValue?: number;
  team?: string[];
};

type ClubSummary = {
  totals: { members: number; activeMembers: number; clubs: number; activeClubs: number };
  clubs: Array<{ id: string; name: string; status: string; source: string; memberCount: number; activeMemberCount: number }>;
  upcomingPrograms: Array<{ id: string; title: string; dateLabel: string; isoDate: string; clubNames: string[]; href: string; description: string }>;
  feedAvailable: boolean;
};

type MembershipOverview = {
  members: Array<{ id: string; fullName?: string; status?: string; clubIds?: string[] }>;
  clubs: Array<{ id: string; name: string; status?: string }>;
  requests: Array<{ id: string; name?: string; reviewStatus?: string; status?: string; createdAt?: string }>;
  upgrades: Array<{ id: string; target?: string; status?: string; assignedRole?: string; member?: { fullName?: string } }>;
};
type Action = { label: string; description: string; href: string; primary?: boolean };
type DashboardConfig = {
  title: string;
  subtitle: string;
  welcome: string;
  priorities: string[];
  actions: Action[];
  attentionStatuses: string[];
  progressStatuses: string[];
  completedStatuses: string[];
  emptyTitle: string;
  emptyDescription: string;
};

const CONFIG: Record<ManagementRole, DashboardConfig> = {
  ceo: {
    title: "داشبورد مدیرعامل",
    subtitle: "تصمیم‌های کلیدی، تأییدهای نهایی و تصویر کلان عملکرد سازمان",
    welcome: "تمرکز امروز: تصمیم‌گیری درباره پرونده‌های ارجاع‌شده، تعیین مسیر اجرا و رفع موانع مهم سازمان.",
    priorities: ["بررسی پیشنهادهای ارسال‌شده برای تصمیم مدیرعامل", "تصمیم درباره طرح‌های نهایی و قراردادها", "بازبینی وضعیت پرونده‌ها و مسئولیت تیم‌ها"],
    actions: [
      { label: "کارتابل تصمیم‌گیری", description: "مشاهده پرونده‌ها و اقدامات مدیریتی", href: "/internal/opportunities", primary: true },
      { label: "ثبت پیشنهاد یا فرصت جدید", description: "ثبت فرصت همکاری، پروژه یا حامی جدید", href: "/internal/submit-proposal" },
      { label: "سامانه پرونده‌ها و پاداش", description: "مشاهده اطلاعات پروژه و پاداش‌های ثبت‌شده", href: "/internal/project-rewards" },
      { label: "کارتابل محتوای تأییدشده", description: "دریافت محتوای ارجاع‌شده از معاون رسانه و ثبت نتیجه بارگذاری در سایت", href: "/internal/content-review", primary: true },
    ],
    attentionStatuses: ["ارسال به مدیرعامل", "ارسال طرح نهایی به مدیرعامل", "تأیید نهایی مدیرعامل", "قرارداد تنظیم شد"],
    progressStatuses: ["تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "قیمت‌گذاری و بررسی مالی", "مذاکرات اولیه"],
    completedStatuses: ["قرارداد تنظیم شد", "ثبت پروژه"],
    emptyTitle: "پرونده‌ای برای تصمیم‌گیری ثبت نشده است",
    emptyDescription: "پیشنهادهای جدید پس از ثبت و طی مراحل بررسی در این کارتابل ظاهر می‌شوند.",
  },
  deputy: {
    title: "داشبورد قائم‌مقام و معاون راهبرد اجرایی",
    subtitle: "هدایت گردش کار، اولویت‌بندی فرصت‌ها و پیگیری اجرای تصمیم‌ها",
    welcome: "تمرکز امروز: غربال پیشنهادهای تازه، تکمیل اطلاعات ناقص و ارجاع پرونده‌های آماده به مدیرعامل.",
    priorities: ["بررسی اولیه پیشنهادهای تازه و تعیین اولویت", "بازگرداندن پرونده‌های ناقص برای تکمیل اطلاعات", "پیگیری پرونده‌های در گردش و هماهنگی واحدها"],
    actions: [
      { label: "کارتابل و گردش کار", description: "بررسی، تکمیل و ارجاع پرونده‌ها", href: "/internal/opportunities", primary: true },
      { label: "ثبت فرصت جدید", description: "ثبت فرصت‌های راهبردی و همکاری", href: "/internal/submit-proposal" },
    ],
    attentionStatuses: ["در حال بررسی قائم‌مقام", "نیازمند تکمیل"],
    progressStatuses: ["ارسال به مدیرعامل", "تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "مذاکرات اولیه"],
    completedStatuses: ["قرارداد تنظیم شد", "ثبت پروژه"],
    emptyTitle: "کارتابل فعلاً خالی است",
    emptyDescription: "پیشنهادهای جدید برای بررسی اولیه در این بخش نمایش داده می‌شوند.",
  },
  finance: {
    title: "داشبورد معاونت مالی و اداری",
    subtitle: "قراردادها، ثبت مالی پروژه‌ها و پیگیری وضعیت وصول و هزینه",
    welcome: "تمرکز امروز: بررسی پرونده‌های آماده ثبت، کنترل اطلاعات مالی و پیگیری موارد نیازمند اقدام مالی.",
    priorities: ["بررسی پرونده‌های ارجاع‌شده به مالی", "کنترل مبلغ قرارداد و اطلاعات ثبت پروژه", "پیگیری ثبت‌ها و موارد مالی ناقص"],
    actions: [
      { label: "کارتابل درخواست‌های حمایت مالی و اسپانسرینگ", description: "دریافت، بررسی، پیگیری و پاک‌سازی کنترل‌شده درخواست‌های بسته‌شده", href: "/internal/requests", primary: true },
      { label: "مدیریت پروژه‌ها و پاداش", description: "ورود به پرونده‌های مالی و اطلاعات پروژه", href: "/internal/project-rewards", primary: true },
      { label: "پرونده‌های ارجاع‌شده", description: "بررسی گردش کار و وضعیت قراردادها", href: "/internal/opportunities" },
    ],
    attentionStatuses: ["قرارداد تنظیم شد", "ارجاع به مالی", "تأیید نهایی مدیرعامل"],
    progressStatuses: ["قیمت‌گذاری و بررسی مالی", "مذاکرات اولیه"],
    completedStatuses: ["ثبت پروژه", "ثبت‌شده"],
    emptyTitle: "پرونده مالی نیازمند اقدام پیدا نشد",
    emptyDescription: "پرونده‌های مرتبط با ثبت پروژه و مرحله مالی، پس از ارجاع در اینجا نمایش داده می‌شوند.",
  },
  economic: {
    title: "داشبورد توسعه مشارکت‌های اقتصادی",
    subtitle: "فرصت‌های همکاری، برندها، حامیان و مشارکت‌های راهبردی",
    welcome: "تمرکز امروز: پیگیری فرصت‌های همکاری، ثبت اطلاعات مذاکره و تبدیل ظرفیت شرکا به پروژه‌های قابل اجرا.",
    priorities: ["پیگیری فرصت‌ها و ارتباط با برندها و حامیان", "تکمیل اطلاعات مذاکره و ارزش پیشنهادی", "هماهنگی با واحدهای تخصصی برای تدوین طرح"],
    actions: [
      { label: "فرصت‌ها و پرونده‌های مشارکت", description: "پیگیری فرصت‌های ارجاع‌شده به واحد", href: "/internal/opportunities", primary: true },
      { label: "ثبت فرصت یا حامی جدید", description: "ثبت اطلاعات اولیه شریک یا فرصت همکاری", href: "/internal/submit-proposal" },
    ],
    attentionStatuses: ["ارجاع به واحد تخصصی", "تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "مذاکرات اولیه", "نیازمند تکمیل"],
    progressStatuses: ["قیمت‌گذاری و بررسی مالی", "ارسال طرح نهایی به مدیرعامل"],
    completedStatuses: ["قرارداد تنظیم شد", "ثبت پروژه"],
    emptyTitle: "فرصت مشارکتی ارجاع‌شده‌ای وجود ندارد",
    emptyDescription: "پرونده‌هایی که به واحد توسعه مشارکت‌های اقتصادی ارجاع شوند، اینجا نمایش داده می‌شوند.",
  },
  csr: {
    title: "داشبورد معاونت اجتماعی و حمایتی",
    subtitle: "طراحی و پیگیری پروژه‌های اجتماعی، حمایتی و مسئولیت اجتماعی",
    welcome: "تمرکز امروز: بررسی نیاز اجتماعی، طراحی مداخله قابل سنجش و هماهنگی منابع و شرکای اجرایی.",
    priorities: ["بررسی پرونده‌های اجتماعی ارجاع‌شده", "تعیین مسئله، گروه هدف و خروجی قابل سنجش", "هماهنگی با شرکا و تیم‌های اجرایی"],
    actions: [
      { label: "کارتابل درخواست‌های همکاری و پیشنهاد پروژه", description: "دریافت و مدیریت درخواست‌های همکاری و ایده‌های پروژه‌ای ارجاع‌شده به CSR", href: "/internal/requests", primary: true },
      { label: "پرونده‌های اجتماعی", description: "پیگیری پروژه‌های ارجاع‌شده به واحد", href: "/internal/opportunities", primary: true },
      { label: "کارتابل ارتقای متخصصان و مشاوران", description: "بررسی درخواست‌های تخصص و مشاوره و تأیید پروفایل", href: "/internal/member-upgrades", primary: true },
      { label: "بانک تخصص و مشاوران", description: "جست‌وجو در پروفایل متخصصان و مشاوران تأییدشده برای پروژه‌ها", href: "/internal/expertise-directory", primary: true },
      { label: "ثبت پیشنهاد اجتماعی", description: "ثبت نیاز یا ایده برای پروژه حمایتی", href: "/internal/submit-proposal" },
    ],
    attentionStatuses: ["ارجاع به واحد تخصصی", "تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "نیازمند تکمیل"],
    progressStatuses: ["قیمت‌گذاری و بررسی مالی", "مذاکرات اولیه", "ارسال طرح نهایی به مدیرعامل"],
    completedStatuses: ["قرارداد تنظیم شد", "ثبت پروژه"],
    emptyTitle: "پرونده اجتماعی ارجاع‌شده‌ای وجود ندارد",
    emptyDescription: "پروژه‌های اجتماعی و حمایتی پس از ارجاع به واحد در این بخش ظاهر می‌شوند.",
  },
  media: {
    title: "داشبورد رسانه، برند و بین‌الملل",
    subtitle: "مدیریت رسانه، برند، ارتباطات بین‌الملل و هماهنگی پروژه‌های محتوایی",
    welcome: "تمرکز امروز: تبدیل نیازهای سازمان و پروژه‌ها به خروجی رسانه‌ای روشن، دقیق و قابل انتشار.",
    priorities: ["پیگیری پروژه‌های رسانه‌ای ارجاع‌شده", "تعیین خروجی، قالب، زمان‌بندی و نیازهای تولید", "هماهنگی انتشار و مستندسازی نتایج"],
    actions: [
      { label: "کارتابل درخواست‌های تولید محتوا و رسانه", description: "دریافت، بررسی و پیگیری درخواست‌های رسانه‌ای ارسال‌شده از سایت", href: "/internal/requests", primary: true },
      { label: "پرونده‌های رسانه‌ای", description: "پیگیری پروژه‌های ارجاع‌شده به واحد", href: "/internal/opportunities", primary: true },
      { label: "کارتابل محتوای اعضا", description: "بررسی متن، تصویر و ویدیوی ارسالی و ارجاع محتوای تأییدشده به ادمین", href: "/internal/content-review", primary: true },
      { label: "ثبت پیشنهاد رسانه‌ای", description: "ثبت ایده تولید محتوا یا همکاری رسانه‌ای", href: "/internal/submit-proposal" },
    ],
    attentionStatuses: ["ارجاع به واحد تخصصی", "تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "نیازمند تکمیل"],
    progressStatuses: ["قیمت‌گذاری و بررسی مالی", "مذاکرات اولیه", "ارسال طرح نهایی به مدیرعامل"],
    completedStatuses: ["قرارداد تنظیم شد", "ثبت پروژه"],
    emptyTitle: "پرونده رسانه‌ای ارجاع‌شده‌ای وجود ندارد",
    emptyDescription: "پرونده‌های مرتبط با رسانه و محتوا پس از ارجاع به واحد در اینجا نمایش داده می‌شوند.",
  },
  artists: {
    title: "داشبورد معاونت هنری و امور هنرمندان",
    subtitle: "شبکه هنرمندان، ظرفیت‌های تخصصی و مشارکت در پروژه‌های هنری",
    welcome: "تمرکز امروز: شناسایی ظرفیت هنرمندان، تطبیق تخصص با نیاز پروژه و پیگیری مشارکت‌های حرفه‌ای.",
    priorities: ["پیگیری پرونده‌های هنری و هنرمندان مرتبط", "تطبیق تخصص و ظرفیت هنرمندان با نیاز پروژه", "هماهنگی مشارکت‌ها و ثبت ملاحظات اجرایی"],
    actions: [
      { label: "پرونده‌های هنری", description: "پیگیری پرونده‌های ارجاع‌شده به واحد", href: "/internal/opportunities", primary: true },
      { label: "کارتابل ارتقای هنرمندان", description: "بررسی درخواست‌های هنرمندی و تأیید پروفایل تخصصی", href: "/internal/member-upgrades", primary: true },
      { label: "ثبت پیشنهاد هنری", description: "ثبت ایده پروژه یا همکاری با هنرمندان", href: "/internal/submit-proposal" },
    ],
    attentionStatuses: ["ارجاع به واحد تخصصی", "تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "نیازمند تکمیل"],
    progressStatuses: ["قیمت‌گذاری و بررسی مالی", "مذاکرات اولیه", "ارسال طرح نهایی به مدیرعامل"],
    completedStatuses: ["قرارداد تنظیم شد", "ثبت پروژه"],
    emptyTitle: "پرونده هنری ارجاع‌شده‌ای وجود ندارد",
    emptyDescription: "پروژه‌هایی که به امور هنرمندان ارجاع شوند، در این بخش نمایش داده می‌شوند.",
  },
  education: {
    title: "داشبورد معاونت آموزش، پژوهش و نوآوری",
    subtitle: "برنامه‌های آموزشی، پژوهش‌های کاربردی و ایده‌های نوآورانه",
    welcome: "تمرکز امروز: طراحی برنامه‌های آموزشی و پژوهشی متناسب با مأموریت خورشید و تعریف خروجی قابل ارزیابی.",
    priorities: ["پیگیری برنامه‌های آموزشی و پژوهشی ارجاع‌شده", "تعیین مخاطب، محتوای آموزشی و شاخص نتیجه", "هماهنگی اجرا و مستندسازی آموخته‌ها"],
    actions: [
      { label: "پرونده‌های آموزشی و پژوهشی", description: "پیگیری پرونده‌های ارجاع‌شده به واحد", href: "/internal/opportunities", primary: true },
      { label: "ثبت پیشنهاد آموزشی", description: "ثبت ایده آموزشی، پژوهشی یا نوآورانه", href: "/internal/submit-proposal" },
    ],
    attentionStatuses: ["ارجاع به واحد تخصصی", "تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "نیازمند تکمیل"],
    progressStatuses: ["قیمت‌گذاری و بررسی مالی", "مذاکرات اولیه", "ارسال طرح نهایی به مدیرعامل"],
    completedStatuses: ["قرارداد تنظیم شد", "ثبت پروژه"],
    emptyTitle: "پرونده آموزشی یا پژوهشی ارجاع‌شده‌ای وجود ندارد",
    emptyDescription: "پرونده‌های مربوط به آموزش، پژوهش و نوآوری پس از ارجاع در اینجا ظاهر می‌شوند.",
  },
  members: {
    title: "داشبورد معاونت مفاخر، اعضا و باشگاه‌ها",
    subtitle: "مدیریت ارتباط با اعضا، مفاخر و باشگاه‌های تخصصی",
    welcome: "تمرکز امروز: پیگیری مشارکت اعضا، ارتباطات حرفه‌ای و آماده‌سازی فعالیت‌های باشگاه‌های تخصصی.",
    priorities: ["پیگیری پیشنهادها و پرونده‌های مرتبط با اعضا و مفاخر", "هماهنگی مشارکت اعضا در پروژه‌ها و برنامه‌ها", "آماده‌سازی اطلاعات موردنیاز برای مدیریت باشگاه‌ها"],
    actions: [
      { label: "مدیریت پرونده اعضا", description: "ثبت، جست‌وجو و به‌روزرسانی اطلاعات اعضا و مفاخر", href: "/internal/members", primary: true },
      { label: "کارتابل درخواست‌های ارتقای متخصصان", description: "بررسی رزومه، مدارک و سوابق متقاضیان عنوان متخصص", href: "/internal/member-upgrades", primary: true },
      { label: "کارتابل درخواست‌های عضویت", description: "بررسی مدارک، تعیین نوع عضویت، درخواست تکمیل و تأیید متقاضیان سایت", href: "/internal/membership-requests", primary: true },
      { label: "مدیریت باشگاه‌ها", description: "تعریف باشگاه‌ها و مشاهده اعضای مرتبط", href: "/internal/clubs" },
      { label: "پرونده‌های مرتبط با اعضا", description: "پیگیری پرونده‌های ارجاع‌شده به واحد", href: "/internal/opportunities" },
      { label: "ثبت پیشنهاد اعضا یا باشگاه", description: "ثبت ایده یا فرصت همکاری مرتبط با اعضا", href: "/internal/submit-proposal" },
    ],
    attentionStatuses: ["ارجاع به واحد تخصصی", "تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "نیازمند تکمیل"],
    progressStatuses: ["قیمت‌گذاری و بررسی مالی", "مذاکرات اولیه", "ارسال طرح نهایی به مدیرعامل"],
    completedStatuses: ["قرارداد تنظیم شد", "ثبت پروژه"],
    emptyTitle: "پرونده مرتبط با اعضا یا باشگاه‌ها وجود ندارد",
    emptyDescription: "پرونده‌های مرتبط با اعضا پس از ارجاع به واحد در اینجا نمایش داده می‌شوند.",
  },

};

const money = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.max(0, Math.round(value)));
const countByStatuses = (items: Opportunity[], statuses: string[]) => items.filter((item) => statuses.includes(item.status || "")).length;
const membershipStatusLabel = (status?: string) => ({
  pending: "در انتظار بررسی",
  submitted: "ثبت‌شده",
  in_review: "در حال بررسی",
  needs_revision: "نیازمند تکمیل مدارک",
  needs_info: "نیازمند تکمیل اطلاعات",
  approved: "تأیید شده",
  rejected: "رد شده",
}[String(status || "")] || "ثبت‌شده");

function StatusPill({ status }: { status: string }) {
  const isDone = ["ثبت پروژه", "ثبت‌شده", "قرارداد تنظیم شد"].includes(status);
  const isAttention = ["نیازمند تکمیل", "در حال بررسی قائم‌مقام", "ارسال به مدیرعامل", "ارسال طرح نهایی به مدیرعامل", "ارجاع به مالی"].includes(status);
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isDone ? "bg-emerald-50 text-emerald-800" : isAttention ? "bg-amber-50 text-amber-800" : "bg-[#EEECE6] text-[#172F48]"}`}>{status || "در جریان"}</span>;
}

export default function RoleDashboard({ role }: { role: ManagementRole }) {
  const router = useRouter();
  const config = CONFIG[role];
  const [items, setItems] = useState<Opportunity[]>([]);
  const [clubSummary, setClubSummary] = useState<ClubSummary | null>(null);
  const [clubSummaryExpanded, setClubSummaryExpanded] = useState(false);
  const [membershipOverview, setMembershipOverview] = useState<MembershipOverview | null>(null);
  const [upgradeItems, setUpgradeItems] = useState<MembershipOverview["upgrades"]>([]);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const authResponse = await fetch("/api/auth/me", { cache: "no-store" });
      if (!authResponse.ok) {
        router.replace("/login");
        return;
      }
      const authData = await authResponse.json();
      const currentRole = authData.user?.role as UserRole | undefined;
      if (!currentRole) {
        router.replace("/login");
        return;
      }
      if (currentRole === "beneficiary") {
        router.replace("/internal/my-reward");
        return;
      }
      if (currentRole === "member") {
        router.replace("/internal/member-home");
        return;
      }
      if (currentRole === "owner") {
        router.replace("/internal/owner");
        return;
      }
      if (currentRole !== role) {
        router.replace(dashboardPathForRole(currentRole));
        return;
      }
      setUserName(authData.user.name || config.title);

      const response = await fetch("/api/opportunities", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "دریافت اطلاعات داشبورد انجام نشد.");
      setItems(Array.isArray(data.items) ? data.items : []);
      if (role === "members") {
        try {
          const recordsResponse = await fetch("/api/records", { cache: "no-store" });
          const recordsData = await recordsResponse.json();
          const requestResponse = await fetch("/api/membership-requests", { cache: "no-store" });
          const requestData = await requestResponse.json();
          const upgradeResponse = await fetch("/api/member-upgrades", { cache: "no-store" });
          const upgradeData = await upgradeResponse.json();
          if (recordsResponse.ok) {
            setMembershipOverview({
              members: Array.isArray(recordsData.members) ? recordsData.members : [],
              clubs: Array.isArray(recordsData.clubs) ? recordsData.clubs : [],
              requests: requestResponse.ok && Array.isArray(requestData.items) ? requestData.items : [],
              upgrades: upgradeResponse.ok && Array.isArray(upgradeData.items) ? upgradeData.items : [],
            });
          } else setMembershipOverview(null);
        } catch { setMembershipOverview(null); }
      } else {
        setMembershipOverview(null);
      }
      if (["members", "artists", "csr"].includes(role)) {
        try {
          const upgradeResponse = await fetch("/api/member-upgrades", { cache: "no-store" });
          const upgradeData = await upgradeResponse.json();
          setUpgradeItems(upgradeResponse.ok && Array.isArray(upgradeData.items) ? upgradeData.items : []);
        } catch { setUpgradeItems([]); }
      } else setUpgradeItems([]);
      if (role === "ceo" || role === "deputy") {
        try {
          const summaryResponse = await fetch("/api/management/club-summary", { cache: "no-store" });
          const summaryData = await summaryResponse.json();
          if (summaryResponse.ok) setClubSummary(summaryData as ClubSummary);
          else setClubSummary(null);
        } catch {
          setClubSummary(null);
        }
      } else {
        setClubSummary(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ارتباط با سامانه برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }, [config.title, role, router]);

  useEffect(() => { void load(); }, [load]);

  const openItems = useMemo(
    () => items.filter((item) => !["رد توسط قائم‌مقام", "رد توسط مدیرعامل در مرحله اول", "رد نهایی مدیرعامل", "ثبت پروژه", "قرارداد تنظیم شد"].includes(item.status || "")),
    [items],
  );
  const openPipelineValue = useMemo(
    () => openItems.reduce((sum, item) => sum + Math.max(0, Number(item.proposedPrice || item.expectedValue || 0)), 0),
    [openItems],
  );
  const contractedValue = useMemo(
    () => items.filter((item) => ["قرارداد تنظیم شد", "ثبت پروژه"].includes(item.status || "")).reduce((sum, item) => sum + Math.max(0, Number(item.contractValue || 0)), 0),
    [items],
  );
  const metricCards = useMemo(() => {
    if (role === "members") {
      const members = membershipOverview?.members || [];
      const clubs = membershipOverview?.clubs || [];
      const requests = membershipOverview?.requests || [];
      const pendingRequests = requests.filter((item) => !["approved", "rejected"].includes(String(item.reviewStatus || item.status || "")));
      const pendingUpgrades = (membershipOverview?.upgrades || []).filter((item) => ["pending", "needs_info"].includes(String(item.status || "")));
      return [
        { label: "کل اعضا", value: money(members.length), hint: "پرونده‌های ثبت‌شده اعضا" },
        { label: "اعضای فعال", value: money(members.filter((item) => item.status === "active").length), hint: "عضویت فعال در سامانه" },
        { label: "باشگاه‌ها", value: money(clubs.filter((item) => item.status !== "closed").length), hint: "باشگاه‌های ثبت‌شده و قابل استفاده" },
        { label: "درخواست‌های عضویت در انتظار", value: money(pendingRequests.length), hint: "نیازمند بررسی، تعیین نوع یا تکمیل" },
        { label: "درخواست‌های ارتقا در جریان", value: money(pendingUpgrades.length), hint: "هنرمند، متخصص یا مشاور" },
      ];
    }
    if (role === "ceo") return [
      { label: "کل پرونده‌ها", value: money(items.length), hint: "کل سبد قابل مشاهده مدیرعامل" },
      { label: "در انتظار تصمیم", value: money(countByStatuses(items, ["ارسال به مدیرعامل", "ارسال طرح نهایی به مدیرعامل"])), hint: "تأیید اولیه یا تصمیم نهایی" },
      { label: "قرارداد در انتظار ثبت مالی", value: money(countByStatuses(items, ["قرارداد تنظیم شد"])), hint: "قرارداد ثبت شده، اطلاعات مالی نهایی نشده" },
      { label: "ارزش برآوردی فرصت‌های باز", value: money(openPipelineValue), hint: "ریال · قیمت پیشنهادی یا برآورد اولیه" },
    ];
    if (role === "deputy") return [
      { label: "کل پرونده‌ها", value: money(items.length), hint: "نمای کلی گردش کار" },
      { label: "در انتظار بررسی اولیه", value: money(countByStatuses(items, ["در حال بررسی قائم‌مقام"])), hint: "تصمیم: تکمیل، رد یا ارجاع" },
      { label: "نیازمند تکمیل", value: money(countByStatuses(items, ["نیازمند تکمیل"])), hint: "پرونده‌های برگشتی برای اصلاح" },
      { label: "در مسیر اجرا", value: money(countByStatuses(items, ["تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "قیمت‌گذاری و بررسی مالی", "مذاکرات اولیه"])), hint: "پیگیری گلوگاه‌ها و هماهنگی واحدها" },
    ];
    if (role === "economic") return [
      { label: "فرصت‌های ارجاع‌شده به واحد", value: money(items.length), hint: "فقط پرونده‌های تخصیص‌یافته به توسعه اقتصادی" },
      { label: "در حال تدوین یا قیمت‌گذاری", value: money(countByStatuses(items, ["تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "قیمت‌گذاری و بررسی مالی"])), hint: "تکمیل پیشنهاد ارزش و برآورد مالی" },
      { label: "در حال مذاکره", value: money(countByStatuses(items, ["مذاکرات اولیه"])), hint: "نیازمند ثبت نتیجه و گام بعدی" },
      { label: "ارزش برآوردی فرصت‌های باز", value: money(openPipelineValue), hint: "ریال · قیمت پیشنهادی یا برآورد اولیه" },
    ];
    if (role === "finance") return [
      { label: "پرونده‌های در دسترس مالی", value: money(items.length), hint: "پرونده‌های قرارداد و ثبت پروژه" },
      { label: "آماده ثبت پروژه", value: money(countByStatuses(items, ["قرارداد تنظیم شد"])), hint: "نیازمند تکمیل ثبت مالی" },
      { label: "پروژه‌های ثبت‌شده", value: money(countByStatuses(items, ["ثبت پروژه"])), hint: "پرونده‌های ثبت نهایی" },
      { label: "مبلغ قراردادها", value: money(contractedValue), hint: "ریال · مبلغ ثبت‌شده در پرونده" },
    ];
    if (role === "artists" || role === "csr") {
      const relevant = upgradeItems.filter((item) => role === "artists" ? item.assignedRole === "artists" || item.target === "artist" : item.assignedRole === "csr" || item.target === "expert" || item.target === "consultant");
      return [
        { label: "پرونده‌های ارجاع‌شده", value: money(items.length), hint: "پرونده‌های مرتبط با مأموریت واحد" },
        { label: "درخواست‌های تخصصی در انتظار", value: money(relevant.filter((item) => ["pending", "needs_info"].includes(String(item.status || ""))).length), hint: role === "artists" ? "درخواست شناسایی و تأیید هنرمندان" : "درخواست تخصص و مشاوره" },
        { label: "در حال پیگیری", value: money(countByStatuses(items, config.progressStatuses)), hint: "پرونده‌های فعال در مسیر اجرا" },
        { label: "نیازمند اقدام", value: money(countByStatuses(items, config.attentionStatuses)), hint: "کارهای اولویت‌دار واحد" },
      ];
    }
    const unitLabels = role === "media"
      ? { all: "پرونده‌های رسانه‌ای", attention: "خروجی‌های نیازمند اقدام", progress: "پروژه‌های در حال تولید", completed: "پروژه‌های نهایی‌شده" }
      : role === "education"
        ? { all: "پرونده‌های آموزشی و پژوهشی", attention: "برنامه‌های نیازمند اقدام", progress: "برنامه‌های در حال اجرا", completed: "برنامه‌های تکمیل‌شده" }
        : { all: "پرونده‌های در دسترس", attention: "نیازمند اقدام", progress: "در حال پیگیری", completed: "پرونده‌های نهایی‌شده" };
    return [
      { label: unitLabels.all, value: money(items.length), hint: "بر اساس پرونده‌های قابل مشاهده برای واحد" },
      { label: unitLabels.attention, value: money(countByStatuses(items, config.attentionStatuses)), hint: "طبق مرحله گردش کار این نقش" },
      { label: unitLabels.progress, value: money(countByStatuses(items, config.progressStatuses)), hint: "پرونده‌های فعال در مسیر اجرا" },
      { label: unitLabels.completed, value: money(countByStatuses(items, config.completedStatuses)), hint: "پرونده‌های تکمیل‌شده یا ثبت نهایی" },
    ];
  }, [role, items, config, openPipelineValue, contractedValue, membershipOverview, upgradeItems]);
  const reportRows = useMemo(() => {
    if (role === "members") {
      const requests = membershipOverview?.requests || [];
      const upgrades = membershipOverview?.upgrades || [];
      return [
        { label: "در انتظار بررسی درخواست عضویت", value: requests.filter((item) => ["pending", "in_review", "needs_revision"].includes(String(item.reviewStatus || item.status || ""))).length },
        { label: "درخواست‌های نیازمند تکمیل", value: requests.filter((item) => ["needs_revision", "needs_info"].includes(String(item.reviewStatus || item.status || ""))).length },
        { label: "درخواست‌های تأییدشده", value: requests.filter((item) => ["approved"].includes(String(item.reviewStatus || item.status || ""))).length },
        { label: "درخواست‌های ارتقای در انتظار بررسی", value: upgrades.filter((item) => ["pending", "needs_info"].includes(String(item.status || ""))).length },
        { label: "درخواست‌های ارتقای تأییدشده", value: upgrades.filter((item) => item.status === "approved").length },
      ];
    }
    if (role === "ceo") return [
      { label: "منتظر تصمیم اولیه مدیرعامل", value: countByStatuses(items, ["ارسال به مدیرعامل"]) },
      { label: "منتظر تأیید نهایی", value: countByStatuses(items, ["ارسال طرح نهایی به مدیرعامل"]) },
      { label: "تأییدشده، در انتظار قرارداد", value: countByStatuses(items, ["تأیید نهایی مدیرعامل"]) },
      { label: "قرارداد در انتظار تکمیل مالی", value: countByStatuses(items, ["قرارداد تنظیم شد"]) },
      { label: "ردشده / بسته‌شده", value: countByStatuses(items, ["رد توسط قائم‌مقام", "رد توسط مدیرعامل در مرحله اول", "رد نهایی مدیرعامل"]) },
    ];
    if (role === "deputy") return [
      { label: "بررسی اولیه", value: countByStatuses(items, ["در حال بررسی قائم‌مقام"]) },
      { label: "برگشتی برای تکمیل", value: countByStatuses(items, ["نیازمند تکمیل"]) },
      { label: "در انتظار تصمیم مدیرعامل", value: countByStatuses(items, ["ارسال به مدیرعامل", "ارسال طرح نهایی به مدیرعامل"]) },
      { label: "طراحی و قیمت‌گذاری", value: countByStatuses(items, ["تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "قیمت‌گذاری و بررسی مالی"]) },
      { label: "مذاکرات", value: countByStatuses(items, ["مذاکرات اولیه"]) },
    ];
    if (role === "economic") return [
      { label: "در حال تدوین طرح", value: countByStatuses(items, ["تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال"]) },
      { label: "قیمت‌گذاری", value: countByStatuses(items, ["قیمت‌گذاری و بررسی مالی"]) },
      { label: "مذاکرات", value: countByStatuses(items, ["مذاکرات اولیه"]) },
      { label: "ارسال‌شده برای تصمیم نهایی", value: countByStatuses(items, ["ارسال طرح نهایی به مدیرعامل"]) },
      { label: "قرارداد / ثبت نهایی", value: countByStatuses(items, ["قرارداد تنظیم شد", "ثبت پروژه"]) },
    ];
    const unitReportLabels = role === "media"
      ? { attention: "محتوای/پروژه رسانه‌ای نیازمند اقدام", progress: "تولید و هماهنگی انتشار", completed: "خروجی‌های نهایی‌شده" }
      : role === "education"
        ? { attention: "برنامه آموزشی نیازمند اقدام", progress: "برنامه‌های در حال طراحی یا اجرا", completed: "برنامه‌های تکمیل‌شده" }
        : role === "artists"
          ? { attention: "پرونده‌های هنری نیازمند اقدام", progress: "پرونده‌های هنری در حال پیگیری", completed: "پرونده‌های هنری نهایی‌شده" }
          : role === "csr"
            ? { attention: "پرونده‌های اجتماعی نیازمند اقدام", progress: "پروژه‌های اجتماعی در حال پیگیری", completed: "پروژه‌های اجتماعی نهایی‌شده" }
            : { attention: "نیازمند اقدام", progress: "در حال پیگیری", completed: "پرونده‌های نهایی‌شده" };
    return [
      { label: unitReportLabels.attention, value: countByStatuses(items, config.attentionStatuses) },
      { label: unitReportLabels.progress, value: countByStatuses(items, config.progressStatuses) },
      { label: unitReportLabels.completed, value: countByStatuses(items, config.completedStatuses) },
    ];
  }, [role, items, config, membershipOverview]);

  const attentionItems = useMemo(
    () => items.filter((item) => config.attentionStatuses.includes(item.status || "")),
    [config.attentionStatuses, items],
  );

  const recentItems = useMemo(
    () => [...items].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 6),
    [items],
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return <main dir="rtl" className="min-h-screen bg-[#F7F5F0] p-10 text-center text-[#172F48]">در حال آماده‌سازی داشبورد اختصاصی...</main>;
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#F7F5F0] text-[#172F48]">
      <header className="sticky top-0 z-20 border-b border-[#E3E0D8] bg-[#F7F5F0]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div>
            <div className="text-xs font-bold text-[#B99450]">سامانه داخلی خورشید</div>
            <h1 className="mt-1 text-xl font-extrabold md:text-2xl">{config.title}</h1>
            <p className="mt-1 text-xs text-[#687783]">{userName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={dashboardPathForRole(role)} className="rounded-xl border border-[#E3E0D8] bg-[#FFFEFA] px-4 py-2 text-sm font-bold hover:bg-[#EEECE6]">صفحه اصلی داشبورد</a>
            <a href="https://www.khorshid-mafakher.ir/" target="_blank" rel="noreferrer" className="rounded-xl border border-[#E3E0D8] bg-[#FFFEFA] px-4 py-2 text-sm font-bold hover:bg-[#EEECE6]">وب‌سایت خورشید</a>
            <button type="button" onClick={() => void load()} className="rounded-xl border border-[#E3E0D8] bg-[#FFFEFA] px-4 py-2 text-sm font-bold hover:bg-[#EEECE6]">به‌روزرسانی</button>
            <button type="button" onClick={logout} className="rounded-xl border border-[#B99450]/50 bg-[#F0DFB8] px-4 py-2 text-sm font-bold">خروج از حساب</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <section className="rounded-3xl bg-[#172F48] p-6 text-white shadow-sm md:p-8">
          <p className="text-sm font-bold text-[#D8B56E]">نمای اختصاصی شما</p>
          <h2 className="mt-2 text-2xl font-extrabold md:text-3xl">{config.subtitle}</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[#E6EAF0]">{config.welcome}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metricCards.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <div className="text-xs text-white/75">{metric.label}</div>
                <div className="mt-2 text-2xl font-extrabold tabular-nums">{metric.value}</div>
                <div className="mt-1 text-[11px] leading-5 text-white/65">{metric.hint}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={`mt-6 grid gap-5 ${role === "members" ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]"}`}>
          <div className="rounded-3xl border border-[#E3E0D8] bg-[#FFFEFA] p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="text-lg font-extrabold">{role === "members" ? "وضعیت درخواست‌های عضویت و ارتقا" : "گزارش مدیریتی سبد پرونده‌ها"}</h3><p className="mt-1 text-sm leading-6 text-[#687783]">{role === "members" ? "صف درخواست‌های عضویت، تکمیل مدارک و ارتقای رده تخصصی اعضا." : role === "ceo" ? "تمرکز بر تصمیم‌های معطل، قراردادها و تصویر کلان فرصت‌ها." : role === "deputy" ? "تمرکز بر صف ورودی، پرونده‌های برگشتی و مراحل ایجاد گلوگاه." : role === "economic" ? "تمرکز بر پیشرفت فرصت‌های تخصیص‌یافته، قیمت‌گذاری و مذاکره." : "توزیع پرونده‌ها بر اساس مرحله گردش کار."}</p></div>
              <span className="rounded-full bg-[#F0DFB8] px-3 py-1.5 text-xs font-bold text-[#6A531B]">بر پایه داده‌های ثبت‌شده</span>
            </div>
            <div className="mt-4 divide-y divide-[#E3E0D8]">
              {reportRows.map((row) => <div key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-[#526173]">{row.label}</span><strong className="min-w-8 rounded-lg bg-[#F7F5F0] px-2 py-1 text-center tabular-nums">{money(row.value)}</strong>
              </div>)}
            </div>
          </div>
          {role !== "members" && !["csr", "media", "artists", "education"].includes(role) && <div className="rounded-3xl border border-[#E3E0D8] bg-[#FFFEFA] p-5 md:p-6">
            <h3 className="text-lg font-extrabold">نمای مالی فرصت‌ها</h3>
            <p className="mt-1 text-sm leading-6 text-[#687783]">مبالغ از فیلدهای ثبت‌شده پرونده‌ها محاسبه شده‌اند؛ این اعداد جایگزین گزارش حسابداری یا مانده وصولی نیستند.</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-[#F7F5F0] p-4"><div className="text-xs text-[#687783]">ارزش برآوردی فرصت‌های باز</div><div className="mt-2 text-xl font-extrabold tabular-nums">{money(openPipelineValue)} <span className="text-xs font-bold text-[#687783]">ریال</span></div></div>
              <div className="rounded-2xl bg-[#F7F5F0] p-4"><div className="text-xs text-[#687783]">مبلغ قراردادهای ثبت‌شده در پرونده</div><div className="mt-2 text-xl font-extrabold tabular-nums">{money(contractedValue)} <span className="text-xs font-bold text-[#687783]">ریال</span></div></div>
              <div className="rounded-2xl border border-[#E3E0D8] p-4 text-xs leading-6 text-[#687783]">{role === "economic" ? "مبنای محاسبه فقط پرونده‌هایی است که به واحد توسعه مشارکت‌های اقتصادی تخصیص یافته‌اند." : "این نمای مالی از داده‌های فرصت‌ها و قراردادها ساخته شده است؛ وصول واقعی، هزینه قطعی و سود نهایی تا اتصال داده‌های مالی به‌صورت مستقل قابل گزارش نیست."}</div>
            </div>
          </div>}
        </section>

        {role === "members" && (
          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-[#E3E0D8] bg-[#FFFEFA] p-5 md:p-6">
              <h3 className="text-lg font-extrabold">باشگاه‌ها و تعداد اعضا</h3>
              <p className="mt-1 text-sm text-[#687783]">تعداد اعضا بر اساس ارتباط ثبت‌شده در پرونده‌ها محاسبه می‌شود.</p>
              <div className="mt-3 divide-y divide-[#E3E0D8]">
                {(membershipOverview?.clubs || []).filter((club) => club.status !== "closed").map((club) => {
                  const count = (membershipOverview?.members || []).filter((member) => (member.clubIds || []).includes(club.id)).length;
                  return <div key={club.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{club.name}</span><strong className="rounded-lg bg-[#F0DFB8] px-3 py-1.5 tabular-nums">{money(count)}</strong></div>;
                })}
                {(!membershipOverview || !membershipOverview.clubs.length) && <p className="py-4 text-sm text-[#687783]">اطلاعات باشگاه‌ها در دسترس نیست.</p>}
              </div>
              <button type="button" onClick={() => router.push("/internal/clubs")} className="mt-4 rounded-xl border border-[#E3E0D8] px-4 py-2 text-sm font-bold">مدیریت باشگاه‌ها</button>
            </div>
            <div className="rounded-3xl border border-[#E3E0D8] bg-[#FFFEFA] p-5 md:p-6">
              <h3 className="text-lg font-extrabold">آخرین درخواست‌های عضویت</h3>
              <div className="mt-3 divide-y divide-[#E3E0D8]">
                {(membershipOverview?.requests || []).slice(0, 6).map((request) => <div key={request.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><span className="block font-bold">{request.name || "متقاضی بدون نام"}</span><span className="mt-1 block text-xs text-[#687783]">{membershipStatusLabel(request.reviewStatus || request.status)}</span></div><span className="text-xs text-[#687783]">{request.createdAt ? new Date(request.createdAt).toLocaleDateString("fa-IR") : ""}</span></div>)}
                {(!membershipOverview || !membershipOverview.requests.length) && <p className="py-4 text-sm text-[#687783]">درخواست عضویتی برای نمایش وجود ندارد یا اتصال سایت در دسترس نیست.</p>}
              </div>
              <button type="button" onClick={() => router.push("/internal/membership-requests")} className="mt-4 rounded-xl bg-[#172F48] px-4 py-2 text-sm font-bold text-white">ورود به کارتابل درخواست‌ها</button>
            </div>
          </section>
        )}

        {(role === "ceo" || role === "deputy") && (
          <section className="mt-6 rounded-3xl border border-[#E3E0D8] bg-[#FFFEFA] p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold">نمای مدیریتی اعضا و باشگاه‌ها</h3>
                <p className="mt-1 text-sm leading-6 text-[#687783]">آمار از پرونده‌های اعضا و باشگاه‌های ثبت‌شده در سامانه محاسبه می‌شود. تعداد اعضای هر باشگاه بر اساس ارتباط ثبت‌شده در پرونده عضو است.</p>
              </div>
              {(role === "ceo" || role === "deputy") && <button type="button" aria-expanded={clubSummaryExpanded} onClick={() => setClubSummaryExpanded((value) => !value)} className="rounded-xl bg-[#172F48] px-3 py-2 text-sm font-bold text-white">{clubSummaryExpanded ? "بستن جزئیات" : "نمایش جزئیات"}</button>}
              <button type="button" onClick={() => void load()} className="rounded-xl border border-[#E3E0D8] bg-white px-3 py-2 text-sm font-bold">به‌روزرسانی گزارش</button>
            </div>
            {clubSummaryExpanded && (clubSummary ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {[
                    { label: "کل اعضا", value: clubSummary.totals.members, hint: "تمام پرونده‌های اعضا" },
                    { label: "اعضای فعال", value: clubSummary.totals.activeMembers, hint: "وضعیت عضویت فعال" },
                    { label: "کل باشگاه‌ها", value: clubSummary.totals.clubs, hint: "باشگاه‌های پایه و ثبت‌شده" },
                    { label: "باشگاه‌های فعال", value: clubSummary.totals.activeClubs, hint: "وضعیت فعال در سامانه" },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-2xl bg-[#F7F5F0] p-4">
                      <div className="text-xs text-[#687783]">{metric.label}</div>
                      <div className="mt-2 text-2xl font-extrabold tabular-nums">{money(metric.value)}</div>
                      <div className="mt-1 text-[11px] text-[#687783]">{metric.hint}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div>
                    <h4 className="font-extrabold">تعداد اعضا به تفکیک باشگاه</h4>
                    <div className="mt-3 divide-y divide-[#E3E0D8]">
                      {clubSummary.clubs.map((club) => (
                        <div key={club.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                          <div>
                            <span className="block font-bold">{club.name}</span>
                            <span className="mt-1 block text-xs text-[#687783]">{club.status === "active" ? "فعال" : club.status === "planning" ? "در حال شکل‌گیری" : club.status === "paused" ? "متوقف موقت" : club.status === "closed" ? "خاتمه‌یافته" : "باشگاه پایه"} · اعضای فعال: {money(club.activeMemberCount)}</span>
                          </div>
                          <strong className="min-w-10 rounded-lg bg-[#F0DFB8] px-3 py-2 text-center tabular-nums">{money(club.memberCount)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-extrabold">برنامه‌های آتی باشگاه‌ها</h4>
                    <p className="mt-1 text-xs leading-6 text-[#687783]">فقط اطلاعیه‌های تاریخ‌دار آینده که در سایت اصلی به باشگاه مشخصی مرتبط شده‌اند نمایش داده می‌شوند.</p>
                    {clubSummary.upcomingPrograms.length ? (
                      <div className="mt-3 space-y-3">
                        {clubSummary.upcomingPrograms.map((program) => (
                          <a key={program.id} href={program.href} target="_blank" rel="noreferrer" className="block rounded-2xl border border-[#E3E0D8] p-4 transition hover:bg-[#F7F5F0]">
                            <span className="block font-bold">{program.title}</span>
                            <span className="mt-1 block text-xs text-[#96763D]">{program.dateLabel}</span>
                            <span className="mt-1 block text-xs leading-5 text-[#687783]">{program.clubNames.join("، ")}</span>
                            {program.description && <span className="mt-2 block text-sm leading-6 text-[#526173]">{program.description}</span>}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl bg-[#F7F5F0] p-5 text-sm leading-6 text-[#687783]">
                        {clubSummary.feedAvailable ? "فعلاً برنامه تاریخ‌دار آینده‌ای برای باشگاه‌ها در سایت ثبت نشده است. برنامه‌ای که تاریخ یا ارتباط باشگاهی نداشته باشد، به‌اشتباه به‌عنوان برنامه آتی نمایش داده نمی‌شود." : "فهرست برنامه‌های سایت اصلی فعلاً دریافت نشد؛ آمار اعضا و باشگاه‌ها همچنان در دسترس است."}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-4 rounded-2xl bg-[#F7F5F0] p-5 text-sm text-[#687783]">گزارش اعضا و باشگاه‌ها فعلاً دریافت نشد. اطلاعات این بخش از API مستقل خوانده می‌شود و خطای آن روی کارتابل فرصت‌ها اثری ندارد.</p>
            ))}
          </section>
        )}

        {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} <button type="button" className="mr-3 font-bold underline" onClick={() => void load()}>تلاش مجدد</button></div>}

        <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="space-y-5">
            <div className="rounded-3xl border border-[#E3E0D8] bg-[#FFFEFA] p-5 md:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="text-lg font-extrabold">کارتابل نیازمند اقدام</h3><p className="mt-1 text-sm text-[#687783]">پرونده‌هایی که طبق نقش شما به توجه بیشتری نیاز دارند.</p></div>
                <button type="button" onClick={() => router.push("/internal/opportunities")} className="rounded-xl bg-[#172F48] px-4 py-2.5 text-sm font-bold text-white">بازکردن کارتابل</button>
              </div>
              {attentionItems.length ? (
                <div className="mt-4 space-y-3">
                  {attentionItems.slice(0, 5).map((item) => (
                    <button type="button" key={item.id} onClick={() => router.push(`/internal/opportunities?id=${encodeURIComponent(item.id)}`)} className="flex w-full flex-col gap-2 rounded-2xl border border-[#E3E0D8] p-4 text-right transition hover:bg-[#F7F5F0] sm:flex-row sm:items-center sm:justify-between">
                      <span><span className="block font-bold">{item.title || "بدون عنوان"}</span><span className="mt-1 block text-xs text-[#687783]">{item.code || "بدون کد"}{item.clientName ? ` · ${item.clientName}` : ""}</span></span>
                      <StatusPill status={item.status || "در جریان"} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-[#F7F5F0] p-6 text-center"><p className="font-bold">{config.emptyTitle}</p><p className="mt-2 text-sm leading-6 text-[#687783]">{config.emptyDescription}</p></div>
              )}
            </div>

            <div className="rounded-3xl border border-[#E3E0D8] bg-[#FFFEFA] p-5 md:p-6">
              <h3 className="text-lg font-extrabold">آخرین پرونده‌های مرتبط</h3>
              <p className="mt-1 text-sm text-[#687783]">فقط پرونده‌هایی که API بر اساس نقش فعلی در اختیار این حساب قرار داده است.</p>
              {recentItems.length ? <div className="mt-4 divide-y divide-[#E3E0D8]">
                {recentItems.map((item) => <button type="button" key={item.id} onClick={() => router.push(`/internal/opportunities?id=${encodeURIComponent(item.id)}`)} className="flex w-full flex-col gap-2 py-4 text-right transition hover:bg-[#F7F5F0] sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-bold">{item.title || "بدون عنوان"}</p><p className="mt-1 text-xs text-[#687783]">{item.clientName || "طرف همکاری مشخص نشده"} · {item.code || "بدون کد"}</p></div>
                  <StatusPill status={item.status || "در جریان"} />
                </button>)}
              </div> : <p className="mt-4 rounded-2xl bg-[#F7F5F0] p-6 text-center text-sm text-[#687783]">هنوز پرونده‌ای برای نمایش وجود ندارد.</p>}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-[#E3E0D8] bg-[#FFFEFA] p-5 md:p-6">
              <h3 className="text-lg font-extrabold">اقدامات و ابزارهای نقش شما</h3>
              <p className="mt-1 text-sm text-[#687783]">دسترسی مستقیم به ابزارهای عملیاتی موجود.</p>
              <div className="mt-4 space-y-3">
                {config.actions.map((action) => <button type="button" key={action.label} onClick={() => router.push(action.href)} className={`w-full rounded-2xl border px-4 py-4 text-right transition hover:-translate-y-0.5 ${action.primary ? "border-[#172F48] bg-[#172F48] text-white hover:bg-[#244662]" : "border-[#E3E0D8] bg-white text-[#172F48] hover:bg-[#F7F5F0]"}`}>
                  <span className="block font-bold">{action.label}</span><span className={`mt-1 block text-xs leading-6 ${action.primary ? "text-white/75" : "text-[#687783]"}`}>{action.description}</span>
                </button>)}
              </div>
            </div>

            <div className="rounded-3xl border border-[#E3E0D8] bg-[#FFFEFA] p-5 md:p-6">
              <h3 className="text-lg font-extrabold">اولویت‌های کاری این نقش</h3>
              <ol className="mt-4 space-y-3">
                {config.priorities.map((priority, index) => <li key={priority} className="flex gap-3 text-sm leading-6"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F0DFB8] text-xs font-extrabold text-[#172F48]">{money(index + 1)}</span><span>{priority}</span></li>)}
              </ol>
            </div>
            <div className="rounded-2xl border border-[#E3E0D8] bg-white p-4 text-xs leading-6 text-[#687783]">
              این داشبورد نمای کاری نقش فعلی است. دسترسی نهایی به اطلاعات و عملیات در سمت سرور کنترل می‌شود. افزودن، ویرایش و حذف پرونده اعضا و باشگاه‌ها فقط در اختیار معاونت اعضا است؛ ابزارهای مستقل تقویم محتوا و مدیریت برنامه‌های آموزشی هنوز نیازمند پیاده‌سازی هستند.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
