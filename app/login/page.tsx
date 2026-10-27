"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SITE_ADMIN_LOGIN = "https://www.khorshid-mafakher.ir/api/admin/login";

export default function LoginPage() {
  const router = useRouter();
  const [adminError, setAdminError] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAdminError(params.get("adminError") === "1");
    setPasswordReset(params.get("passwordReset") === "1");
  }, []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);

    // Site administrators authenticate against the website's own server,
    // which issues its own host-only, HttpOnly admin cookie.
    if (username.trim() === "admin") {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = SITE_ADMIN_LOGIN;
      form.style.display = "none";
      const values = { username: username.trim(), password, bridge: "portal" };
      for (const [name, value] of Object.entries(values)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "نام کاربری یا رمز عبور نادرست است.");
        return;
      }

      const role = data.user?.role;
      if (data.user?.mustChangePassword) {
        router.push("/internal/change-password?required=1");
        router.refresh();
        return;
      }
      const destination =
        role === "owner" ? "/internal/owner" :
        role === "member" ? "/internal/member-home" :
        role === "beneficiary" ? "/internal/my-reward" :
        role === "ceo" ? "/internal/roles/ceo" :
        role === "deputy" ? "/internal/roles/deputy" :
        role === "finance" ? "/internal/roles/finance" :
        role === "economic" ? "/internal/roles/economic" :
        role === "csr" ? "/internal/roles/csr" :
        role === "media" ? "/internal/media-manager" :
        role === "artists" ? "/internal/roles/artists" :
        role === "education" ? "/internal/education-manager" :
        role === "members" ? "/internal/roles/members" :
        role === "member" ? "/internal/member-home" : "/login";

      router.push(destination);
      router.refresh();
    } catch {
      setError("ارتباط با سامانه برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page min-h-screen px-4 pb-16 pt-12"><div className="mx-auto max-w-md">
        <div className="mb-4"><a href="/" className="internal-home-link">← صفحه اصلی سایت</a></div>
        <div className="login-panel rounded-3xl p-8 text-white shadow-xl">
          <p className="text-sm font-bold text-[#F2A900]">سامانه داخلی خورشید</p>
          <h1 className="mt-2 text-3xl font-extrabold">ورود به سامانه</h1>
          <p className="mt-3 text-sm leading-7 text-[#E6EAF0]">اعضا، همکاران و مدیر سایت از همین صفحه وارد می‌شوند. دسترسی بر اساس نقش و مجوز حساب تعیین می‌شود.</p>
        </div>
        <form onSubmit={submit} className="login-form mt-5 rounded-3xl p-6 shadow-sm">
          <label className="block text-sm font-semibold">نام کاربری
            <input className="login-input mt-2 w-full rounded-xl px-4 py-3 outline-none" autoComplete="username" placeholder="برای اعضا: شماره تلفن ثبت‌شده" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <span className="mt-1 block text-xs font-normal leading-5 text-[#687783]">نام کاربری اعضا همان شماره تلفن ثبت‌شده در پرونده است؛ شماره را با ارقام لاتین وارد کنید. همکاران از نام کاربری سازمانی خود استفاده کنند.</span>
          </label>
          {passwordReset && <div role="status" className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">رمز عبور با موفقیت تغییر کرد. با رمز جدید وارد شوید.</div>}
          <label className="mt-4 block text-sm font-semibold">رمز عبور
            <input className="login-input mt-2 w-full rounded-xl px-4 py-3 outline-none" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <div className="mt-2 text-left"><a href="/forgot-password" className="text-sm font-semibold text-[#18304A] underline">رمز عبور را فراموش کرده‌اید؟</a></div>
          {(error || adminError) && <div className="mt-4 rounded-xl bg-[#FDECEC] px-4 py-3 text-sm font-semibold text-[#A33A3A]">{error || "ورود مدیر سایت ناموفق بود. نام کاربری یا رمز عبور را بررسی کنید."}</div>}
          <button className="login-submit btn-primary mt-6 w-full px-5 py-3 disabled:opacity-50" disabled={busy}>{busy ? "در حال ورود..." : "ورود"}</button>
        </form>
      </div>
    </main>
  );
}
