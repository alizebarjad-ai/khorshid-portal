"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/auth";
import { dashboardPathForRole } from "@/lib/dashboard-path";

type ManagementRole = Exclude<UserRole, "beneficiary">;
type Opportunity = {
  id: string;
  code?: string;
  title?: string;
  clientName?: string;
  type?: string;
  status?: string;
  createdAt?: string;
  assignedToName?: string;
  creatorName?: string;
  expectedValue?: number;
  contractValue?: number;
  team?: string[];
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
      { label: "پرونده اعضا و باشگاه‌ها", description: "مدیریت اطلاعات اعضا، مفاخر و باشگاه‌های تخصصی", href: "/internal/members" },
      { label: "سامانه پرونده‌ها و پاداش", description: "مشاهده اطلاعات پروژه و پاداش‌های ثبت‌شده", href: "/internal/project-rewards" },
      { label: "کارتابل محتوای تأییدشده", description: "دریافت محتوای ارجاع‌شده از معاون رسانه و ثبت نتیجه بارگذاری در سایت", href: "/internal/content-review", primary: true },
    ],
    attentionStatuses: ["ارسال به مدیرعامل", "ارسال طرح نهایی به مدیرعامل", "تأیید نهایی مدیرعامل", "رد توسط مدیرعامل در مرحله اول"],
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
      { label: "مدیریت اعضا و باشگاه‌ها", description: "دسترسی مدیریتی به پرونده اعضا و باشگاه‌های تخصصی", href: "/internal/members" },
      { label: "ثبت فرصت جدید", description: "ثبت فرصت‌های راهبردی و همکاری", href: "/internal/submit-proposal" },
    ],
    attentionStatuses: ["در حال بررسی قائم‌مقام", "نیازمند تکمیل", "بازگشت به قائم‌مقام", "ثبت اولیه"],
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
    attentionStatuses: ["تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "مذاکرات اولیه", "نیازمند تکمیل"],
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
      { label: "پرونده‌های اجتماعی", description: "پیگیری پروژه‌های ارجاع‌شده به واحد", href: "/internal/opportunities", primary: true },
      { label: "کارتابل ارتقای متخصصان و مشاوران", description: "بررسی درخواست‌های تخصص و مشاوره و تأیید پروفایل", href: "/internal/member-upgrades", primary: true },
      { label: "بانک تخصص و مشاوران", description: "جست‌وجو در پروفایل متخصصان و مشاوران تأییدشده برای پروژه‌ها", href: "/internal/expertise-directory", primary: true },
      { label: "ثبت پیشنهاد اجتماعی", description: "ثبت نیاز یا ایده برای پروژه حمایتی", href: "/internal/submit-proposal" },
    ],
    attentionStatuses: ["تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "نیازمند تکمیل"],
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
      { label: "پرونده‌های رسانه‌ای", description: "پیگیری پروژه‌های ارجاع‌شده به واحد", href: "/internal/opportunities", primary: true },
      { label: "کارتابل محتوای اعضا", description: "بررسی متن، تصویر و ویدیوی ارسالی و ارجاع محتوای تأییدشده به ادمین", href: "/internal/content-review", primary: true },
      { label: "ثبت پیشنهاد رسانه‌ای", description: "ثبت ایده تولید محتوا یا همکاری رسانه‌ای", href: "/internal/submit-proposal" },
    ],
    attentionStatuses: ["تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "نیازمند تکمیل"],
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
    attentionStatuses: ["تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "نیازمند تکمیل"],
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
    attentionStatuses: ["تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "نیازمند تکمیل"],
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
      { label: "پیگیری درخواست‌های ارتقای تخصصی", description: "مشاهده وضعیت درخواست‌های هنرمندی، تخصص و مشاوره", href: "/internal/member-upgrades" },
      { label: "کارتابل درخواست‌های عضویت", description: "بررسی مدارک، تعیین نوع عضویت، درخواست تکمیل و تأیید متقاضیان سایت", href: "/internal/membership-requests", primary: true },
      { label: "مدیریت باشگاه‌ها", description: "تعریف باشگاه‌ها و مشاهده اعضای مرتبط", href: "/internal/clubs" },
      { label: "پرونده‌های مرتبط با اعضا", description: "پیگیری پرونده‌های ارجاع‌شده به واحد", href: "/internal/opportunities" },
      { label: "ثبت پیشنهاد اعضا یا باشگاه", description: "ثبت ایده یا فرصت همکاری مرتبط با اعضا", href: "/internal/submit-proposal" },
    ],
    attentionStatuses: ["تشکیل تیم پروژه", "در حال تدوین طرح و پروپوزال", "نیازمند تکمیل"],
    progressStatuses: ["قیمت‌گذاری و بررسی مالی", "مذاکرات اولیه", "ارسال طرح نهایی به مدیرعامل"],
    completedStatuses: ["قرارداد تنظیم شد", "ثبت پروژه"],
    emptyTitle: "پرونده مرتبط با اعضا یا باشگاه‌ها وجود ندارد",
    emptyDescription: "پرونده‌های مرتبط با اعضا پس از ارجاع به واحد در اینجا نمایش داده می‌شوند.",
  },
};

