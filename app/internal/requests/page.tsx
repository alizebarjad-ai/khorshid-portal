"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RequestItem = {
  id: string;
  type: string;
  requestType?: string | null;
  audience?: string | null;
  name: string;
  phone: string;
  email: string;
  organization?: string | null;
  role?: string | null;
  subject?: string | null;
  area?: string | null;
  budget?: string | null;
  message: string;
  assignedUnit?: string | null;
  reviewStatus?: string | null;
  reviewFeedback?: string | null;
  createdAt: string;
  updatedAt: string;
  reviewHistory?: { action: string; actor?: string; at?: string; feedback?: string; assignedUnit?: string }[] | null;
  documents?: { id: string; kind: string; fileName: string; mimeType: string; size: number }[];
};

const unitOptions = [
  ["economic", "توسعه مشارکت‌های اقتصادی"],
  ["csr", "برنامه‌های اجتماعی و مسئولیت اجتماعی"],
  ["media", "رسانه و محتوا"],
  ["artists", "امور هنرمندان"],
  ["education", "آموزش، پژوهش و نوآوری"],
  ["members", "مفاخر و امور اعضا"],
  ["deputy", "ارجاع مرکزی / قائم‌مقام"],
];
const requestLabels: Record<string, string> = {
  collaboration: "همکاری در فعالیت‌ها",
  organization: "همکاری سازمانی و مسئولیت اجتماعی",
  support: "حمایت و اسپانسرینگ",
  "project-proposal": "پیشنهاد پروژه یا ایده",
  media: "همکاری رسانه‌ای و تولید محتوا",
  "public-contact": "ارتباط عمومی",
  other: "سایر درخواست‌ها",
};
const statusLabels: Record<string, string> = {
  new: "تازه‌وارد",
  resubmitted: "ارسال مجدد",
  in_review: "در حال بررسی",
  needs_revision: "نیازمند تکمیل",
  completed: "بسته‌شده",
  rejected: "رد نهایی",
};
const fieldClass = "mt-1 w-full rounded-xl border border-[#D8D0C4] bg-white px-3 py-2.5 text-sm text-[#18304A]";

