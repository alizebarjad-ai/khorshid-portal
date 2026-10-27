"use client";

/* eslint-disable react-hooks/set-state-in-effect -- the effect starts async data loading; state updates occur in the async request callbacks. */

/* eslint-disable react-hooks/set-state-in-effect -- this effect initiates asynchronous loading from the authenticated API. */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
 id:string; target:"artist"|"expert"|"consultant"; status:"pending"|"approved"|"rejected"|"needs_info";
 assignedRole:"artists"|"csr"; submittedAt:string; reviewedAt?:string; reviewer?:string; note?:string;
 member:{id:string;fullName:string;email:string;phone:string;city:string;membershipTier:string;membershipGrade:string;pointsBalance:number;expertise:string;biography:string;artistProfile:Record<string,unknown>;expertProfile:Record<string,unknown>};
};
const targetLabel:Record<string,string>={artist:"هنرمند",expert:"متخصص",consultant:"مشاور"};
const statusLabel:Record<string,string>={pending:"در انتظار بررسی",approved:"تأیید شده",rejected:"رد شده",needs_info:"نیازمند تکمیل"};
const dateLabel=(s:string)=>{try{return new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(s))}catch{return s}};
const inputClass="w-full rounded-xl border border-[#D8D0C4] bg-white px-3 py-2.5 text-sm text-[#18304A] outline-none focus:border-[#B07800]";
export default function MemberUpgradesPage(){
 const router=useRouter();
 const [items,setItems]=useState<Item[]>([]);
 const [role,setRole]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{setLoading(true);try{
  const auth=await fetch("/api/auth/me",{cache:"no-store"});if(!auth.ok){router.replace("/login");return;}
  const authData=await auth.json();setRole(authData.user?.role||"");
  if(!["artists","csr","members","ceo","deputy"].includes(authData.user?.role)){router.replace("/internal");return;}
  const r=await fetch("/api/member-upgrades",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"دریافت کارتابل ناموفق بود.");
  setItems(Array.isArray(d.items)?d.items:[]);setError("");
 }catch(e){setError(e instanceof Error?e.message:"دریافت کارتابل ناموفق بود.");}finally{setLoading(false)}},[router]);
 useEffect(()=>{void load()},[load]);
 async function decide(item:Item,status:"approved"|"rejected"|"needs_info"){
  const note=notes[item.id]||"";
  if((status==="rejected"||status==="needs_info")&&!note.trim()){setError("برای رد یا درخواست تکمیل، توضیح ثبت کنید.");return}
  setBusy(item.id);setError("");setNotice("");
  try{const r=await fetch("/api/member-upgrades",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({memberId:item.member.id,requestId:item.id,status,note})});const d=await r.json();if(!r.ok)throw new Error(d.error||"ثبت تصمیم ناموفق بود.");setNotice("تصمیم ثبت شد و در پرونده عضو نگهداری شد.");await load();}
  catch(e){setError(e instanceof Error?e.message:"ثبت تصمیم ناموفق بود.");}finally{setBusy("")}
 }
 const pending=items.filter(x=>x.status==="pending"||x.status==="needs_info");
 const readOnly=role==="members";
 return <main className="internal-app min-h-screen px-4 pb-16 pt-28 text-[#18304A]"><div className="container-site">
  <header className="rounded-3xl bg-[#18304A] p-6 text-white md:p-8"><a href={role==="artists"?"/internal/roles/artists":role==="csr"?"/internal/roles/csr":role==="members"?"/internal/roles/members":"/internal"} className="text-sm text-[#F2A900]">← بازگشت به داشبورد</a><h1 className="mt-3 text-3xl font-extrabold">کارتابل ارتقای تخصصی اعضا</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-[#E6EAF0]">{readOnly?"معاونت اعضا فقط وضعیت درخواست‌ها و مشخصات پایه را مشاهده می‌کند؛ مدارک حرفه‌ای و تصمیم‌گیری در اختیار واحد تخصصی مسئول است.":"درخواست هنرمندی در کارتابل معاون هنری و درخواست تخصص یا مشاوره در کارتابل معاون CSR بررسی می‌شود. تصمیم و توضیحات در پرونده اصلی عضو ثبت می‌شود."}</p><div className="mt-5 flex flex-wrap gap-3"><span className="rounded-xl bg-white/10 px-4 py-2">کل درخواست‌ها: {items.length}</span><span className="rounded-xl bg-white/10 px-4 py-2">نیازمند اقدام: {pending.length}</span></div></header>
  {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
  {loading?<p className="mt-8 rounded-2xl bg-white p-6">در حال دریافت درخواست‌ها…</p>:items.length===0?<section className="mt-6 rounded-2xl border border-[#D8D0C4] bg-white p-8"><h2 className="font-extrabold">درخواستی در کارتابل نیست</h2><p className="mt-2 text-sm leading-7 text-[#687783]">با ثبت درخواست ارتقا از سوی عضو، پرونده در اینجا ظاهر می‌شود. این صفحه به‌صورت مستقیم از پرونده‌های مشترک سامانه می‌خواند.</p></section>:<div className="mt-6 grid gap-4">{items.map(item=><article key={item.id} className="rounded-2xl border border-[#D8D0C4] bg-white p-5 shadow-sm md:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="rounded-full bg-[#F7F5F0] px-3 py-1 text-xs font-bold">{targetLabel[item.target]||item.target}</span><h2 className="mt-3 text-xl font-extrabold">{item.member.fullName}</h2>{!readOnly&&<p className="mt-1 text-sm text-[#687783]">{item.member.email} · {item.member.phone}</p>}</div><span className={"rounded-full px-3 py-1 text-xs font-bold "+(item.status==="approved"?"bg-emerald-50 text-emerald-800":item.status==="rejected"?"bg-red-50 text-red-800":"bg-[#F7F0DF] text-[#77591E]")}>{statusLabel[item.status]}</span></div>
  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(readOnly?[["رده عضویت",item.member.membershipGrade],["امتیاز",String(item.member.pointsBalance)],["تاریخ درخواست",dateLabel(item.submittedAt)],["مسیر ارجاع",item.assignedRole==="artists"?"معاونت هنری":"معاونت CSR"]]:[["شهر",item.member.city],["تخصص فعلی",item.member.expertise],["رده عضویت",item.member.membershipGrade],["امتیاز",String(item.member.pointsBalance)],["تاریخ درخواست",dateLabel(item.submittedAt)],["مسیر ارجاع",item.assignedRole==="artists"?"معاونت هنری":"معاونت CSR"]]).map(([k,v])=><div key={k} className="rounded-xl bg-[#F7F5F0] p-3"><p className="text-xs text-[#687783]">{k}</p><p className="mt-1 break-words text-sm font-bold">{v||"ثبت نشده"}</p></div>)}</div>
  {!readOnly&&item.member.biography&&<p className="mt-3 whitespace-pre-wrap rounded-xl border border-[#E8E2D6] p-3 text-sm leading-7">{item.member.biography}</p>}
  {!readOnly&&<div className="mt-3 grid gap-3 sm:grid-cols-2">
   {([["عنوان حرفه‌ای","headline"],["تحصیلات","education"],["رشته تحصیلی","educationField"],["تخصص‌ها","specialties"],["سوابق کاری","experience"],["نمونه‌کارها و پیوندها","portfolio"],["معرفی حرفه‌ای","biography"],["رزومه متنی","resumeText"]] as const).map(([label,key])=>{const profile=item.target==="artist"?item.member.artistProfile:item.member.expertProfile;const value=profile?.[key];const display=Array.isArray(value)?value.join("، "):typeof value==="string"?value:"";return display?<div key={key} className="rounded-xl border border-[#E8E2D6] bg-white p-3"><p className="text-xs font-bold text-[#96763D]">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-7">{display}</p></div>:null})}
  </div>}
  {readOnly?<div className="mt-4 rounded-xl bg-[#F7F5F0] p-3 text-sm leading-6">این کارتابل فقط برای پیگیری وضعیت است. بررسی مدارک و ثبت تصمیم باید توسط واحد تخصصی مسئول انجام شود.</div>:item.status==="pending"||item.status==="needs_info"?<div className="mt-4"><label className="block text-sm font-bold">توضیحات بررسی / موارد تکمیلی<textarea className={inputClass+" mt-2"} rows={3} maxLength={3000} value={notes[item.id]||""} onChange={e=>setNotes(prev=>({...prev,[item.id]:e.target.value}))} placeholder="برای درخواست تکمیل یا رد، توضیح روشن و قابل اقدام بنویسید."/></label><div className="mt-3 flex flex-wrap gap-2"><button disabled={!!busy} onClick={()=>void decide(item,"approved")} className="rounded-xl bg-[#18304A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy===item.id?"در حال ثبت…":"تأیید و ارتقا"}</button><button disabled={!!busy} onClick={()=>void decide(item,"needs_info")} className="rounded-xl border border-[#D8D0C4] px-4 py-2.5 text-sm font-bold disabled:opacity-50">درخواست تکمیل</button><button disabled={!!busy} onClick={()=>void decide(item,"rejected")} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-50">رد درخواست</button></div></div>:<div className="mt-4 rounded-xl bg-[#F7F5F0] p-3 text-sm leading-6">بررسی‌کننده: {item.reviewer||"ثبت نشده"} · {item.reviewedAt?dateLabel(item.reviewedAt):""}{item.note&&<p className="mt-2 whitespace-pre-wrap">{item.note}</p>}</div>}
  </article>)}</div>}
 </div></main>
}
