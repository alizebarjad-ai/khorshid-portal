"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "ورود انجام نشد.");
        return;
      }

      const role = data.user?.role;

      const destination =
        role === "beneficiary"
          ? "/internal/my-reward"
          : role === "ceo"
            ? "/internal/roles/ceo"
            : role === "deputy"
              ? "/internal/roles/deputy"
              : role === "finance"
                ? "/internal/roles/finance"
                : role === "economic"
                  ? "/internal/roles/economic"
                  : role === "csr"
                    ? "/internal/roles/csr"
                    : role === "media"
                      ? "/internal/media-manager"
                      : role === "artists"
                        ? "/internal/roles/artists"
                        : role === "education"
                          ? "/internal/education-manager"
                          : role === "members"
                            ? "/internal/roles/members"
                            : "/login";

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
          <p className="mt-3 text-sm leading-7 text-[#E6EAF0]">دسترسی بر اساس نقش کاربر تعیین می‌شود. گردش پیشنهادها و اطلاعات مالی فقط برای کاربران مجاز نمایش داده خواهد شد.</p>
        </div>
        <form onSubmit={submit} className="login-form mt-5 rounded-3xl p-6 shadow-sm">
          <label className="block text-sm font-semibold">نام کاربری
            <input className="login-input mt-2 w-full rounded-xl px-4 py-3 outline-none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className="mt-4 block text-sm font-semibold">رمز عبور
            <input className="login-input mt-2 w-full rounded-xl px-4 py-3 outline-none" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="mt-4 rounded-xl bg-[#FDECEC] px-4 py-3 text-sm font-semibold text-[#A33A3A]">{error}</div>}
          <button className="login-submit btn-primary mt-6 w-full px-5 py-3 disabled:opacity-50" disabled={busy}>{busy ? "در حال ورود..." : "ورود"}</button>
        </form>
      </div>
    </main>
  );
}
