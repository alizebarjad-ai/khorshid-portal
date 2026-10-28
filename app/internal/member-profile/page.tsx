"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: string; fullName: string; memberType: string; membershipTier?: string; membershipGrade?: string;
  phone: string; email: string; city?: string; expertise?: string; biography?: string; status?: string;
};

export default function MemberProfilePage() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [city, setCity] = useState("");
  const [expertise, setExpertise] = useState("");
  const [biography, setBiography] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/member/profile", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (response.status === 401 || response.status === 403) { router.replace("/login"); return; }
        if (!response.ok) throw new Error(data.error || "دریافت پرونده ناموفق بود.");
        if (cancelled) return;
        const m = data.member as Member;
        setMember(m); setCity(m.city || ""); setExpertise(m.expertise || ""); setBiography(m.biography || "");
      })
      .catch(caught => { if (!cancelled) setError(caught instanceof Error ? caught.message : "دریافت پرونده ناموفق بود."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [router]);

  async function save(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setBusy(true);
    try {
      const response = await fetch("/api/member/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, expertise, biography }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ذخیره پرونده انجام نشد.");
      setMember(data.member); setNotice("اطلاعات تکمیلی پرونده ذخیره شد.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ذخیره پرونده انجام نشد.");
    } finally { setBusy(false); }
  }

  return <main dir="rtl" className="internal-app min-h-screen px-4 pb-16 pt-8 text-[#172F48] md:pt-12">
    <div className="container-site max-w-4xl">
      <a href="/internal/member-home" className="text-sm font-bold text-[#96763D]">← بازگشت به صفحه اصلی پرتال</a>
      <header className="mt-4 rounded-3xl bg-[#172F48] p-6 text-white md:p-8">
        <p className="text-sm font-bold text-[#D7B978]">پرونده شخصی</p>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">اطلاعات و تنظیمات حساب</h1>
        <p className="mt-3 text-sm leading-7 text-[#E6EAF0]">مشخصات هویتی و نوع عضویت فقط برای مشاهده است. برای اصلاح آن‌ها با معاونت اعضا هماهنگ کنید؛ اطلاعات تکمیلی زیر را خودتان می‌توانید ویرایش کنید.</p>
      </header>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      {loading ? <p className="mt-5 rounded-2xl bg-white p-8 text-center">در حال دریافت پرونده…</p> : member ? <>
        <section className="mt-5 rounded-2xl border border-[#E3E0D8] bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-extrabold">مشخصات عضویت</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["نام و نام خانوادگی", member.fullName],
              ["نوع عضو", member.memberType],
              ["نوع عضویت", member.membershipTier === "supporter_partner" ? "حامی مالی / شریک سازمانی" : "عضو وابسته"],
              ["رده عضویت", member.membershipGrade || "داوطلب"],
              ["شماره تماس", member.phone],
              ["ایمیل", member.email],
              ["وضعیت", member.status || "فعال"],
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-[#F7F5F0] p-3"><p className="text-xs text-[#687783]">{label}</p><p className="mt-1 break-words text-sm font-bold">{value || "ثبت نشده"}</p></div>)}
          </div>
        </section>
        <form onSubmit={save} className="mt-4 rounded-2xl border border-[#E3E0D8] bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-extrabold">اطلاعات تکمیلی قابل ویرایش</h2>
          <label className="mt-4 block text-sm font-bold">شهر
            <input className="mt-2 w-full rounded-xl border border-[#D8D0C4] px-3 py-3" value={city} onChange={event => setCity(event.target.value)} maxLength={120} />
          </label>
          <label className="mt-4 block text-sm font-bold">حوزه تخصصی
            <input className="mt-2 w-full rounded-xl border border-[#D8D0C4] px-3 py-3" value={expertise} onChange={event => setExpertise(event.target.value)} maxLength={240} />
          </label>
          <label className="mt-4 block text-sm font-bold">معرفی کوتاه
            <textarea className="mt-2 w-full rounded-xl border border-[#D8D0C4] px-3 py-3" rows={5} value={biography} onChange={event => setBiography(event.target.value)} maxLength={3000} />
          </label>
          <button disabled={busy} className="mt-5 rounded-xl bg-[#172F48] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "در حال ذخیره…" : "ذخیره تغییرات"}</button>
        </form>
        <a href="/internal/change-password" className="mt-4 inline-flex rounded-xl border border-[#D8D0C4] bg-white px-4 py-3 text-sm font-bold">رفتن به صفحه مستقل تغییر رمز عبور ←</a>
      </> : null}
    </div>
  </main>;
}
