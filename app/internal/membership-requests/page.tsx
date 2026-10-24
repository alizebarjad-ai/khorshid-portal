"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Document = { id: string; kind: string; fileName: string; mimeType: string; size: number };
type Application = {
  id: string; name: string; phone: string; email: string; city?: string | null;
  artField?: string | null; area?: string | null; organization?: string | null; role?: string | null;
  audience?: string | null; message: string; nationalId?: string | null; birthDate?: string | null;
  education?: string | null; educationField?: string | null; address?: string | null; postalCode?: string | null;
  requestType?: string | null; requestedMembershipType?: string | null; reviewStatus?: string; membershipTier?: string | null;
  supplementalData?: Record<string, string> | null; reviewFeedback?: string | null;
  reviewedBy?: string | null; reviewHistory?: { action: string; actor?: string; at?: string; feedback?: string; membershipTier?: string }[]; createdAt: string; updatedAt: string; documents: Document[];
};
const tiers = [
  { value: "affiliate", label: "عضو وابسته", description: "مشارکت در برنامه‌ها، باشگاه‌ها و فعالیت‌های داوطلبانه" },
  { value: "professional", label: "عضو حرفه‌ای / تخصصی", description: "پرونده تخصص، آثار، سوابق و فرصت‌های همکاری حرفه‌ای" },
  { value: "supporter_partner", label: "حامی مالی / شریک سازمانی", description: "ثبت ظرفیت حمایت، همکاری سازمانی و مسئولیت اجتماعی" },
];
const statuses: Record<string, string> = { new: "تازه‌وارد", resubmitted: "ارسال مجدد", in_review: "در حال بررسی", needs_revision: "نیازمند تکمیل", rejected: "ردشده", approved: "تأییدشده" };
const fieldClass = "mt-1 w-full rounded-xl border border-[#D8D0C4] bg-white px-3 py-2.5 text-sm text-[#18304A]";

