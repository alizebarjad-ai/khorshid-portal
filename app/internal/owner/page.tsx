"use client";

import { useCallback, useEffect, useState } from "react";

type Account = {
  username: string;
  name: string;
  role: string;
  roleLabel: string;
  status: "active" | "disabled";
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};
type AuditItem = { actor: string; action: string; target: string; at: string; metadata?: Record<string, string> };
type Snapshot = { accounts: Account[]; audit: AuditItem[] };
type SecretResult = { username: string; temporaryPassword: string; note: string };

const ACTION_LABEL: Record<string, string> = {
  "reset-password": "بازنشانی رمز",
  deactivate: "غیرفعال‌سازی حساب",
  activate: "فعال‌سازی حساب",
  "transfer-role": "انتقال مسئولیت",
};

function dateLabel(value?: string) {
  if (!value) return "ثبت نشده";
  try { return new Date(value).toLocaleString("fa-IR"); } catch { return value; }
}

export default function OwnerStaffPage() {
  const [data, setData] = useState<Snapshot>({ accounts: [], audit: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [secret, setSecret] = useState<SecretResult | null>(null);
  const [successor, setSuccessor] = useState<Record<string, { username: string; name: string }>>({});
  const [cleanupBusy, setCleanupBusy] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/owner/staff", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "دریافت اطلاعات ناموفق بود.");
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "دریافت اطلاعات ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function run(action: string, account: Account) {
    setError("");
    setNotice("");
    setSecret(null);
    if (action === "deactivate" && !window.confirm(`حساب «${account.username}» غیرفعال شود؟`)) return;
    if (action === "activate" && !window.confirm(`حساب «${account.username}» دوباره فعال شود؟`)) return;

    const next = successor[account.username];
    if (action === "transfer") {
      if (!next?.username?.trim() || !next?.name?.trim()) {
        setError("برای انتقال مسئولیت، نام کاربری و نام فرد جایگزین را وارد کنید.");
        return;
      }
      if (!window.confirm(`مسئولیت «${account.roleLabel}» از حساب ${account.username} به ${next.username} منتقل شود؟ حساب قبلی غیرفعال خواهد شد.`)) return;
    }

    setBusy(account.username + ":" + action);
    try {
      const response = await fetch("/api/owner/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, username: account.username, ...(action === "transfer" ? { newUsername: next.username.trim(), newName: next.name.trim() } : {}) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "عملیات ناموفق بود.");
      if (body.temporaryPassword) {
        setSecret({ username: body.username, temporaryPassword: body.temporaryPassword, note: (action === "transfer" ? "حساب قبلی غیرفعال شد. رمز موقت را فقط به فرد جایگزین تحویل دهید." : "این رمز فقط اکنون نمایش داده می‌شود. آن را امن به کاربر تحویل دهید.") + (body.auditRecorded === false ? " هشدار: ثبت سابقه امنیتی ناموفق بود؛ این موضوع را بررسی کنید." : "") });
      } else {
        setNotice((action === "deactivate" ? "حساب غیرفعال شد." : action === "activate" ? "حساب فعال شد." : "عملیات انجام شد.") + (body.auditRecorded === false ? " هشدار: ثبت سابقه امنیتی ناموفق بود." : ""));
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "عملیات ناموفق بود.");
    } finally {
      setBusy("");
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(`نام کاربری: ${secret.username}\nرمز موقت: ${secret.temporaryPassword}`);
      setNotice("اطلاعات ورود کپی شد؛ آن را در پیام‌رسان یا سند عمومی ذخیره نکنید.");
    } catch {
      setNotice("کپی خودکار در این مرورگر در دسترس نیست؛ اطلاعات را دستی و امن منتقل کنید.");
    }
  }

  async function cleanupCategory(category: string, label: string) {
    const confirmation = window.prompt(`فقط داده‌های دسته «${label}» حذف می‌شود؛ پروژه‌ها، اعضا و باشگاه‌های خارج از این دسته دست‌نخورده می‌مانند. برای تأیید، نام دسته را دقیقاً وارد کنید: ${label}`);
    if (confirmation !== label) return;
    setCleanupBusy(category);
    setError("");
    setNotice("");
    setSecret(null);
    try {
      const response = await fetch("/api/owner/cleanup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, confirmation }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "حذف دسته انتخاب‌شده ناموفق بود.");
      setNotice(`حذف دسته «${label}» انجام شد: ${body.deletedRecords} رکورد و ${body.deletedFiles} فایل خصوصی حذف شد.` + (body.failedFiles ? ` هشدار: حذف ${body.failedFiles} فایل ناموفق بود.` : "") + (body.auditRecorded === false ? " هشدار: ثبت سابقه امنیتی ناموفق بود." : ""));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "حذف دسته انتخاب‌شده ناموفق بود.");
    } finally {
      setCleanupBusy("");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="internal-app min-h-screen px-4 pb-16 pt-20 text-[#18304A]">
      <div className="container-site">
        <header className="rounded-3xl bg-[#18304A] p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#B99450]">دسترسی اختصاصی مالک</p>
              <h1 className="mt-2 text-3xl font-extrabold">مدیریت امنیت و مسئولیت‌ها</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#E6EAF0]">بازنشانی رمز، توقف دسترسی و انتقال مسئولیت‌ها. رمزهای قبلی قابل مشاهده نیستند و رمز موقت فقط یک بار نمایش داده می‌شود.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/internal" className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-white">صفحه داخلی</a>
              <button onClick={logout} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white">خروج امن</button>
            </div>
          </div>
        </header>

        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl bg-[#F3F7EF] p-4 text-sm font-semibold text-[#31562D]">{notice}</p>}
        <section className="mt-6 rounded-3xl border border-[#E3E0D8] bg-white p-5 shadow-sm md:p-7">
          <h2 className="text-xl font-extrabold">حذف کنترل‌شده داده‌ها</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[#687783]">هر بار فقط یک دسته را انتخاب کنید. حذف هر دسته نیازمند تأیید نام همان دسته است؛ دسته‌های دیگر و سابقه امنیتی حذف نمی‌شوند. این عملیات قابل بازگشت نیست.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { id: "members", label: "اعضا و پرونده‌های عضویت", description: "اعضا، حساب‌های عضویت، امتیازها، درخواست‌های ارتقا و فایل‌های خصوصی مربوط" },
              { id: "clubs", label: "باشگاه‌ها و برنامه‌ها", description: "باشگاه‌ها و برنامه‌های باشگاهی؛ پروژه‌ها و اعضا حذف نمی‌شوند" },
              { id: "projects", label: "پروژه‌ها و پیشنهادها", description: "پروژه‌ها، فرصت‌ها و پیشنهادهای پروژه؛ اعضا و باشگاه‌ها حذف نمی‌شوند" },
            ].map((item) => (
              <div key={item.id} className="rounded-2xl border border-[#E3E0D8] p-4">
                <h3 className="font-extrabold">{item.label}</h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-[#687783]">{item.description}</p>
                <button disabled={Boolean(cleanupBusy)} onClick={() => void cleanupCategory(item.id, item.label)} className="mt-4 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-800 disabled:opacity-50">
                  {cleanupBusy === item.id ? "در حال حذف…" : "حذف همین دسته"}
                </button>
              </div>
            ))}
          </div>
        </section>

        {secret && (
          <section className="mt-5 rounded-2xl border border-[#D9C48E] bg-[#FBF5E7] p-5">
            <h2 className="font-extrabold">رمز موقت برای {secret.username}</h2>
            <p className="mt-2 text-sm leading-6">{secret.note}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code dir="ltr" className="break-all rounded-lg bg-white px-3 py-2 font-bold">{secret.temporaryPassword}</code>
              <button onClick={copySecret} className="rounded-xl bg-[#18304A] px-4 py-2 text-sm font-bold text-white">کپی اطلاعات ورود</button>
              <button onClick={() => setSecret(null)} className="rounded-xl border border-[#D8D0C4] px-4 py-2 text-sm font-bold">پنهان‌کردن</button>
            </div>
            <p className="mt-3 text-xs leading-6">پس از بستن این بخش، رمز دوباره از سامانه بازیابی نمی‌شود؛ در صورت گم‌شدن باید رمز دیگری صادر کنید.</p>
          </section>
        )}

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#E3E0D8] md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-extrabold">حساب‌های همکاران</h2><p className="mt-1 text-sm text-[#687783]">حساب مالک در این فهرست قابل مدیریت نیست.</p></div>
            <button onClick={() => void load()} className="rounded-xl border border-[#D8D0C4] px-4 py-2 text-sm font-bold">به‌روزرسانی فهرست</button>
          </div>
          {loading ? <p className="py-10 text-center">در حال دریافت اطلاعات…</p> : data.accounts.length === 0 ? <p className="py-10 text-center text-sm text-[#687783]">حسابی برای نمایش وجود ندارد.</p> : (
            <div className="mt-5 space-y-4">
              {data.accounts.map((account) => (
                <article key={account.username} className="rounded-2xl border border-[#E3E0D8] p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold">{account.name} <span className="font-normal text-[#687783]">({account.username})</span></h3>
                      <p className="mt-1 text-sm text-[#687783]">{account.roleLabel}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full px-3 py-1 ${account.status === "disabled" ? "bg-red-50 text-red-800" : "bg-[#F3F7EF] text-[#31562D]"}`}>{account.status === "disabled" ? "غیرفعال" : "فعال"}</span>
                        {account.mustChangePassword && <span className="rounded-full bg-[#FBF5E7] px-3 py-1 text-[#785A22]">نیازمند تعیین رمز شخصی</span>}
                      </div>
                      <p className="mt-2 text-xs text-[#687783]">آخرین ورود: {dateLabel(account.lastLoginAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button disabled={!!busy || account.status === "disabled"} onClick={() => void run("reset-password", account)} className="rounded-lg bg-[#18304A] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{busy === account.username + ":reset-password" ? "در حال انجام…" : "صدور رمز موقت"}</button>
                      {account.status === "disabled"
                        ? <button disabled={!!busy} onClick={() => void run("activate", account)} className="rounded-lg border border-[#D8D0C4] px-3 py-2 text-xs font-bold disabled:opacity-40">فعال‌سازی</button>
                        : <button disabled={!!busy} onClick={() => void run("deactivate", account)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-800 disabled:opacity-40">غیرفعال‌سازی</button>}
                    </div>
                  </div>
                  {account.status === "active" && (
                    <div className="mt-4 rounded-xl bg-[#F7F6F2] p-3">
                      <p className="text-sm font-bold">انتقال مسئولیت به فرد جدید</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="text-xs font-bold">نام کاربری جدید
                          <input dir="ltr" autoComplete="off" className="mt-1 w-full rounded-lg border border-[#D8D0C4] bg-white px-3 py-2 text-sm font-normal" placeholder="new.username" value={successor[account.username]?.username || ""} onChange={(event) => setSuccessor((old) => ({ ...old, [account.username]: { username: event.target.value, name: old[account.username]?.name || "" } }))} />
                        </label>
                        <label className="text-xs font-bold">نام و نام خانوادگی
                          <input autoComplete="off" className="mt-1 w-full rounded-lg border border-[#D8D0C4] bg-white px-3 py-2 text-sm font-normal" placeholder="نام فرد جایگزین" value={successor[account.username]?.name || ""} onChange={(event) => setSuccessor((old) => ({ ...old, [account.username]: { username: old[account.username]?.username || "", name: event.target.value } }))} />
                        </label>
                      </div>
                      <button disabled={!!busy} onClick={() => void run("transfer", account)} className="mt-3 rounded-lg border border-[#B99450] px-4 py-2 text-xs font-extrabold disabled:opacity-40">{busy === account.username + ":transfer" ? "در حال انتقال…" : "انتقال مسئولیت و غیرفعال‌کردن حساب قبلی"}</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#E3E0D8] md:p-7">
          <h2 className="text-xl font-extrabold">سابقه امنیتی</h2>
          <p className="mt-1 text-sm text-[#687783]">۵۰ اقدام اخیر مدیریتی؛ رمزها و اطلاعات محرمانه در این سابقه ذخیره نمی‌شوند.</p>
          {data.audit.length === 0 ? <p className="py-6 text-sm text-[#687783]">هنوز اقدامی ثبت نشده است.</p> : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-right text-sm">
                <thead><tr className="border-b border-[#E3E0D8] text-[#687783]"><th className="px-3 py-3">زمان</th><th className="px-3 py-3">اقدام</th><th className="px-3 py-3">حساب هدف</th><th className="px-3 py-3">عامل</th></tr></thead>
                <tbody>{data.audit.map((item, index) => <tr key={item.at + item.target + index} className="border-b border-[#F0EEE8]"><td className="px-3 py-3">{dateLabel(item.at)}</td><td className="px-3 py-3">{ACTION_LABEL[item.action] || item.action}</td><td dir="ltr" className="px-3 py-3 text-right">{item.target}</td><td className="px-3 py-3">{item.actor}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
