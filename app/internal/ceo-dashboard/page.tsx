"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Transaction = {
  type?: "وصول" | "هزینه";
  amount?: number;
  status?: string;
};

type Project = {
  id: string;
  code?: string;
  name: string;
  clientName?: string;
  contractValue?: number;
  revenue?: number;
  received?: number;
  directCosts?: number;
  overheadCosts?: number;
  tax?: number;
  otherCosts?: number;
  status?: string;
  financialTransactions?: Transaction[];
};

const KEY = "khorshid-project-rewards-v1";

const money = (n: number) =>
  new Intl.NumberFormat("fa-IR").format(Math.max(0, Math.round(n)));

function receivedOf(project: Project) {
  const transactions = project.financialTransactions || [];
  if (!transactions.length) return Number(project.received || 0);
  return transactions
    .filter((t) => t.type === "وصول" && t.status === "تأیید شده")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

function costsOf(project: Project) {
  return (
    Number(project.directCosts || 0) +
    Number(project.overheadCosts || 0) +
    Number(project.tax || 0) +
    Number(project.otherCosts || 0)
  );
}

function statusClass(status: string) {
  if (status === "فعال") return "bg-emerald-400/15 text-emerald-200 border-emerald-300/20";
  if (status === "تسویه‌شده") return "bg-sky-400/15 text-sky-200 border-sky-300/20";
  return "bg-amber-400/15 text-amber-100 border-amber-300/20";
}

export default function CeoDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [userName, setUserName] = useState("مدیرعامل");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          router.replace("/login");
          return;
        }
        const data = await response.json();
        if (data.user?.role !== "ceo") {
          router.replace(data.user?.role === "beneficiary" ? "/internal/my-reward" : "/internal/project-rewards");
          return;
        }
        setUserName(data.user.name || "مدیرعامل");

        try {
          const raw = localStorage.getItem(KEY);
          if (raw) setProjects(JSON.parse(raw) as Project[]);
        } catch {}
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const summary = useMemo(() => {
    const contract = projects.reduce((s, p) => s + Number(p.contractValue ?? p.revenue ?? 0), 0);
    const received = projects.reduce((s, p) => s + receivedOf(p), 0);
    const receivables = Math.max(0, contract - received);
    const costs = projects.reduce((s, p) => s + costsOf(p), 0);
    return {
      total: projects.length,
      active: projects.filter((p) => p.status === "فعال").length,
      draft: projects.filter((p) => p.status === "پیش‌نویس").length,
      settled: projects.filter((p) => p.status === "تسویه‌شده").length,
      contract,
      received,
      receivables,
      costs,
      net: Math.max(0, received - costs),
    };
  }, [projects]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#071326] px-6 py-20 text-center text-white">
        در حال بارگذاری داشبورد...
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#071326] text-white">
      <style>{`
        .ceo-shell { background: radial-gradient(circle at 85% 0%, rgba(216,149,0,.12), transparent 32%), #071326; }
        .ceo-card { background: rgba(16,31,55,.88); border: 1px solid rgba(142,174,211,.16); }
        .ceo-card:hover { border-color: rgba(242,169,0,.34); }
        .ceo-muted { color: #B8C6D9; }
        .ceo-title { color: #F2A900; }
      `}</style>

      <div className="ceo-shell min-h-screen">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#071326]/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
            <div>
              <div className="text-xs font-bold tracking-wide text-[#F2A900]">سامانه مدیریتی خورشید</div>
              <h1 className="mt-1 text-xl font-extrabold md:text-2xl">داشبورد مدیرعامل</h1>
              <p className="mt-1 text-xs ceo-muted">{userName} · نمای کلی پرونده‌ها و وضعیت مالی</p>
            </div>
            <nav className="flex flex-wrap items-center justify-end gap-2">
              <button onClick={() => router.push("/internal/opportunities")} className="rounded-xl border border-[#F2A900]/40 bg-[#F2A900]/10 px-4 py-2 text-sm font-bold text-[#FFD56A] transition hover:bg-[#F2A900]/20">
                پیشنهادها و کارتابل
              </button>
              <button onClick={() => router.push("/internal/ceo-dashboard")} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white">
                گزارش
              </button>
              <button onClick={logout} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-[#E8EEF7] transition hover:bg-white/10">
                خروج
              </button>
            </nav>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
          <section className="mb-7">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="ceo-title text-sm font-bold">گزارش مدیریتی</p>
                <h2 className="mt-1 text-2xl font-extrabold">تصویر کلی عملکرد پرونده‌ها</h2>
              </div>
              <span className="hidden text-xs ceo-muted md:block">اطلاعات نمایشی سامانه، بدون امکان ویرایش مالی</span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
              {[
                ["کل پرونده‌ها", summary.total.toLocaleString("fa-IR")],
                ["فعال", summary.active.toLocaleString("fa-IR")],
                ["پیش‌نویس", summary.draft.toLocaleString("fa-IR")],
                ["تسویه‌شده", summary.settled.toLocaleString("fa-IR")],
                ["ارزش قرارداد", money(summary.contract)],
                ["دریافتی", money(summary.received)],
                ["مطالبات", money(summary.receivables)],
                ["دریافتی خالص", money(summary.net)],
              ].map(([label, value]) => (
                <div key={label} className="ceo-card rounded-2xl p-4 transition">
                  <div className="text-xs ceo-muted">{label}</div>
                  <div className="mt-2 text-lg font-extrabold text-white md:text-xl">{value}</div>
                  {["ارزش قرارداد", "دریافتی", "مطالبات", "دریافتی خالص"].includes(label) && (
                    <div className="mt-1 text-[10px] text-[#93A6BF]">ریال</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="ceo-card overflow-hidden rounded-3xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="font-extrabold text-lg">تمام پرونده‌ها</h2>
                  <p className="mt-1 text-xs ceo-muted">وضعیت، ارزش قرارداد، دریافتی و مطالبات هر پرونده</p>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs ceo-muted">{summary.total.toLocaleString("fa-IR")} پرونده</span>
              </div>

              {projects.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="text-lg font-bold">هنوز پرونده‌ای ثبت نشده است</div>
                  <p className="mt-2 text-sm ceo-muted">پس از ثبت پروژه‌ها توسط واحد مالی، اطلاعات آن‌ها در این داشبورد نمایش داده می‌شود.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {projects.map((project) => {
                    const contract = Number(project.contractValue ?? project.revenue ?? 0);
                    const received = receivedOf(project);
                    const receivable = Math.max(0, contract - received);
                    return (
                      <div key={project.id} className="px-5 py-5 transition hover:bg-white/[.025]">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-extrabold">{project.name || "بدون عنوان"}</h3>
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(project.status || "پیش‌نویس")}`}>
                                {project.status || "پیش‌نویس"}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs ceo-muted">
                              <span>کد: {project.code || "—"}</span>
                              <span>کارفرما: {project.clientName || "—"}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-right xl:min-w-[500px]">
                            <div className="rounded-xl bg-white/[.035] p-3">
                              <div className="text-[10px] ceo-muted">ارزش قرارداد</div>
                              <div className="mt-1 text-sm font-bold">{money(contract)}</div>
                            </div>
                            <div className="rounded-xl bg-white/[.035] p-3">
                              <div className="text-[10px] ceo-muted">دریافتی</div>
                              <div className="mt-1 text-sm font-bold text-emerald-200">{money(received)}</div>
                            </div>
                            <div className="rounded-xl bg-white/[.035] p-3">
                              <div className="text-[10px] ceo-muted">مطالبات</div>
                              <div className="mt-1 text-sm font-bold text-amber-200">{money(receivable)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="space-y-5">
              <div className="ceo-card rounded-3xl p-5">
                <h2 className="text-lg font-extrabold">وضعیت مالی</h2>
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-sm ceo-muted">کل هزینه‌ها</span>
                    <strong>{money(summary.costs)} ریال</strong>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-sm ceo-muted">دریافتی</span>
                    <strong className="text-emerald-200">{money(summary.received)} ریال</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm ceo-muted">مطالبات</span>
                    <strong className="text-amber-200">{money(summary.receivables)} ریال</strong>
                  </div>
                </div>
              </div>

              <div className="ceo-card rounded-3xl p-5">
                <h2 className="text-lg font-extrabold">وضعیت پرونده‌ها</h2>
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-emerald-400/10 px-4 py-3">
                    <span className="text-sm">فعال</span><strong>{summary.active.toLocaleString("fa-IR")}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-amber-400/10 px-4 py-3">
                    <span className="text-sm">پیش‌نویس</span><strong>{summary.draft.toLocaleString("fa-IR")}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-sky-400/10 px-4 py-3">
                    <span className="text-sm">تسویه‌شده</span><strong>{summary.settled.toLocaleString("fa-IR")}</strong>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </div>
    </main>
  );
}
