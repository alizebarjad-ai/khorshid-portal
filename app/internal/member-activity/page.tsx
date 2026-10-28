"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Club = { id: string; name: string; clubType?: string; city?: string; description?: string; status?: string };
type Program = { id: string; title: string; description?: string; startsAt?: string; location?: string; clubName?: string; format?: string; href?: string };
type PointEvent = { id: string; title: string; points: number; createdAt: string; note?: string };
type Summary = { pointsBalance: number; pointEvents: PointEvent[]; programs: Program[] };
const dateLabel = (value?: string) => { if (!value) return "زمان متعاقباً اعلام می‌شود"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date); };

export default function MemberActivityPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [summary, setSummary] = useState<Summary>({ pointsBalance: 0, pointEvents: [], programs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [profileRes, dashboardRes, feedRes] = await Promise.all([
          fetch("/api/member/profile", { cache: "no-store" }),
          fetch("/api/member/dashboard", { cache: "no-store" }),
          fetch("/api/club-feed", { cache: "no-store" }),
        ]);
        if (profileRes.status === 401 || profileRes.status === 403) { router.replace("/login"); return; }
        const profile = await profileRes.json();
        if (!profileRes.ok) throw new Error(profile.error || "دریافت اطلاعات باشگاه ناموفق بود.");
        const dash = dashboardRes.ok ? await dashboardRes.json() : {};
        const feed = feedRes.ok ? await feedRes.json() : { items: [] };
        const shared: Program[] = (Array.isArray(feed.items) ? feed.items : [])
          .filter((item: { showToMembers?: boolean }) => item.showToMembers === true)
          .map((item: { id: string; title: string; description?: string; dateLabel?: string; href?: string; kind?: string; clubIds?: string[] }) => ({
            id: "site-" + item.id, title: item.title, description: item.description || "", startsAt: item.dateLabel || "",
            clubName: (item.clubIds || []).length ? "باشگاه تخصصی" : "خورشید مفاخر",
            format: item.kind === "project" ? "پروژه" : item.kind === "announcement" ? "اطلاعیه" : "برنامه",
            href: item.href ? (item.href.startsWith("http") ? item.href : "https://www.khorshid-mafakher.ir" + item.href) : undefined,
          }));
        if (cancelled) return;
        setClubs(Array.isArray(profile.clubs) ? profile.clubs : []);
        setSummary({
          pointsBalance: Number(dash.pointsBalance) || 0,
          pointEvents: Array.isArray(dash.pointEvents) ? dash.pointEvents : [],
          programs: [...(Array.isArray(dash.programs) ? dash.programs : []), ...shared],
        });
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "دریافت اطلاعات ناموفق بود.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [router]);

  return <main dir="rtl" className="internal-app min-h-screen px-4 pb-16 pt-8 text-[#172F48] md:pt-12">
    <div className="container-site max-w-5xl">
      <a href="/internal/member-home" className="text-sm font-bold text-[#96763D]">← بازگشت به صفحه اصلی پرتال</a>
      <header className="mt-4 rounded-3xl bg-[#172F48] p-6 text-white md:p-8">
        <p className="text-sm font-bold text-[#D7B978]">باشگاه و مشارکت</p>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">برنامه‌ها و باشگاه‌های من</h1>
        <p className="mt-3 text-sm leading-7 text-[#E6EAF0]">این بخش فقط فعالیت‌ها و برنامه‌های قابل مشاهده برای حساب شما را نشان می‌دهد.</p>
      </header>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <p className="mt-5 rounded-2xl bg-white p-8 text-center">در حال دریافت اطلاعات…</p> : <>
        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-[#E3E0D8] bg-[#F0DFB8] p-5"><p className="text-sm font-bold">موجودی امتیاز</p><strong className="mt-2 block text-3xl">{new Intl.NumberFormat("fa-IR").format(summary.pointsBalance)}</strong></article>
          <article className="rounded-2xl border border-[#E3E0D8] bg-white p-5"><p className="text-sm text-[#687783]">باشگاه‌های متصل</p><strong className="mt-2 block text-3xl">{new Intl.NumberFormat("fa-IR").format(clubs.length)}</strong></article>
          <article className="rounded-2xl border border-[#E3E0D8] bg-white p-5"><p className="text-sm text-[#687783]">برنامه‌های منتشرشده</p><strong className="mt-2 block text-3xl">{new Intl.NumberFormat("fa-IR").format(summary.programs.length)}</strong></article>
        </section>
        <section className="mt-7">
          <h2 className="text-xl font-extrabold">برنامه‌ها و اطلاعیه‌ها</h2>
          {summary.programs.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{summary.programs.map(program => <article key={program.id} className="rounded-2xl border border-[#E3E0D8] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-[#F0DFB8] px-3 py-1 text-xs font-bold">{program.format || "برنامه"}</span><span className="text-xs text-[#687783]">{dateLabel(program.startsAt)}</span></div>
            <h3 className="mt-3 font-extrabold">{program.href ? <a href={program.href} target="_blank" rel="noopener noreferrer">{program.title} ↗</a> : program.title}</h3>
            {program.description && <p className="mt-2 text-sm leading-7 text-[#687783]">{program.description}</p>}
            <p className="mt-3 text-xs text-[#687783]">{program.clubName || "خورشید مفاخر"}{program.location ? " · " + program.location : ""}</p>
          </article>)}</div> : <p className="mt-3 rounded-2xl border border-dashed border-[#D8D0C4] bg-white p-6 text-sm text-[#687783]">فعلاً برنامه‌ای برای حساب شما منتشر نشده است.</p>}
        </section>
        <section className="mt-7">
          <h2 className="text-xl font-extrabold">باشگاه‌های من</h2>
          {clubs.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{clubs.map(club => <article key={club.id} className="rounded-2xl border border-[#E3E0D8] bg-white p-5">
            <div className="flex items-start justify-between gap-3"><h3 className="font-extrabold">{club.name}</h3><span className="rounded-full bg-[#F0DFB8] px-2.5 py-1 text-xs font-bold">{club.status === "active" ? "فعال" : "در حال برنامه‌ریزی"}</span></div>
            <p className="mt-2 text-xs text-[#687783]">{club.city || "سراسری"}{club.clubType ? " · " + club.clubType : ""}</p>
            {club.description && <p className="mt-3 text-sm leading-7 text-[#526173]">{club.description}</p>}
          </article>)}</div> : <p className="mt-3 rounded-2xl border border-dashed border-[#D8D0C4] bg-white p-6 text-sm text-[#687783]">هنوز باشگاهی به پرونده شما متصل نشده است.</p>}
        </section>
        <section className="mt-7">
          <h2 className="text-xl font-extrabold">آخرین سوابق امتیاز</h2>
          {summary.pointEvents.length ? <ul className="mt-3 divide-y divide-[#E3E0D8] rounded-2xl border border-[#E3E0D8] bg-white px-5">{summary.pointEvents.slice(0, 10).map(item => <li key={item.id} className="flex items-start justify-between gap-3 py-4"><div><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-[#687783]">{item.note || dateLabel(item.createdAt)}</p></div><strong className={item.points < 0 ? "text-red-700" : "text-emerald-800"}>{item.points > 0 ? "+" : ""}{new Intl.NumberFormat("fa-IR").format(item.points)}</strong></li>)}</ul> : <p className="mt-3 rounded-2xl border border-dashed border-[#D8D0C4] bg-white p-6 text-sm text-[#687783]">هنوز سابقه امتیازی ثبت نشده است.</p>}
        </section>
      </>}
    </div>
  </main>;
}
