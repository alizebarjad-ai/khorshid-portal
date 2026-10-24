"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AuditEvent = { id: string; kind: "member" | "club"; recordId: string; recordName: string; action: "create" | "update" | "delete"; actor: string; occurredAt: string };
const actionLabel: Record<string, string> = { create: "ایجاد", update: "ویرایش", delete: "حذف" };
const kindLabel: Record<string, string> = { member: "عضو", club: "باشگاه" };
export default function RecordHistoryPage() {
  const router = useRouter();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("all");
  const [action, setAction] = useState("all");
  const [query, setQuery] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/records/history?limit=300", { cache: "no-store" });
        const data = await response.json();
        if (response.status === 401) { router.push("/login"); return; }
        if (!response.ok) throw new Error(data.error || "دریافت سوابق ناموفق بود.");
        if (!cancelled) setEvents(data.events || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "خطا در دریافت سوابق");
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [router]);
  const filtered = events.filter(e => (kind === "all" || e.kind === kind) && (action === "all" || e.action === action) && (!query || [e.recordName, e.actor].some(v => String(v || "").toLowerCase().includes(query.toLowerCase()))));
  return <main className="internal-app min-h-screen px-4 pb-16 pt-28 text-[#18304A]"><div className="container-site">
    <header className="rounded-3xl bg-[#18304A] p-6 text-white md:p-8">
      <div className="flex flex-wrap gap-4"><a href="/internal/members" className="text-sm text-[#F2A900]">← پرونده اعضا</a><a href="/internal/clubs" className="text-sm text-[#F2A900]">مدیریت باشگاه‌ها</a></div>
      <h1 className="mt-3 text-3xl font-extrabold">سوابق تغییرات</h1>
      <p className="mt-2 text-sm leading-7 text-[#E6EAF0]">ثبت زمان و عامل ایجاد، ویرایش و حذف پرونده‌های اعضا و باشگاه‌ها. حداکثر ۳۰۰ رویداد اخیر نمایش داده می‌شود.</p>
      <div className="mt-5 inline-flex rounded-xl bg-white/10 px-4 py-2">رویدادهای ثبت‌شده: {events.length}</div>
    </header>
    <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#D8D0C4] md:p-6">
      <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
        <input className="w-full rounded-xl border border-[#D8D0C4] bg-white px-3 py-2.5 text-sm text-[#18304A]" placeholder="جست‌وجوی نام پرونده یا کاربر..." value={query} onChange={e => setQuery(e.target.value)} />
        <select className="w-full rounded-xl border border-[#D8D0C4] bg-white px-3 py-2.5 text-sm" value={kind} onChange={e => setKind(e.target.value)}><option value="all">همه پرونده‌ها</option><option value="member">اعضا</option><option value="club">باشگاه‌ها</option></select>
        <select className="w-full rounded-xl border border-[#D8D0C4] bg-white px-3 py-2.5 text-sm" value={action} onChange={e => setAction(e.target.value)}><option value="all">همه تغییرات</option><option value="create">ایجاد</option><option value="update">ویرایش</option><option value="delete">حذف</option></select>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading ? <p className="py-10 text-center text-sm">در حال دریافت سوابق…</p> : filtered.length === 0 ? <p className="py-10 text-center text-sm text-[#596474]">سابقه‌ای مطابق فیلترها پیدا نشد.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-right text-sm"><thead><tr className="border-b border-[#E5DED3] text-[#596474]"><th className="px-3 py-3">زمان</th><th className="px-3 py-3">عملیات</th><th className="px-3 py-3">نوع پرونده</th><th className="px-3 py-3">نام پرونده</th><th className="px-3 py-3">کاربر</th></tr></thead><tbody>{filtered.map(e => <tr key={e.id} className="border-b border-[#F0EBE4] last:border-0"><td className="whitespace-nowrap px-3 py-3">{new Date(e.occurredAt).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })}</td><td className="px-3 py-3">{actionLabel[e.action] || e.action}</td><td className="px-3 py-3">{kindLabel[e.kind] || e.kind}</td><td className="px-3 py-3 font-bold">{e.recordName}</td><td className="px-3 py-3">{e.actor}</td></tr>)}</tbody></table></div>}
    </section>
  </div></main>;
}