export default function GeneralRequestsPage() {
  const router = useRouter();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [assignedUnit, setAssignedUnit] = useState("deputy");
  const [feedback, setFeedback] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [userRole, setUserRole] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/requests", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) { router.push("/login"); return; }
      if (!response.ok) throw new Error(data.error || "دریافت کارتابل ناموفق بود.");
      const next = (data.items || []) as RequestItem[];
      setUserRole(data.userRole || "");
      setItems(next);
      setSelectedId((current) => current && next.some((item) => item.id === current) ? current : (next[0]?.id || ""));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت کارتابل ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => items.filter((item) => {
    const searchText = [item.name, item.phone, item.email, item.organization || "", item.subject || "", item.area || ""].join(" ").toLowerCase();
    const matches = !query || searchText.includes(query.toLowerCase());
    const closed = ["completed", "rejected"].includes(item.reviewStatus || "");
    return matches && (status === "all" || (status === "open" ? !closed : item.reviewStatus === status));
  }), [items, query, status]);
  const selected = items.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!selected) return;
    setAssignedUnit(selected.assignedUnit || "deputy");
    setFeedback(selected.reviewFeedback || "");
  }, [selectedId, selected?.updatedAt]);

  async function act(action: string) {
    if (!selected) return;
    if (["complete", "request-revision"].includes(action) && !feedback.trim()) {
      setError(action === "complete" ? "برای بستن درخواست، خلاصه اقدام یا نتیجه پیگیری را ثبت کنید." : "برای درخواست تکمیل، موارد موردنیاز را روشن بنویسید.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action, assignedUnit, feedback }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ثبت تغییرات انجام نشد.");
      setNotice(action === "assign" ? "درخواست به واحد انتخاب‌شده ارجاع شد." : action === "complete" ? "درخواست بسته و نتیجه ثبت شد." : "درخواست به وضعیت بررسی منتقل شد.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت تغییرات انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="internal-app min-h-screen px-4 pb-16 pt-28 text-[#18304A]"><div className="container-site">
    <header className="rounded-3xl bg-[#18304A] p-6 text-white md:p-8">
      <a href="/internal/roles/members" className="text-sm text-[#F2A900]">← بازگشت به داشبورد</a>
      <h1 className="mt-3 text-3xl font-extrabold">کارتابل درخواست‌های عمومی</h1>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-[#E6EAF0]">درخواست‌های حمایت، مسئولیت اجتماعی، پیشنهاد پروژه، همکاری هنری و رسانه‌ای در این کارتابل مدیریت می‌شوند. درخواست عضویت در کارتابل اختصاصی معاونت اعضا باقی می‌ماند.</p>
      <div className="mt-5 flex flex-wrap gap-3"><span className="rounded-xl bg-white/10 px-4 py-2">درخواست‌های این کارتابل: {items.length}</span><a href="/internal/membership-requests" className="rounded-xl border border-white/30 px-4 py-2 font-bold">کارتابل عضویت</a>{["finance", "csr", "media", "economic", "artists", "education"].includes(userRole) && <button type="button" onClick={async () => { if (!window.confirm("فقط درخواست‌های بسته‌شده یا ردشده این واحد که دست‌کم ۱۸۰ روز از ثبتشان گذشته حذف می‌شوند. این کار قابل بازگشت نیست. ادامه می‌دهید؟")) return; setBusy(true); setError(""); setNotice(""); try { const response = await fetch("/api/requests", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ olderThanDays: 180 }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "پاک‌سازی انجام نشد."); setNotice("پاک‌سازی انجام شد؛ تعداد پرونده‌های حذف‌شده: " + (data.deletedCount ?? 0)); await load(); } catch (e) { setError(e instanceof Error ? e.message : "پاک‌سازی انجام نشد."); } finally { setBusy(false); } }} disabled={busy} className="rounded-xl border border-red-300/50 px-4 py-2 font-bold text-red-100 disabled:opacity-50">پاک‌سازی درخواست‌های بسته‌شده قدیمی (۱۸۰ روز+)</button>}</div>
    </header>
    {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(300px,0.75fr)_minmax(0,1.5fr)]">
      <aside className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#D8D0C4]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <input className={fieldClass + " mt-0"} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجو با نام، تلفن، ایمیل یا موضوع" />
          <select className={fieldClass + " mt-0"} value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">نیازمند اقدام</option><option value="all">همه درخواست‌ها</option><option value="new">تازه‌وارد</option><option value="in_review">در حال بررسی</option><option value="needs_revision">نیازمند تکمیل</option><option value="completed">بسته‌شده</option><option value="rejected">رد نهایی</option></select>
        </div>
        {loading ? <p className="p-6 text-sm">در حال دریافت درخواست‌ها…</p> : <div className="mt-4 space-y-2">{filtered.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={"w-full rounded-2xl border p-4 text-right " + (selectedId === item.id ? "border-[#B07800] bg-[#FFF8E8]" : "border-[#E4DED4] hover:bg-[#F8F6F1]")}><div className="flex items-start justify-between gap-2"><span className="font-extrabold">{item.name}</span><span className="rounded-full bg-[#EEECE6] px-2 py-1 text-[11px]">{statusLabels[item.reviewStatus || "new"] || item.reviewStatus}</span></div><p className="mt-2 text-xs text-[#5F6D79]">{requestLabels[item.requestType || ""] || item.requestType || "درخواست عمومی"}</p><p className="mt-1 text-xs text-[#5F6D79]">{item.phone} · {item.email}</p><p className="mt-1 text-xs text-[#5F6D79]">{new Date(item.createdAt).toLocaleDateString("fa-IR")}</p></button>)}{!filtered.length && <p className="p-6 text-sm text-[#66717A]">درخواستی با این فیلتر پیدا نشد.</p>}</div>}
      </aside>
      <div className="min-w-0">
        {selected ? <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#D8D0C4] md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-extrabold">{selected.subject || requestLabels[selected.requestType || ""] || "درخواست عمومی"}</h2><p className="mt-2 text-sm text-[#5F6D79]">{selected.name} · شناسه: {selected.id}</p></div><span className="rounded-full bg-[#EEECE6] px-3 py-1 text-xs">{statusLabels[selected.reviewStatus || "new"] || selected.reviewStatus}</span></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["نوع درخواست", requestLabels[selected.requestType || ""] || selected.requestType], ["واحد مسئول", unitOptions.find(([value]) => value === selected.assignedUnit)?.[1] || selected.assignedUnit], ["تلفن", selected.phone], ["ایمیل", selected.email], ["مجموعه", selected.organization], ["سمت", selected.role], ["حوزه", selected.area], ["برآورد همکاری", selected.budget]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#F7F5F0] p-3"><p className="text-xs text-[#65717B]">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value || "ثبت نشده"}</p></div>)}</div>
          <div className="mt-4 rounded-2xl bg-[#F7F5F0] p-4"><h3 className="font-extrabold">شرح درخواست</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{selected.message || "توضیحی ثبت نشده است."}</p></div>
          {!!selected.documents?.length && <div className="mt-4 rounded-2xl border border-[#E4DED4] p-4"><h3 className="font-extrabold">مدارک پیوست</h3><div className="mt-3 space-y-2">{selected.documents.map((doc) => <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#F7F5F0] p-3"><div><p className="text-sm font-bold">{doc.fileName}</p><p className="text-xs text-[#65717B]">{Math.ceil(doc.size / 1024)} کیلوبایت</p></div><a href={"/api/requests/" + selected.id + "/documents/" + doc.id} className="rounded-lg border border-[#D8D0C4] px-3 py-2 text-sm font-bold">دریافت فایل</a></div>)}</div></div>}
          {!!selected.reviewHistory?.length && <div className="mt-5 rounded-2xl border border-[#E4DED4] p-4"><h3 className="font-extrabold">سوابق اقدام</h3><div className="mt-3 space-y-3">{selected.reviewHistory.map((event, index) => <div key={index} className="border-r-2 border-[#D8D0C4] pr-3"><p className="text-sm font-bold">{event.action}</p><p className="mt-1 text-xs text-[#65717B]">{event.actor || "سامانه"}{event.at ? " · " + new Date(event.at).toLocaleString("fa-IR") : ""}</p>{event.feedback && <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{event.feedback}</p>}</div>)}</div></div>}
          <div className="mt-6 border-t border-[#E4DED4] pt-5">
            <h3 className="text-lg font-extrabold">اقدام مسئول درخواست</h3>
            <label className="mt-4 block text-sm font-bold">ارجاع به واحد مسئول<select className={fieldClass} value={assignedUnit} onChange={(e) => setAssignedUnit(e.target.value)}>{unitOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button disabled={busy} onClick={() => void act("assign")} className="mt-3 rounded-xl border border-[#D8D0C4] px-4 py-3 font-bold disabled:opacity-50">ارجاع / تغییر واحد مسئول</button>
            <label className="mt-4 block text-sm font-bold">خلاصه اقدام یا نتیجه پیگیری<textarea className={fieldClass + " min-h-32"} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="نتیجه تماس، جلسه، بررسی یا اقدام انجام‌شده را ثبت کنید." /></label>
            <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={() => void act("request-revision")} className="rounded-xl border border-[#D8D0C4] px-4 py-3 font-bold disabled:opacity-50">درخواست تکمیل از متقاضی</button><button disabled={busy} onClick={() => void act("mark-in-review")} className="rounded-xl bg-[#FFF0C2] px-4 py-3 font-bold text-[#654300] disabled:opacity-50">شروع / ادامه بررسی</button><button disabled={busy} onClick={() => { if (window.confirm("درخواست با این خلاصه اقدام بسته شود؟")) void act("complete"); }} className="rounded-xl bg-[#F2A900] px-4 py-3 font-extrabold text-[#18304A] disabled:opacity-50">ثبت نتیجه و بستن درخواست</button>{["completed", "rejected"].includes(selected.reviewStatus || "") && <button disabled={busy} onClick={async () => { if (!window.confirm("این درخواست بسته‌شده برای همیشه حذف می‌شود و مدارک پیوست آن نیز پاک می‌شوند. ادامه می‌دهید؟")) return; setBusy(true); setError(""); setNotice(""); try { const response = await fetch("/api/requests", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "حذف درخواست انجام نشد."); setNotice("درخواست بسته‌شده حذف شد."); await load(); } catch (e) { setError(e instanceof Error ? e.message : "حذف درخواست انجام نشد."); } finally { setBusy(false); } }} className="rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 font-bold text-red-800 disabled:opacity-50">حذف این درخواست بسته‌شده</button>}</div>
            <p className="mt-3 text-xs leading-6 text-[#65717B]">ارجاع به واحد دیگر فقط برای مدیرعامل و قائم‌مقام مجاز است. واحد مسئول می‌تواند روند بررسی و نتیجه را ثبت کند.</p>
          </div>
        </section> : <section className="rounded-3xl bg-white p-8 text-sm">برای مشاهده جزئیات، یک درخواست را از فهرست انتخاب کنید.</section>}
      </div>
    </section>
  </div></main>;
}
