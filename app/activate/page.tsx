"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ActivateAccountPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 12) { setError("رمز عبور باید دست‌کم ۱۲ نویسه داشته باشد."); return; }
    if (password !== confirm) { setError("تکرار رمز عبور با رمز اصلی یکسان نیست."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "فعال‌سازی حساب انجام نشد.");
      router.push("/internal/member-home");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فعال‌سازی حساب انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page min-h-screen px-4 pb-16 pt-12"><div className="mx-auto max-w-md">
    <div className="mb-4"><a href="/" className="internal-home-link">← صفحه اصلی سایت</a></div>
    <div className="login-panel rounded-3xl p-8 text-white shadow-xl"><p className="text-sm font-bold text-[#F2A900]">عضویت خورشید مفاخر</p><h1 className="mt-2 text-3xl font-extrabold">فعال‌سازی حساب</h1><p className="mt-3 text-sm leading-7 text-[#E6EAF0]">برای امنیت حساب، رمز عبور را خودتان تعیین کنید. نام کاربری شما شماره تماس ثبت‌شده در پرونده عضویت است.</p></div>
    <form onSubmit={submit} className="login-form mt-5 rounded-3xl p-6">
      <label className="block text-sm font-semibold">رمز عبور جدید<input className="login-input mt-2 w-full rounded-xl px-4 py-3 outline-none" type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      <label className="mt-4 block text-sm font-semibold">تکرار رمز عبور<input className="login-input mt-2 w-full rounded-xl px-4 py-3 outline-none" type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)} required /></label>
      {error && <div role="alert" className="mt-4 rounded-xl bg-[#FDECEC] px-4 py-3 text-sm font-semibold text-[#A33A3A]">{error}</div>}
      <button className="login-submit btn-primary mt-6 w-full px-5 py-3 disabled:opacity-50" disabled={busy || !token}>{busy ? "در حال فعال‌سازی…" : "تعیین رمز و فعال‌سازی"}</button>
      {!token && <p className="mt-3 text-sm text-red-700">پیوند فعال‌سازی فاقد توکن است.</p>}
    </form>
  </div></main>;
}
