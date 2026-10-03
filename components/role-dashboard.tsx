"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/auth";

type Project = {
  id: string; name?: string; code?: string; clientName?: string; status?: string;
  contractValue?: number; revenue?: number; received?: number;
  financialTransactions?: { type?: string; amount?: number; status?: string }[];
};

type RoleConfig = {
  role: UserRole;
  title: string;
  subtitle: string;
  primary: string[];
  secondary: string[];
};

export const ROLE_CONFIG: Record<Exclude<UserRole, "beneficiary">, RoleConfig> = {
  ceo: {
    role: "ceo", title: "داشبورد مدیرعامل", subtitle: "نمای کلی پرونده‌ها، عملکرد و وضعیت مالی سازمان",
    primary: ["گزارش مدیریتی", "پرونده‌ها", "مطالبات", "قراردادها"], secondary: ["پیشنهادها و کارتابل", "اعلان‌ها"],
  },
  deputy: {
    role: "deputy", title: "داشبورد قائم‌مقام", subtitle: "مدیریت راهبردی، بررسی پیشنهادها و پیگیری پرونده‌ها",
    primary: ["گزارش مدیریتی", "پیشنهادها و کارتابل", "پرونده‌های در گردش", "اقدامات موردنیاز"], secondary: ["اعلان‌ها", "تقویم و پیگیری"],
  },
  finance: {
    role: "finance", title: "داشبورد معاونت مالی و اداری", subtitle: "مدیریت اطلاعات مالی، قراردادها، وصول و پاداش پروژه‌ها",
    primary: ["پروژه‌ها و پرونده‌ها", "اطلاعات مالی", "قراردادها", "مطالبات", "استخر پاداش"], secondary: ["گزارش مالی", "تراکنش‌ها"],
  },
  economic: {
    role: "economic", title: "داشبورد توسعه مشارکت‌های اقتصادی", subtitle: "مدیریت حامیان، برندها، شرکای استراتژیک و فرصت‌های اقتصادی",
    primary: ["فرصت‌های اقتصادی", "شرکا و حامیان", "پرونده‌های مشارکت", "گزارش مشارکت‌ها"], secondary: ["اعلان‌ها", "اقدامات موردنیاز"],
  },
  csr: {
    role: "csr", title: "داشبورد برنامه‌های حمایتی و اجتماعی", subtitle: "مدیریت پروژه‌های اجتماعی، حمایتی و مسئولیت اجتماعی",
    primary: ["پروژه‌های اجتماعی", "پیشنهادهای اجتماعی", "شرکا و حامیان", "گزارش پروژه‌ها"], secondary: ["اعلان‌ها", "اقدامات موردنیاز"],
  },
  media: {
    role: "media", title: "داشبورد رسانه و محتوا", subtitle: "مدیریت اخبار، رسانه، تولید محتوا و پروژه‌های ارتباطی",
    primary: ["محتوا", "اخبار", "رسانه و ویدیو", "پروژه‌های رسانه‌ای"], secondary: ["تقویم محتوا", "اعلان‌ها"],
  },
  artists: {
    role: "artists", title: "داشبورد امور هنرمندان", subtitle: "مدیریت شبکه هنرمندان، مشارکت‌ها و پروژه‌های هنری",
    primary: ["هنرمندان", "پروژه‌های هنری", "مشارکت‌ها", "گزارش هنرمندان"], secondary: ["اعلان‌ها", "اقدامات موردنیاز"],
  },
  education: {
    role: "education", title: "داشبورد آموزش، پژوهش و نوآوری", subtitle: "مدیریت برنامه‌های آموزشی، پژوهشی و نوآورانه",
    primary: ["برنامه‌های آموزشی", "پژوهش‌ها", "نوآوری", "گزارش برنامه‌ها"], secondary: ["تقویم", "اعلان‌ها"],
  },
  members: {
    role: "members", title: "داشبورد مفاخر و امور اعضا", subtitle: "مدیریت اعضا، مفاخر، باشگاه‌ها و مشارکت اعضا",
    primary: ["اعضا و مفاخر", "باشگاه‌های تخصصی", "درخواست‌های عضویت", "پیشنهادهای اعضا", "گزارش اعضا"], secondary: ["اعلان‌ها", "اقدامات موردنیاز"],
  },
};

