"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SessionUser = { username: string; name: string; role: string; mustChangePassword?: boolean };

export default function ChangePasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const required = searchParams.get("required") === "1";
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.user) {
          router.replace("/login");
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword.length < 12) {
      setError("رمز جدید باید دست‌کم ۱۲ نویسه داشته باشد.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("تکرار رمز جدید یکسان نیست.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("رمز جدید باید با رمز فعلی متفاوت باشد.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تغییر رمز انجام نشد.");
      const role = user?.role;
      const destination = role === "owner" ? "/internal/owner"
        : role === "member" ? "/internal/member-home"
        : role === "beneficiary" ? "/internal/my-reward"
        : role === "finance" ? "/internal/project-rewards"
        : "/internal";
      router.replace(destination);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تغییر رمز انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return <main className="internal-app min-h-screen px-4 pb-16 pt-28"><div className="container-site rounded-3xl bg-white p-8 text-center">در حال بررسی دسترسی…</div></main>;
  }

  return (
    <main className="internal-app min-h-screen px-4 pb-16 pt-20 text-[#18304A]">
      <div className="mx-auto max-w-xl">
        <header className="rounded-3xl bg-[#18304A] p-7 text-white">
          <p className="text-sm font-bold text-[#B99450]">امنیت حساب کاربری</p>
          <h1 className="mt-2 text-2xl font-extrabold">{required || user.mustChangePassword ? "تعیین رمز عبور شخصی" : "تغییر رمز عبور"}</h1>
          <p className="mt-3 text-sm leading-7 text-[#E6EAF0]">
            {user.name} · برای امنیت حساب، رمز جدید باید دست‌کم ۱۲ نویسه داشته باشد. رمز عبور به‌صورت هش امن ذخیره می‌شود.
          </p>
        </header>
        {(required || user.mustChangePassword) && <p className="mt-4 rounded-2xl border border-[#D9C48E] bg-[#FBF5E7] p-4 text-sm leading-7">برای ادامه کار با سامانه، لازم است رمز اولیه را با رمز شخصی خود جایگزین کنید.</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <form onSubmit={submit} className="mt-5 space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#E3E0D8]">
          <label className="block text-sm font-bold">رمز فعلی
            <input className="mt-2 w-full rounded-xl border border-[#D8D0C4] bg-white px-4 py-3" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </label>
          <label className="block text-sm font-bold">رمز جدید
            <input className="mt-2 w-full rounded-xl border border-[#D8D0C4] bg-white px-4 py-3" type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          </label>
          <label className="block text-sm font-bold">تکرار رمز جدید
            <input className="mt-2 w-full rounded-xl border border-[#D8D0C4] bg-white px-4 py-3" type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </label>
          <p className="text-xs leading-6 text-[#65717B]">از رمز منحصربه‌فرد استفاده کنید و آن را با سایر کاربران به اشتراک نگذارید.</p>
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#B99450] px-5 py-3 font-extrabold text-[#18304A] disabled:opacity-50">{busy ? "در حال ذخیره…" : "ذخیره رمز جدید"}</button>
          {!required && !user.mustChangePassword && <button type="button" onClick={() => router.back()} className="w-full rounded-xl border border-[#D8D0C4] px-5 py-3 font-bold">بازگشت</button>}
        </form>
      </div>
    </main>
  );
}