export default function MembershipRequestsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tier, setTier] = useState("affiliate");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/membership-requests", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) { router.push("/login"); return; }
      if (!response.ok) throw new Error(data.error || "دریافت کارتابل ناموفق بود.");
      const next = (data.items || []) as Application[];
      setItems(next);
      setSelectedId((current) => current && next.some((item) => item.id === current) ? current : (next[0]?.id || ""));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "دریافت کارتابل ناموفق بود."); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => items.filter((item) => {
    const matches = !query || [item.name, item.phone, item.email, item.organization || "", item.nationalId || ""].some((value) => value.toLowerCase().includes(query.toLowerCase()));
    const open = !["approved", "rejected"].includes(item.reviewStatus || "new");
    return matches && (status === "all" || (status === "open" ? open : item.reviewStatus === status));
  }), [items, query, status]);
  const selected = items.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!selected) return;
    setTier(selected.membershipTier || selected.requestedMembershipType || "affiliate");
    setExtra((selected.supplementalData || {}) as Record<string, string>);
    setFeedback(selected.reviewFeedback || "");
  }, [selectedId, selected?.updatedAt]);

  async function act(action: string, more: Record<string, unknown> = {}) {
    if (!selected) return;
    if ((action === "request-revision" || action === "reject") && !feedback.trim()) {
      setError("برای بازگرداندن یا رد درخواست، دلیل روشن یا فهرست موارد موردنیاز را بنویسید.");
      return;
    }
    if (action === "approve" && !selected.membershipTier && !tier) {
      setError("ابتدا نوع عضویت را تعیین کنید.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      if (action === "set-type") {
        const save = await fetch("/api/membership-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, action, membershipTier: tier, supplementalData: extra }) });
        const saveData = await save.json();
        if (!save.ok) throw new Error(saveData.error || "ذخیره فرم تکمیلی ناموفق بود.");
      } else {
        if (action === "approve" && selected.reviewStatus !== "approved") {
          const typeResponse = await fetch("/api/membership-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, action: "set-type", membershipTier: tier, supplementalData: extra }) });
          const typeData = await typeResponse.json();
          if (!typeResponse.ok) throw new Error(typeData.error || "ذخیره نوع عضویت پیش از تأیید ناموفق بود.");
        }
        const response = await fetch("/api/membership-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, action, feedback, membershipTier: tier, supplementalData: extra, ...more }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "ثبت تصمیم ناموفق بود.");
      }
      setNotice(action === "set-type" ? "نوع عضویت و فرم تکمیلی ذخیره شد." : action === "request-revision" ? "درخواست تکمیل برای متقاضی ارسال شد." : action === "reject" ? "درخواست رد و نتیجه برای متقاضی ارسال شد." : "درخواست تأیید و پرونده عضو ایجاد یا به‌روزرسانی شد.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "ثبت تصمیم ناموفق بود."); }
    finally { setBusy(false); }
  }

  function field(label: string, key: string, placeholder = "") {
    return <label key={key} className="block text-sm font-bold">{label}<input className={fieldClass} value={extra[key] || ""} placeholder={placeholder} onChange={(event) => setExtra((current) => ({ ...current, [key]: event.target.value }))} /></label>;
  }

  return <main className="internal-app min-h-screen px-4 pb-16 pt-28 text-[#18304A]"><div className="container-site">
    <header className="rounded-3xl bg-[#18304A] p-6 text-white md:p-8">
      <a href="/internal/roles/members" className="text-sm text-[#F2A900]">← بازگشت به داشبورد اعضا</a>
      <h1 className="mt-3 text-3xl font-extrabold">کارتابل درخواست‌های عضویت</h1>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-[#E6EAF0]">بررسی اطلاعات و مدارک ارسالی از سایت، تعیین نوع عضویت، درخواست تکمیل یا رد مستدل و تأیید نهایی. نوع عضویت را معاون اعضا تعیین می‌کند.</p>
      <div className="mt-5 flex flex-wrap gap-3"><span className="rounded-xl bg-white/10 px-4 py-2">کل درخواست‌ها: {items.length}</span><span className="rounded-xl bg-white/10 px-4 py-2">در انتظار اقدام: {items.filter((item) => !["approved", "rejected"].includes(item.reviewStatus || "new")).length}</span><a href="/internal/members" className="rounded-xl border border-white/30 px-4 py-2 font-bold">پرونده اعضا</a><a href="/internal/requests" className="rounded-xl border border-white/30 px-4 py-2 font-bold">کارتابل سایر درخواست‌ها</a></div>
    </header>
    {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(300px,0.75fr)_minmax(0,1.5fr)]">
      <aside className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#D8D0C4]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <input className={fieldClass + " mt-0"} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجو با نام، تلفن، ایمیل یا کد ملی" />
          <select className={fieldClass + " mt-0"} value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">نیازمند اقدام</option><option value="all">همه درخواست‌ها</option><option value="new">تازه‌وارد</option><option value="in_review">در حال بررسی</option><option value="needs_revision">نیازمند تکمیل</option><option value="rejected">ردشده</option><option value="approved">تأییدشده</option></select>
        </div>
        {loading ? <p className="p-6 text-sm">در حال دریافت درخواست‌ها…</p> : <div className="mt-4 space-y-2">{filtered.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={"w-full rounded-2xl border p-4 text-right " + (selectedId === item.id ? "border-[#B07800] bg-[#FFF8E8]" : "border-[#E4DED4] hover:bg-[#F8F6F1]")}><div className="flex items-start justify-between gap-2"><span className="font-extrabold">{item.name}</span><span className="rounded-full bg-[#EEECE6] px-2 py-1 text-[11px]">{statuses[item.reviewStatus || "new"] || item.reviewStatus}</span></div><p className="mt-2 text-xs text-[#5F6D79]">{item.phone} · {item.email}</p><p className="mt-1 text-xs text-[#5F6D79]">{new Date(item.createdAt).toLocaleDateString("fa-IR")}</p></button>)}{!filtered.length && <p className="p-6 text-sm text-[#66717A]">درخواستی با این فیلتر پیدا نشد.</p>}</div>}
      </aside>
      <div className="min-w-0 space-y-5">
        {selected ? <>
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#D8D0C4] md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-extrabold">{selected.name}</h2><p className="mt-2 text-sm text-[#5F6D79]">شناسه درخواست: {selected.id}</p></div><span className="rounded-full bg-[#EEECE6] px-3 py-1 text-xs">{statuses[selected.reviewStatus || "new"] || selected.reviewStatus}</span></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["تلفن",selected.phone],["ایمیل",selected.email],["شهر",selected.city],["نوع عضویت درخواستی",selected.requestedMembershipType === "professional" ? "عضو حرفه‌ای / تخصصی" : selected.requestedMembershipType === "affiliate" ? "عضو وابسته" : "ثبت نشده"],["نوع عضویت نهایی",selected.membershipTier || "تعیین نشده"],["کد ملی",selected.nationalId],["تاریخ تولد",selected.birthDate],["تحصیلات",selected.education],["رشته تحصیلی",selected.educationField],["حوزه فعالیت",selected.artField || selected.area],["سازمان",selected.organization],["سمت",selected.role],["نشانی",selected.address],["کد پستی",selected.postalCode]].map(([label,value]) => <div key={label} className="rounded-xl bg-[#F7F5F0] p-3"><p className="text-xs text-[#65717B]">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value || "ثبت نشده"}</p></div>)}</div>
            <div className="mt-4 rounded-2xl bg-[#F7F5F0] p-4"><h3 className="font-extrabold">توضیحات متقاضی</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{selected.message || "توضیحی ثبت نشده است."}</p></div>
            <div className="mt-4"><h3 className="font-extrabold">مدارک ارسالی</h3><div className="mt-2 flex flex-wrap gap-2">{selected.documents?.map((doc) => <a key={doc.id} href={"/api/membership-documents?documentId=" + encodeURIComponent(doc.id)} target="_blank" rel="noreferrer" className="rounded-xl border border-[#D8D0C4] px-3 py-2 text-sm font-semibold hover:bg-[#F7F5F0]">{({birthCertificate:"شناسنامه",nationalIdFront:"روی کارت ملی",portrait:"عکس پرسنلی",resume:"رزومه"} as Record<string,string>)[doc.kind] || doc.fileName} · {Math.ceil(doc.size/1024)}KB ↗</a>)}{!selected.documents?.length && <p className="text-sm text-red-700">مدرکی ثبت نشده است.</p>}</div></div>
            {!!selected.reviewHistory?.length && <div className="mt-5 rounded-2xl border border-[#E4DED4] p-4"><h3 className="font-extrabold">سوابق بررسی و اصلاح</h3><div className="mt-3 space-y-3">{selected.reviewHistory.map((event, index) => <div key={index} className="border-r-2 border-[#D8D0C4] pr-3"><p className="text-sm font-bold">{({ "set-type":"تعیین نوع عضویت", "request-revision":"درخواست تکمیل", reject:"رد درخواست", approve:"تأیید درخواست", applicant_resubmitted:"ارسال مجدد توسط متقاضی" } as Record<string,string>)[event.action] || event.action}</p><p className="mt-1 text-xs text-[#65717B]">{event.actor || "متقاضی"}{event.at ? " · " + new Date(event.at).toLocaleString("fa-IR") : ""}{event.membershipTier ? " · " + (tiers.find((tier) => tier.value === event.membershipTier)?.label || event.membershipTier) : ""}</p>{event.feedback && <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{event.feedback}</p>}</div>)}</div></div>}
          </section>
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#D8D0C4] md:p-6">
            <h2 className="text-xl font-extrabold">تعیین نوع عضویت و فرم تکمیلی</h2>
            <label className="mt-4 block text-sm font-bold">نوع عضویت<select className={fieldClass} value={tier} onChange={(e) => setTier(e.target.value)}>{tiers.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <p className="mt-2 text-sm text-[#5F6D79]">{tiers.find((item) => item.value === tier)?.description}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {tier === "affiliate" && <>{field("باشگاه یا حوزه علاقه‌مندی","interestArea","مثلاً هنرهای تجسمی")}{field("زمینه مشارکت داوطلبانه","volunteerInterest","مثلاً تولید محتوا یا رویداد")}{field("زمان در دسترس","availability","مثلاً ماهی ۴ ساعت")}{field("شهر یا محدوده فعالیت","participationRegion","")}</>}
              {tier === "professional" && <>{field("تخصص اصلی","professionalExpertise","")}{field("سوابق یا پیوند نمونه آثار","portfolioUrl","پیوند وب‌سایت یا نمونه آثار")}{field("سابقه حرفه‌ای","professionalExperience","")}{field("زمینه همکاری مطلوب","collaborationInterest","")}</>}
              {tier === "supporter_partner" && <>{field("نوع حمایت یا مشارکت","supportType","مالی، غیرنقدی، سازمانی")}{field("بازه تقریبی ظرفیت حمایت","supportCapacity","اختیاری")}{field("نام مجموعه / سمت تصمیم‌گیر","partnerDetails","")}{field("حوزه مسئولیت اجتماعی مورد علاقه","csrInterest","")}</>}
            </div>
            <button disabled={busy} onClick={() => void act("set-type")} className="mt-5 rounded-xl bg-[#18304A] px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "در حال ذخیره…" : "ذخیره نوع و فرم تکمیلی"}</button>
          </section>
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#D8D0C4] md:p-6">
            <h2 className="text-xl font-extrabold">تصمیم و پیام به متقاضی</h2>
            <label className="mt-4 block text-sm font-bold">پیام یا فهرست موارد موردنیاز<textarea className={fieldClass + " min-h-32"} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="دقیق بنویسید چه اطلاعات یا مدرکی کم است؛ پیام بدون توضیح ارسال نمی‌شود." /></label>
            <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={() => void act("request-revision")} className="rounded-xl bg-[#FFF0C2] px-4 py-3 font-bold text-[#654300] disabled:opacity-50">درخواست تکمیل و اصلاح</button><button disabled={busy} onClick={() => { if (window.confirm("درخواست با همین توضیح رد شود؟")) void act("reject"); }} className="rounded-xl border border-red-200 px-4 py-3 font-bold text-red-700 disabled:opacity-50">رد درخواست</button><button disabled={busy} onClick={() => { if (window.confirm("درخواست تأیید و پرونده عضو ایجاد یا به‌روزرسانی شود؟")) void act("approve"); }} className="rounded-xl bg-[#F2A900] px-4 py-3 font-extrabold text-[#18304A] disabled:opacity-50">تأیید و ثبت در پرونده اعضا</button></div>
            <p className="mt-3 text-xs leading-6 text-[#65717B]">در تأیید نهایی، سامانه ابتدا پرونده موجود را با تلفن یا ایمیل تطبیق می‌دهد؛ در صورت وجود، همان پرونده ارتقا می‌یابد. در غیر این صورت پرونده جدید ساخته می‌شود. سوابق تغییر نوع عضویت نگهداری می‌شود.</p>
          </section>
        </> : <section className="rounded-3xl bg-white p-8 text-sm">برای مشاهده جزئیات، یک درخواست را از فهرست انتخاب کنید.</section>}
      </div>
    </section>
  </div></main>;
}