const ROLE_PATHS: Record<Exclude<UserRole, "beneficiary">, string> = {
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

const money = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.max(0, Math.round(n)));

function readProjects(): Project[] {
  try {
    const raw = localStorage.getItem("khorshid-project-rewards-v1");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function receivedOf(p: Project) {
  const tx = p.financialTransactions || [];
  if (!tx.length) return Number(p.received || 0);
  return tx.filter(t => t.type === "وصول" && t.status === "تأیید شده").reduce((s,t) => s + Number(t.amount || 0), 0);
}

const ROUTE_BY_LABEL: Record<string, string> = {
  "پیشنهادها و کارتابل": "/opportunities",
  "فرصت‌های اقتصادی": "/opportunities",
  "پروژه‌ها و پرونده‌ها": "/project-rewards",
  "استخر پاداش": "/project-rewards",
  "اطلاعات مالی": "/project-rewards",
  "مطالبات": "/project-rewards",
  "اعضا و مفاخر": "/members",
  "باشگاه‌های تخصصی": "/members",
  "درخواست‌های عضویت": "/members",
  "پیشنهادهای اعضا": "/members",
  "هنرمندان": "/artists",
  "پروژه‌های هنری": "/projects",
  "مشارکت‌ها": "/participation",
  "پروژه‌های اجتماعی": "/projects-social",
  "پیشنهادهای اجتماعی": "/opportunities",
  "شرکا و حامیان": "/partners",
  "محتوا": "/media",
  "اخبار": "/media",
  "رسانه و ویدیو": "/media",
  "پروژه‌های رسانه‌ای": "/projects",
  "تقویم محتوا": "/calendar",
  "برنامه‌های آموزشی": "/education",
  "پژوهش‌ها": "/education",
  "نوآوری": "/education",
  "تقویم": "/calendar",
};

function routeForLabel(label: string, role: Exclude<UserRole, "beneficiary">) {
  if (ROUTE_BY_LABEL[label]) return ROUTE_BY_LABEL[label];
  if (label === "گزارش مدیریتی" || label === "گزارش مالی" || label === "گزارش مشارکت‌ها" || label === "گزارش پروژه‌ها" || label === "گزارش هنرمندان" || label === "گزارش برنامه‌ها" || label === "گزارش اعضا") return ROLE_PATHS[role];
  return undefined;
}

export default function RoleDashboard({ role }: { role: Exclude<UserRole, "beneficiary"> }) {
  const router = useRouter();
  const config = ROLE_CONFIG[role];
  const [projects, setProjects] = useState<Project[]>([]);
  const [userName, setUserName] = useState(config.title);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then(async r => {
      if (!r.ok) { router.replace("/login"); return; }
      const data = await r.json();
      if (data.user?.role !== role) {
        if (data.user?.role === "beneficiary") router.replace("/my-reward");
        else router.replace(ROLE_PATHS[data.user?.role as Exclude<UserRole, "beneficiary">] || "/login");
        return;
      }
      setUserName(data.user.name || config.title);
      setProjects(readProjects());
    }).catch(() => router.replace("/login")).finally(() => setLoading(false));
  }, [role, router, config.title]);

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => p.status === "فعال").length;
    const contract = projects.reduce((s,p) => s + Number(p.contractValue ?? p.revenue ?? 0),0);
    const received = projects.reduce((s,p) => s + receivedOf(p),0);
    return { total, active, contract, received, receivables: Math.max(0,contract-received) };
  }, [projects]);

  async function logout() {
    await fetch("/api/auth/logout", { method:"POST" });
    router.replace("/login");
    router.refresh();
  }

  if (loading) return <main dir="rtl" className="min-h-screen bg-[#071326] pt-24 p-10 text-center text-white">در حال بارگذاری داشبورد...</main>;

  const actionButton = (label: string, compact = false) => {
    const href = routeForLabel(label, role);
    return (
      <button
        key={label}
        type="button"
        onClick={() => href && router.push(href)}
        disabled={!href}
        className={`w-full rounded-xl px-4 py-3 text-right text-sm font-semibold transition ${href ? "bg-white/5 hover:bg-white/10" : "cursor-default bg-white/5 opacity-70"} ${compact ? "" : ""}`}
      >
        {label}
      </button>
    );
  };

  return <main dir="rtl" className="min-h-screen bg-[#071326] pt-24 text-white">
    <div className="min-h-screen bg-[radial-gradient(circle_at_85%_0%,rgba(216,149,0,.12),transparent_32%)]">
      <header className="sticky top-[72px] z-20 border-b border-white/10 bg-[#071326]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div><div className="text-xs font-bold text-[#F2A900]">سامانه داخلی خورشید</div><h1 className="mt-1 text-xl font-extrabold md:text-2xl">{config.title}</h1><p className="mt-1 text-xs text-[#B8C6D9]">{userName}</p></div>
          <nav className="flex flex-wrap gap-2">
            {config.primary.slice(0,2).map(item => {
              const href = routeForLabel(item, role);
              return <button key={item} type="button" disabled={!href} onClick={() => href && router.push(href)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:cursor-default disabled:opacity-70">{item}</button>;
            })}
            {role !== "members" && (
              <>
                <button type="button" onClick={() => router.push("/opportunities")} className="rounded-xl border border-[#F2A900]/40 bg-[#F2A900]/10 px-4 py-2 text-sm font-bold text-[#FFD56A]">پیشنهادها و کارتابل</button>
                <button type="button" onClick={logout} className="rounded-xl border border-[#F2A900]/40 bg-[#F2A900]/10 px-4 py-2 text-sm font-bold text-[#FFD56A]">خروج</button>
              </>
            )}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <section className="mb-7">
          <p className="text-sm font-bold text-[#F2A900]">نمای اختصاصی {config.title}</p>
          <h2 className="mt-1 text-2xl font-extrabold">{config.subtitle}</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["کل پرونده‌ها", money(stats.total)], ["پرونده‌های فعال", money(stats.active)],
              ["ارزش قراردادها", money(stats.contract)], ["مطالبات", money(stats.receivables)],
            ].map(([label,value]) => <div key={label} className="rounded-2xl border border-white/10 bg-[#101F37]/90 p-4"><div className="text-xs text-[#B8C6D9]">{label}</div><div className="mt-2 text-xl font-extrabold">{value}</div>{(label==="ارزش قراردادها"||label==="مطالبات")&&<div className="mt-1 text-[10px] text-[#93A6BF]">ریال</div>}</div>)}
          </div>
        </section>
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#101F37]/90">
            <div className="border-b border-white/10 px-5 py-4"><h2 className="text-lg font-extrabold">پرونده‌ها و اطلاعات مرتبط</h2><p className="mt-1 text-xs text-[#B8C6D9]">نمایش اطلاعات متناسب با سطح دسترسی این معاونت</p></div>
            {projects.length ? <div className="divide-y divide-white/10">{projects.map(p => <div key={p.id} className="px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{p.name || "بدون عنوان"}</h3><p className="mt-1 text-xs text-[#B8C6D9]">{p.clientName || "کارفرما ثبت نشده"} · {p.code || "بدون کد"}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs">{p.status || "در جریان"}</span></div></div>)}</div> : <div className="p-12 text-center text-sm text-[#B8C6D9]">هنوز پرونده‌ای برای نمایش ثبت نشده است.</div>}
          </div>
          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-[#101F37]/90 p-5"><h2 className="font-extrabold">بخش‌های اختصاصی</h2><div className="mt-4 space-y-2">{config.primary.map(x => actionButton(x))}<button type="button" onClick={logout} className="w-full rounded-xl bg-red-500/10 px-4 py-3 text-right text-sm font-semibold text-red-200 transition hover:bg-red-500/20">خروج</button></div></div>
            <div className="rounded-3xl border border-white/10 bg-[#101F37]/90 p-5"><h2 className="font-extrabold">اقدامات سریع</h2><div className="mt-4 space-y-2">{config.secondary.map(x => actionButton(x))}</div></div>
          </aside>
        </section>
      </div>
    </div>
  </main>;
}
