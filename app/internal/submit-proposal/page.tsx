"use client";

import { useEffect, useState } from "react";

type ProposalType = "پروژه" | "مشتری" | "اسپانسر" | "فرصت همکاری";

type Proposal = {
  id: string;
  code: string;
  type: ProposalType;
  title: string;
  clientName: string;
  clientContact: string;
  description: string;
  expectedValue: number;
  creator: string;
  creatorName: string;
  createdAt: string;
  status: string;
  assignedTo: string;
  assignedToName: string;
  specialistBrief: string;
  proposalDetails: string;
  negotiationNote: string;
  contractNo: string;
  contractValue: number;
  contractDate: string;
  financeNote: string;
  history: Array<{ id: string; date: string; actor: string; action: string; note: string }>;
};


function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function today() {
  const d = new Date();
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d).replaceAll("/", "-");
}

function code() {
  return `OP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
}

export default function SubmitProposalPage() {
  const [user, setUser] = useState<{ username: string; name: string; role: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [type, setType] = useState<ProposalType>("پروژه");
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [contact, setContact] = useState("");
  const [expectedValue, setExpectedValue] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          window.location.href = "/login";
          return;
        }
        const data = await response.json();
        const currentUser = data.user;
        const proposalRoles = ["beneficiary","finance","ceo","deputy","economic","csr","media","artists","education","members"];
        if (!currentUser || !proposalRoles.includes(currentUser.role)) {
          window.location.href = "/internal/project-rewards";
          return;
        }
        setUser(currentUser);
      })
      .catch(() => {
        window.location.href = "/login";
      })
      .finally(() => setChecking(false));
  }, []);

  async function submit() {
    if (!user || !title.trim() || !description.trim()) {
      alert("عنوان پیشنهاد و شرح کوتاه را تکمیل کنید.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          clientName: client.trim(),
          clientContact: contact.trim(),
          expectedValue: Number(expectedValue) || 0,
          description: description.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "ثبت پیشنهاد انجام نشد.");
      }

      window.location.href = user.role === "beneficiary" ? "/internal/my-reward" : "/internal/opportunities";
    } catch (error) {
      alert(error instanceof Error ? error.message : "ثبت پیشنهاد انجام نشد.");
      setSaving(false);
    }
  }

  if (checking || !user) {
    return (
      <main className="internal-form-page min-h-screen bg-[#FBF7F0] pt-24 pb-16">
        <div className="container-site">
          <div className="rounded-3xl bg-white p-8 text-center text-[#14213D] shadow-sm ring-1 ring-[#14213D]/10">
            در حال بررسی دسترسی...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="internal-form-page min-h-screen bg-[#FBF7F0] pt-24 pb-16">
      <div className="container-site">
        <div className="rounded-3xl bg-[#14213D] p-7 text-white md:p-10">
          <div className="mb-4"><a href="/internal/my-reward" className="internal-home-link !bg-[#FFFDF8] !text-[#18304A] hover:!bg-[#FFF4D6]">← صفحه اصلی من</a></div>
          <p className="text-sm font-bold text-[#F2A900]">سامانه داخلی خورشید</p>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">ثبت پیشنهاد اولیه</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#E6EAF0]">
            پیشنهاد شما ابتدا برای بررسی قائم‌مقام ثبت می‌شود و در صورت تأیید، وارد مسیر تدوین، مذاکره، قرارداد و ثبت مالی خواهد شد.
          </p>
        </div>

        <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#14213D]/10 md:p-8">
          <div className="rounded-2xl border border-[#D7CCBC] bg-[#FFFDF8] p-5 md:p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-bold text-[#26354A]">
                نوع فرصت
                <select value={type} onChange={(e) => setType(e.target.value as ProposalType)} className="mt-2 min-h-12 w-full rounded-xl border border-[#BFB4A4] bg-white px-3 text-[#17263B] outline-none focus:border-[#D89500]">
                  <option>پروژه</option>
                  <option>مشتری</option>
                  <option>اسپانسر</option>
                  <option>فرصت همکاری</option>
                </select>
              </label>

              <label className="block text-sm font-bold text-[#26354A]">
                عنوان پیشنهاد *
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً پیشنهاد همکاری با..." className="mt-2 min-h-12 w-full rounded-xl border border-[#BFB4A4] bg-white px-3 text-[#17263B] outline-none focus:border-[#D89500]" />
              </label>

              <label className="block text-sm font-bold text-[#26354A]">
                مشتری / برند / اسپانسر
                <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="در صورت مشخص بودن" className="mt-2 min-h-12 w-full rounded-xl border border-[#BFB4A4] bg-white px-3 text-[#17263B] outline-none focus:border-[#D89500]" />
              </label>

              <label className="block text-sm font-bold text-[#26354A]">
                اطلاعات تماس
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="نام رابط، تلفن، ایمیل یا راه ارتباطی" className="mt-2 min-h-12 w-full rounded-xl border border-[#BFB4A4] bg-white px-3 text-[#17263B] outline-none focus:border-[#D89500]" />
              </label>

              <label className="block text-sm font-bold text-[#26354A]">
                برآورد اولیه ارزش
                <input type="number" value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} placeholder="اختیاری" className="mt-2 min-h-12 w-full rounded-xl border border-[#BFB4A4] bg-white px-3 text-[#17263B] outline-none focus:border-[#D89500]" />
              </label>

              <div className="rounded-xl bg-[#F1EBE1] p-4 text-sm leading-7 text-[#596474]">
                ثبت‌کننده: <strong className="text-[#14213D]">{user.name}</strong>
              </div>
            </div>

            <label className="mt-5 block text-sm font-bold text-[#26354A]">
              شرح کوتاه پیشنهاد *
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder="فرصت چیست، چه نیازی وجود دارد و پیشنهاد شما برای خورشید چیست؟" className="mt-2 w-full rounded-xl border border-[#BFB4A4] bg-white px-3 py-3 leading-7 text-[#17263B] outline-none focus:border-[#D89500]" />
            </label>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={submit} disabled={saving} className="rounded-xl bg-[#D89500] px-6 py-3 font-extrabold text-[#14213D] hover:bg-[#C98200] disabled:opacity-60">
                {saving ? "در حال ثبت..." : "ارسال برای قائم‌مقام"}
              </button>
              <a href="/internal/my-reward" className="rounded-xl bg-[#E9E2D6] px-6 py-3 font-bold text-[#26354A] hover:bg-[#DED5C7]">
                بازگشت
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