const money = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.max(0, Math.round(value)));

function StatusPill({ status }: { status: string }) {
  const isDone = ["ثبت پروژه", "ثبت‌شده", "قرارداد تنظیم شد"].includes(status);
  const isAttention = ["نیازمند تکمیل", "در حال بررسی قائم‌مقام", "ارسال به مدیرعامل", "ارسال طرح نهایی به مدیرعامل", "ارجاع به مالی"].includes(status);
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isDone ? "bg-emerald-50 text-emerald-800" : isAttention ? "bg-amber-50 text-amber-800" : "bg-[#EEECE6] text-[#172F48]"}`}>{status || "در جریان"}</span>;
}

export default function RoleDashboard({ role }: { role: ManagementRole }) {
  const router = useRouter();
  const config = CONFIG[role];
  const [items, setItems] = useState<Opportunity[]>([]);
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
      if (currentRole !== role) {
        const pathByRole: Record<ManagementRole, string> = {
          ceo: "/internal/roles/ceo",
          deputy: "/internal/roles/deputy",
          finance: "/internal/roles/finance",
          economic: "/internal/roles/economic",
          csr: "/internal/roles/csr",
          media: "/internal/media-manager",
          artists: "/internal/roles/artists",
          education: "/internal/education-manager",
          members: "/internal/roles/members",
        };
        router.replace(pathByRole[currentRole] || "/login");
        return;
      }
      setUserName(authData.user.name || config.title);

      const response = await fetch("/api/opportunities", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "دریافت اطلاعات داشبورد انجام نشد.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ارتباط با سامانه برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }, [config.title, role, router]);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => {
    const count = (statuses: string[]) => items.filter((item) => statuses.includes(item.status || "")).length;
    return {
      total: items.length,
      attention: count(config.attentionStatuses),
      progress: count(config.progressStatuses),
      completed: count(config.completedStatuses),
    };
  }, [config, items]);

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
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "پرونده‌های در دسترس", value: metrics.total, hint: "بر اساس سطح دسترسی شما" },
              { label: "نیازمند اقدام", value: metrics.attention, hint: "طبق مرحله گردش کار" },
              { label: "در حال پیگیری", value: metrics.progress, hint: "پرونده‌های فعال در مسیر اجرا" },
              { label: "قرارداد / ثبت نهایی", value: metrics.completed, hint: "پرونده‌های نهایی‌شده" },
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <div className="text-xs text-white/75">{metric.label}</div>
                <div className="mt-2 text-2xl font-extrabold">{money(metric.value)}</div>
                <div className="mt-1 text-[11px] leading-5 text-white/65">{metric.hint}</div>
              </div>
            ))}
          </div>
        </section>

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
                    <button type="button" key={item.id} onClick={() => router.push("/internal/opportunities")} className="flex w-full flex-col gap-2 rounded-2xl border border-[#E3E0D8] p-4 text-right transition hover:bg-[#F7F5F0] sm:flex-row sm:items-center sm:justify-between">
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
                {recentItems.map((item) => <div key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-bold">{item.title || "بدون عنوان"}</p><p className="mt-1 text-xs text-[#687783]">{item.clientName || "طرف همکاری مشخص نشده"} · {item.code || "بدون کد"}</p></div>
                  <StatusPill status={item.status || "در جریان"} />
                </div>)}
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
              این داشبورد نمای کاری نقش فعلی است. دسترسی نهایی به اطلاعات و عملیات در سمت سرور کنترل می‌شود. مدیریت اعضا و باشگاه‌ها در دسترس است؛ ابزارهای مستقل تقویم محتوا و مدیریت برنامه‌های آموزشی هنوز نیازمند پیاده‌سازی هستند.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
