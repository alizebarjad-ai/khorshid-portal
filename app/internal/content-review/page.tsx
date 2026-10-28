"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardPathForRole } from "@/lib/dashboard-path";

type Item = {
  id: string;
  kind: "text" | "image" | "video";
  title: string;
  description: string;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  contentType?: string;
  size?: number;
  memberName: string;
  status: "pending_media" | "approved_media" | "rejected_media";
  createdAt: string;
  mediaNote?: string;
  forwardedAt?: string;
};
const statusLabels: Record<string, string> = {
  pending_media: "در انتظار بررسی رسانه",
  approved_media: "تأیید رسانه، آماده ارجاع",
  rejected_media: "رد شده توسط رسانه",
};
const dateLabel = (s: string) => {
  try { return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s)); }
  catch { return s; }
};
const inputClass = "w-full rounded-xl border border-[#D8D0C4] bg-white px-3 py-2.5 text-sm text-[#18304A] outline-none focus:border-[#B99450]";

export default function ContentReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const auth = await fetch("/api/auth/me", { cache: "no-store" });
      if (!auth.ok) { router.replace("/login"); return; }
      const session = await auth.json();
      if (session.user?.role !== "media") { router.replace("/internal"); return; }
      const response = await fetch("/api/member-content", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "دریافت کارتابل ناموفق بود.");
      setItems(body.items || []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "دریافت کارتابل ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function act(item: Item, action: "approve" | "reject" | "forward") {
    const note = (notes[item.id] || "").trim();
    if (action === "reject" && !note) { setError("برای رد محتوا، دلیل روشن بنویسید."); return; }
    if (action === "forward" && note.length < 20) { setError("برای ارجاع به ادمین سایت، توضیح انتشار دست‌کم ۲۰ نویسه‌ای بنویسید."); return; }
    setBusy(item.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/member-content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action, note }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "ثبت تصمیم انجام نشد.");
      setNotice(action === "forward" ? "محتوا به کارتابل ادمین سایت در سایت اصلی ارجاع شد." : "وضعیت محتوا ثبت شد.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ثبت تصمیم انجام نشد.");
    } finally { setBusy(""); }
  }

  async function remove(item: Item) {
    const confirmed = window.confirm("محتوای «" + item.title + "» و فایل پیوست آن از کارتابل معاون رسانه و فضای ذخیره‌سازی حذف شود؟ این اقدام قابل بازگشت نیست.");
    if (!confirmed) return;
    setBusy(item.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/member-content", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "حذف محتوا انجام نشد.");
      setItems(current => current.filter(entry => entry.id !== item.id));
      setNotice("محتوا و فایل پیوست آن از کارتابل رسانه و فضای ذخیره‌سازی حذف شدند.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "حذف محتوا انجام نشد.");
    } finally {
      setBusy("");
    }
  }

  const pending = items.filter(item => item.status === "pending_media").length;

  return (
    <main className="internal-app min-h-screen px-4 pb-16 pt-28 text-[#172F48]">
      <div className="container-site">
        <header className="rounded-3xl bg-[#172F48] p-6 text-white md:p-8">
          <a href="/internal/media-manager" className="inline-flex text-sm text-[#D7B978] underline-offset-4 hover:underline">← بازگشت به داشبورد معاونت رسانه</a>
          <h1 className="mt-3 text-3xl font-extrabold">کارتابل محتوای اعضا</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[#E6EAF0]">
            محتوای اعضا را بررسی کنید. پس از تأیید، آن را مستقیماً به کارتابل ادمین سایت در سایت اصلی خورشید مفاخر ارجاع دهید؛ این محتوا به مدیرعامل یا مالک پرتال ارسال نمی‌شود.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-xl bg-white/10 px-4 py-2">کل موارد: {items.length}</span>
            <span className="rounded-xl bg-white/10 px-4 py-2">در انتظار بررسی: {pending}</span>
          </div>
        </header>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><p>{notice}</p>{notice.includes("کارتابل ادمین") && <a href="/internal/media-manager" className="rounded-xl bg-[#172F48] px-4 py-2 font-bold text-white">بازگشت به داشبورد معاونت رسانه</a>}</div>}
        {loading ? <p className="mt-6 rounded-2xl bg-white p-6">در حال دریافت محتوا…</p> :
          !items.length ? <p className="mt-6 rounded-2xl border border-dashed border-[#D8D0C4] bg-white p-8 text-center">فعلاً محتوایی در کارتابل رسانه نیست.</p> :
          <div className="mt-6 grid gap-4">
            {items.map(item => <article key={item.id} className="rounded-2xl border border-[#E3E0D8] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-lg font-extrabold">{item.title}</h2><p className="mt-1 text-xs text-[#687783]">فرستنده: {item.memberName} · {dateLabel(item.createdAt)} · {item.kind === "image" ? "تصویر" : item.kind === "video" ? "ویدیو" : "متن"}</p></div>
                <span className="rounded-full bg-[#F0DFB8] px-3 py-1.5 text-xs font-bold">{statusLabels[item.status] || item.status}</span>
              </div>
              {item.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#526173]">{item.description}</p>}
              {item.text && <div className="mt-4 whitespace-pre-wrap rounded-xl bg-[#F7F5F0] p-4 text-sm leading-7">{item.text}</div>}
              {item.fileUrl && <div className="mt-4"><p className="mb-2 break-all text-xs text-[#687783]">{item.fileName} · {((item.size || 0) / 1024 / 1024).toFixed(2)} MB</p>{item.kind === "image" ? <a href={item.fileUrl} target="_blank" rel="noopener noreferrer"><img src={item.fileUrl} alt={item.title} className="max-h-[480px] rounded-xl border border-[#E3E0D8] object-contain" /></a> : <video src={item.fileUrl} controls className="max-h-[480px] w-full rounded-xl bg-black" />}<p className="mt-2"><a className="text-sm font-bold text-[#80652F] underline" href={item.fileUrl} target="_blank" rel="noopener noreferrer">بازکردن فایل اصلی ↗</a></p></div>}
              {item.kind !== "text" && !item.fileUrl && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">برای این محتوا فایل قابل دریافت ثبت نشده است. اگر فایل هنگام ارسال بارگذاری شده، این پرونده را حذف نکنید؛ مسیر ذخیره‌سازی باید بررسی شود.</p>}
              {item.mediaNote && <p className="mt-3 rounded-xl bg-[#F7F5F0] p-3 text-sm leading-6">یادداشت رسانه: {item.mediaNote}</p>}
              {item.status === "pending_media" && <div className="mt-4 grid gap-3">
                <label className="text-sm font-bold">یادداشت بررسی یا دلیل رد<textarea className={inputClass + " mt-2"} rows={3} maxLength={3000} value={notes[item.id] || ""} onChange={e => setNotes(old => ({ ...old, [item.id]: e.target.value }))} placeholder="نکات اصلاحی یا دلیل رد محتوا" /></label>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy === item.id} onClick={() => void act(item, "approve")} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">تأیید محتوا</button>
                  <button disabled={busy === item.id} onClick={() => void act(item, "reject")} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-800 disabled:opacity-50">رد با توضیح</button>
                </div>
              </div>}
              {item.status === "approved_media" && <div className="mt-4"><label className="block text-sm font-bold">توضیح انتشار برای ادمین سایت<textarea className={inputClass + " mt-2"} rows={3} maxLength={3000} value={notes[item.id] || item.mediaNote || ""} onChange={e => setNotes(old => ({ ...old, [item.id]: e.target.value }))} placeholder="پیشنهاد عنوان، کپشن، دسته‌بندی و اعتبار صاحب اثر" /></label><button disabled={busy === item.id || (notes[item.id] || "").trim().length < 20} onClick={() => void act(item, "forward")} className="mt-3 rounded-xl bg-[#172F48] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">ارجاع به ادمین سایت در سایت اصلی</button><p className="mt-2 text-xs leading-6 text-[#687783]">برای جلوگیری از ارجاع ناقص، توضیح انتشار حداقل ۲۰ نویسه‌ای الزامی است.</p></div>}
              {<div className="mt-4 flex justify-end border-t border-[#E3E0D8] pt-4"><button type="button" disabled={busy === item.id} onClick={() => void remove(item)} className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-800 disabled:opacity-50">{busy === item.id ? "در حال انجام…" : "حذف محتوا و فایل پیوست"}</button></div>}
            </article>)}
          </div>}
      </div>
    </main>
  );
}
