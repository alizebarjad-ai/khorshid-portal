"use client";

import { useCallback, useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; title: string; kind: "text" | "image" | "video"; status: string; createdAt: string; description?: string; mediaNote?: string; adminNote?: string };
const statusLabels: Record<string, string> = {
  pending_media: "در انتظار بررسی معاون رسانه",
  approved_media: "تأیید معاون رسانه",
  rejected_media: "ردشده توسط معاون رسانه",
  forwarded_admin: "ارجاع‌شده به ادمین سایت",
  published: "ثبت انتشار توسط ادمین",
  rejected_admin: "ردشده توسط ادمین سایت",
};
const dateLabel = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date); };

export default function MemberContentPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [kind, setKind] = useState<"text" | "image" | "video">("text");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/member-content", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) { router.replace("/login"); return; }
      if (!response.ok) throw new Error(data.error || "دریافت سوابق محتوا ناموفق بود.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "دریافت سوابق محتوا ناموفق بود."); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    setError("");
    if (selected && selected.size > 25 * 1024 * 1024) {
      setError("حجم فایل باید حداکثر ۲۵ مگابایت باشد.");
      event.target.value = "";
      setFile(null);
      return;
    }
    if (selected && kind === "image" && !selected.type.startsWith("image/")) {
      setError("برای این نوع محتوا یک فایل تصویر انتخاب کنید.");
      event.target.value = "";
      setFile(null);
      return;
    }
    if (selected && kind === "video" && !selected.type.startsWith("video/")) {
      setError("برای این نوع محتوا یک فایل ویدیویی انتخاب کنید.");
      event.target.value = "";
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setNotice("");
    if (!title.trim()) { setError("عنوان محتوا را وارد کنید."); return; }
    if (kind === "text" && !text.trim()) { setError("متن محتوا را وارد کنید."); return; }
    if (kind !== "text" && !file) { setError("فایل موردنظر را انتخاب کنید."); return; }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("kind", kind); form.set("title", title.trim()); form.set("description", description.trim());
      if (kind === "text") form.set("text", text);
      else if (file) form.set("file", file);
      const response = await fetch("/api/member-content", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ارسال محتوا انجام نشد.");
      setTitle(""); setDescription(""); setText(""); setFile(null);
      setNotice("محتوا ارسال شد و در کارتابل معاون رسانه قرار گرفت.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ارسال محتوا انجام نشد."); }
    finally { setBusy(false); }
  }

  return <main dir="rtl" className="internal-app min-h-screen px-4 pb-16 pt-8 text-[#172F48] md:pt-12">
    <div className="container-site max-w-5xl">
      <a href="/internal/member-home" className="text-sm font-bold text-[#96763D]">← بازگشت به صفحه اصلی پرتال</a>
      <header className="mt-4 rounded-3xl bg-[#172F48] p-6 text-white md:p-8">
        <p className="text-sm font-bold text-[#D7B978]">بخش مستقل رسانه</p>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">ارسال محتوا و پیگیری</h1>
        <p className="mt-3 text-sm leading-7 text-[#E6EAF0]">متن، تصویر یا ویدیوی خود را ارسال کنید. وضعیت بررسی معاون رسانه و نتیجه ارجاع به ادمین سایت در همین صفحه قابل پیگیری است.</p>
      </header>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      <form onSubmit={submit} className="mt-5 rounded-2xl border border-[#E3E0D8] bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-extrabold">ثبت محتوای جدید</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">نوع محتوا
            <select className="mt-2 w-full rounded-xl border border-[#D8D0C4] bg-white px-3 py-3" value={kind} onChange={event => { setKind(event.target.value as typeof kind); setFile(null); }}>
              <option value="text">متن / یادداشت</option><option value="image">تصویر / عکس</option><option value="video">ویدیو</option>
            </select>
          </label>
          <label className="text-sm font-bold">عنوان محتوا
            <input className="mt-2 w-full rounded-xl border border-[#D8D0C4] px-3 py-3" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required />
          </label>
        </div>
        <label className="mt-4 block text-sm font-bold">توضیحات (اختیاری)
          <textarea className="mt-2 w-full rounded-xl border border-[#D8D0C4] px-3 py-3" rows={3} value={description} onChange={event => setDescription(event.target.value)} maxLength={3000} />
        </label>
        {kind === "text" ? <label className="mt-4 block text-sm font-bold">متن محتوا
          <textarea className="mt-2 w-full rounded-xl border border-[#D8D0C4] px-3 py-3" rows={7} value={text} onChange={event => setText(event.target.value)} maxLength={12000} required />
        </label> : <label className="mt-4 block text-sm font-bold">انتخاب فایل
          <input className="mt-2 block w-full rounded-xl border border-[#D8D0C4] px-3 py-3" type="file" accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/gif" : "video/mp4,video/webm,video/quicktime"} onChange={chooseFile} required />
          <span className="mt-2 block text-xs font-normal text-[#687783]">حداکثر ۲۵ مگابایت. قالب‌های مجاز تصویر: JPEG، PNG، WebP، GIF؛ ویدیو: MP4، WebM، QuickTime.</span>
          {file && <span className="mt-2 block text-xs text-[#687783]">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} مگابایت</span>}
        </label>}
        <button disabled={busy} className="mt-5 rounded-xl bg-[#172F48] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "در حال ارسال…" : "ارسال برای بررسی"}</button>
      </form>
      <section className="mt-7">
        <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold text-[#96763D]">سوابق</p><h2 className="mt-1 text-xl font-extrabold">محتواهای ارسالی من</h2></div><button onClick={() => { setLoading(true); void load(); }} className="rounded-xl border border-[#D8D0C4] bg-white px-3 py-2 text-xs font-bold">به‌روزرسانی</button></div>
        {loading ? <p className="mt-4 rounded-xl bg-white p-6">در حال دریافت سوابق…</p> : items.length ? <div className="mt-4 grid gap-3">{items.map(item => <article key={item.id} className="rounded-2xl border border-[#E3E0D8] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{item.title}</h3><p className="mt-1 text-xs text-[#687783]">{dateLabel(item.createdAt)} · {item.kind === "text" ? "متن" : item.kind === "image" ? "تصویر" : "ویدیو"}</p></div><span className="rounded-full bg-[#F0DFB8] px-3 py-1.5 text-xs font-bold">{statusLabels[item.status] || item.status}</span></div>
          {item.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#526173]">{item.description}</p>}
          {item.mediaNote && <p className="mt-3 rounded-xl bg-[#F7F5F0] p-3 text-sm leading-6">یادداشت معاون رسانه: {item.mediaNote}</p>}
          {item.adminNote && <p className="mt-3 rounded-xl bg-[#F7F5F0] p-3 text-sm leading-6">یادداشت ادمین سایت: {item.adminNote}</p>}
        </article>)}</div> : <p className="mt-4 rounded-2xl border border-dashed border-[#D8D0C4] bg-white p-8 text-center text-sm text-[#687783]">هنوز محتوایی ارسال نکرده‌اید.</p>}
      </section>
    </div>
  </main>;
}
