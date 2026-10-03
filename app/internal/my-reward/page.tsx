"use client";

import { useEffect, useMemo, useState } from "react";

type Person = {
  id: string;
  name: string;
  role: string;
  rolePercent: number;
  weight: number;
};

type Project = {
  id: string;
  code: string;
  name: string;
  clientName: string;
  currency: string;
  rewardRate: number;
  received: number;
  directCosts: number;
  overheadCosts: number;
  tax: number;
  otherCosts: number;
  status: string;
  people: Person[];
};

const KEY = "khorshid-project-rewards-v1";
const money = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.max(0, Math.round(n)));

export default function MyRewardPage() {
  const [name, setName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (r.ok) {
        const data = await r.json();
        setName(data.user?.name || "");
      }
    });
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setProjects(JSON.parse(raw));
    } catch {}
  }, []);

  const rows = useMemo(() => projects.flatMap((project) => {
    const people = project.people || [];
    const totalWeight = people.reduce((s, p) => s + Number(p.weight || 0), 0);
    const costs = Number(project.directCosts || 0) + Number(project.overheadCosts || 0) + Number(project.tax || 0) + Number(project.otherCosts || 0);
    const base = Math.max(0, Number(project.received || 0) - costs);
    const pool = base * (Number(project.rewardRate || 0) / 100);
    return people
      .filter((person) => person.name === name)
      .map((person) => ({
        ...person,
        project,
        share: totalWeight ? (person.weight / totalWeight) * 100 : 0,
        amount: totalWeight ? (pool * person.weight) / totalWeight : 0,
      }));
  }), [projects, name]);

  const total = rows.reduce((s, row) => s + row.amount, 0);

  async function logout() {
    setLoggingOut(true);
    try { await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) }); } finally { window.location.href = "/login"; }
  }

  return (
    <main className="internal-rewards min-h-screen bg-[#FBF7F0] pt-24 pb-16">
      <div className="container-site">
        <div className="rounded-3xl bg-[#14213D] p-7 text-white md:p-10">
          <div className="mb-4"><a href="/" className="internal-home-link !bg-[#FFFDF8] !text-[#18304A] hover:!bg-[#FFF4D6]">← صفحه اصلی سایت</a></div>
          <p className="text-sm font-bold text-[#F2A900]">سامانه داخلی خورشید</p>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">پاداش من</h1>
          <p className="mt-3 text-sm leading-7 text-[#E6EAF0]">
            فقط اطلاعات پاداش ثبت‌شده برای حساب کاربری شما نمایش داده می‌شود.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => { window.location.assign("/internal/submit-proposal"); }} className="rounded-xl bg-[#F2A900] px-5 py-2.5 text-sm font-extrabold text-[#14213D] hover:bg-[#FFC44D]">+ ثبت پیشنهاد</button>
            <button type="button" onClick={logout} disabled={loggingOut} className="rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/15 disabled:opacity-50">{loggingOut ? "در حال خروج..." : "خروج از حساب کاربری"}</button>
          </div>
        </div>

        <div className="mt-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#14213D]/10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-[#5B6470]">کاربر</p>
              <h2 className="mt-1 text-xl font-extrabold text-[#14213D]">{name || "کاربر"}</h2>
            </div>
            <div className="rounded-2xl bg-[#FFF0C2] px-5 py-3">
              <span className="block text-xs text-[#5B6470]">جمع پاداش ثبت‌شده</span>
              <strong className="text-xl text-[#14213D]">{money(total)}</strong>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-[#14213D]/10">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead className="bg-[#F4EEE4]">
              <tr>
                <th className="p-4">پروژه</th>
                <th className="p-4">کارفرما</th>
                <th className="p-4">نقش</th>
                <th className="p-4">درصد مشارکت</th>
                <th className="p-4">سهم نهایی</th>
                <th className="p-4">پاداش</th>
                <th className="p-4">وضعیت پروژه</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.project.id + "-" + row.id} className="border-t border-[#14213D]/10">
                  <td className="p-4 font-bold">{row.project.name}</td>
                  <td className="p-4">{row.project.clientName || "-"}</td>
                  <td className="p-4">{row.role}</td>
                  <td className="p-4">{row.rolePercent}٪</td>
                  <td className="p-4">{row.share.toFixed(1)}٪</td>
                  <td className="p-4 font-extrabold">{money(row.amount)} {row.project.currency}</td>
                  <td className="p-4">{row.project.status}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-10 text-center text-[#5B6470]">هنوز پاداشی برای حساب شما ثبت نشده است.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 rounded-2xl border border-[#14213D]/10 bg-white p-5 text-xs leading-7 text-[#5B6470]">
          این صفحه نمایشی است و کاربر ذی‌نفع امکان ویرایش اطلاعات پروژه، هزینه، درصد پاداش یا سهم خود را ندارد.
        </div>
      </div>
    </main>
  );
}
