"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Member = { fullName: string; memberType: string; membershipTier?: string; membershipGrade?: string; status?: string };
type Summary = { pointsBalance: number; programs: unknown[]; pointEvents: unknown[] };
type ContentItem = { id: string; status: string };

const cards = [
  { href: "/internal/member-activity", eyebrow: "باشگاه و مشارکت", title: "برنامه‌ها و باشگاه‌های من", description: "برنامه‌های منتشرشده، باشگاه‌های متصل به پرونده و خلاصه امتیازها را در صفحه‌ای مستقل ببینید.", icon: "◎" },
  { href: "/internal/member-content", eyebrow: "رسانه", title: "ارسال محتوا و پیگیری", description: "ارسال متن، تصویر یا ویدیو و مشاهده وضعیت بررسی معاونت رسانه و ادمین سایت.", icon: "↗" },
  { href: "/internal/member-profile", eyebrow: "پرونده شخصی", title: "اطلاعات و تنظیمات حساب", description: "مشاهده مشخصات عضویت و ویرایش اطلاعات تکمیلی پرونده.", icon: "◇" },
  { href: "/internal/member-upgrades", eyebrow: "توسعه حرفه‌ای", title: "درخواست ارتقای عضویت", description: "ثبت یا پیگیری درخواست هنرمند یا متخصص و مدارک مرتبط.", icon: "✦" },
  { href: "/internal/change-password", eyebrow: "امنیت", title: "تغییر رمز عبور", description: "مدیریت رمز شخصی حساب کاربری.", icon: "⌑" },
];

export default function MemberHomePage() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [summary, setSummary] = useState<Summary>({ pointsBalance: 0, programs: [], pointEvents: [] });
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [profileRes, dashboardRes, contentRes] = await Promise.all([
          fetch("/api/member/profile", { cache: "no-store" }),
          fetch("/api/member/dashboard", { cache: "no-store" }),
          fetch("/api/member-content", { cache: "no-store" }),
        ]);
        if (profileRes.status === 401 || profileRes.status === 403) { router.replace("/login"); return; }
        const profile = await profileRes.json();
        if (!profileRes.ok) throw new Error(profile.error || "دریافت پرونده ناموفق بود.");
        const dash = dashboardRes.ok ? await dashboardRes.json() : {};
        const content = contentRes.ok ? await contentRes.json() : {};
        if (cancelled) return;
        setMember(profile.member);
        setSummary({
          pointsBalance: Number(dash.pointsBalance) || 0,
          programs: Array.isArray(dash.programs) ? dash.programs : [],
          pointEvents: Array.isArray(dash.pointEvents) ? dash.pointEvents : [],
        });
        setContentItems(Array.isArray(content.items) ? content.items : []);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "دریافت اطلاعات پرتال ناموفق بود.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [router]);

  async function logout() {
    setLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.replace("/login"); router.refresh(); }
  }

  return <main dir="rtl" className="internal-app min-h-screen px-4 pb-16 pt-8 text-[#172F48] md:pt-12">
    <div className="container-site max-w-6xl">
      <header className="rounded-3xl bg-[#172F48] p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#D7B978]">باشگاه اعضای خورشید مفاخر</p>
            <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">{member ? "سلام " + member.fullName : "صفحه اصلی پرتال اعضا"}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#E6EAF0]">نمای کلی حساب و دسترسی سریع به بخش‌های مستقل. جزئیات، فرم‌ها و تنظیمات در صفحه اصلی انباشته نشده‌اند.</p>
          </div>
          <div className="flex gap-2">
            <a href="https://www.khorshid-mafakher.ir/" className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-white">وب‌سایت اصلی ↗</a>
            <button onClick={logout} disabled={loggingOut} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#172F48] disabled:opacity-50">{loggingOut ? "در حال خروج…" : "خروج"}</button>
          </div>
        </div>
        {member && <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">{member.memberType || "عضو"}</span>
          <span className="rounded-full bg-[#F0DFB8] px-3 py-1.5 text-xs font-bold text-[#172F48]">{member.membershipTier === "supporter_partner" ? "حامی مالی / شریک سازمانی" : "عضو وابسته"}</span>
          <span className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold">{member.membershipGrade || "داوطلب"}</span>
        </div>}
      </header>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading ? <div className="mt-5 rounded-2xl border border-[#E3E0D8] bg-white p-8 text-center">در حال دریافت خلاصه حساب…</div> : <>
        <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[{ label: "برنامه‌های من", value: summary.programs.length }, { label: "موجودی امتیاز", value: summary.pointsBalance }, { label: "سوابق امتیاز", value: summary.pointEvents.length }, { label: "محتواهای ارسالی", value: contentItems.length }].map(item =>
            <article key={item.label} className="rounded-2xl border border-[#E3E0D8] bg-white p-4 shadow-sm">
              <span className="text-xs text-[#687783]">{item.label}</span>
              <strong className="mt-2 block text-2xl">{new Intl.NumberFormat("fa-IR").format(item.value)}</strong>
            </article>
          )}
        </section>
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(card => <a key={card.href} href={card.href} className="group rounded-2xl border border-[#E3E0D8] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#B99450]">
            <div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#F7F5F0] text-xl text-[#96763D]">{card.icon}</span><span className="text-lg text-[#B99450]">↗</span></div>
            <p className="mt-4 text-xs font-bold text-[#96763D]">{card.eyebrow}</p>
            <h2 className="mt-1 text-lg font-extrabold">{card.title}</h2>
            <p className="mt-2 text-sm leading-7 text-[#687783]">{card.description}</p>
            <span className="mt-4 inline-flex rounded-lg bg-[#F0DFB8] px-3 py-2 text-xs font-extrabold text-[#172F48]">ورود به بخش ←</span>
          </a>)}
        </section>
      </>}
    </div>
  </main>;
}
