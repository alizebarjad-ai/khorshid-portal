"use client";

import { useEffect, useState } from "react";

type Role =
  | "ceo"
  | "deputy"
  | "economic"
  | "csr"
  | "media"
  | "artists"
  | "education"
  | "members";

const ROLE_LABEL: Record<Role, string> = {
  ceo: "مدیرعامل",
  deputy: "قائم‌مقام و معاون برنامه‌ریزی و راهبردی",
  economic: "معاونت توسعه مشارکت‌های اقتصادی",
  csr: "معاونت اجتماعی برنامه‌های حمایتی",
  media: "معاونت رسانه و محتوا",
  artists: "معاونت امور هنرمندان",
  education: "معاونت آموزش، پژوهش و نوآوری",
  members: "معاونت مفاخر و امور اعضا",
};

export default function InternalHomePage() {
  const [user, setUser] = useState<{ name: string; role: Role } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!data.user || data.user.role === "finance" || data.user.role === "beneficiary") {
          location.href = data.user?.role === "finance" ? "/internal/project-rewards" : "/login";
          return;
        }
        setUser(data.user);
      } catch {
        location.href = "/login";
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  if (loading || !user) {
    return (
      <main className="internal-app min-h-screen px-4 pb-16 pt-28">
        <div className="container-site rounded-3xl bg-white p-8 text-center text-[#18304A]">
          در حال بررسی دسترسی...
        </div>
      </main>
    );
  }

  return (
    <main className="internal-app min-h-screen px-4 pb-16 pt-28">
      <div className="container-site">
        <header className="rounded-3xl bg-[#18304A] p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm font-bold text-[#F2A900]">سامانه داخلی خورشید</p>
              <h1 className="mt-2 text-3xl font-extrabold">صفحه اصلی سامانه</h1>
              <p className="mt-2 text-sm text-[#E6EAF0]">
                {user.name} · {ROLE_LABEL[user.role]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/" className="rounded-xl border border-white/20 bg-white px-4 py-2.5 text-sm font-extrabold text-[#18304A] hover:bg-[#FFF4D6]">
                ← سایت اصلی خورشید
              </a>
              <button onClick={logout} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15">
                خروج از حساب
              </button>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
          <a href="/internal/opportunities" className="group rounded-3xl bg-white p-7 shadow-sm ring-1 ring-[#D8D0C4] transition hover:-translate-y-1">
            <p className="text-sm font-bold text-[#B07800]">گردش کار</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#18304A]">فرصت‌ها و پروژه‌ها</h2>
            <p className="mt-3 text-sm leading-7 text-[#596474]">
              مشاهده و پیگیری پیشنهادها، پرونده‌ها و مراحل گردش کار مرتبط با نقش شما.
            </p>
            <span className="mt-6 inline-flex rounded-xl bg-[#F2A900] px-5 py-3 text-sm font-extrabold text-[#18304A]">
              ورود به مدیریت پیشنهادها ←
            </span>
          </a>

          <div className="rounded-3xl bg-[#18304A] p-7 text-white shadow-sm">
            <p className="text-sm font-bold text-[#F2A900]">دسترسی شما</p>
            <h2 className="mt-2 text-2xl font-extrabold">{ROLE_LABEL[user.role]}</h2>
            <p className="mt-3 text-sm leading-7 text-[#E6EAF0]">
              بخش‌های سامانه بر اساس نقش کاربر نمایش داده می‌شوند. اطلاعات مالی و سامانه پاداش از این صفحه جدا نگه داشته شده است.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
