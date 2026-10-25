"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";

type Member = { id:string; fullName:string; memberType:string; membershipTier:string; memberRank:string; status:string; phone:string; email:string; city:string; expertise:string; clubIds:string[]; rankHistory?:{from:string|null;to:string;at:string;actor:string}[] };
type PointEvent = {id:string;memberId:string;memberName:string;points:number;title:string;note:string;createdAt:string;actor:string};
const rankLabels:Record<string,string>={volunteer:"داوطلب",professional:"حرفه‌ای",club_manager:"مدیر باشگاه"};
const input="mt-2 w-full rounded-xl border border-[#D8D0C4] bg-white px-3 py-3 text-sm text-[#18304A] outline-none focus:border-[#B07800]";
const fmt=(n:number)=>new Intl.NumberFormat("fa-IR").format(n);
const date=(s:string)=>{const d=new Date(s);return Number.isNaN(d.getTime())?s:new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeStyle:"short"}).format(d);};

export default function MemberDossierPage(){
 const params=useParams<{id:string}>(); const router=useRouter(); const id=String(params.id||"");
 const [member,setMember]=useState<Member|null>(null); const [events,setEvents]=useState<PointEvent[]>([]);
 const [balance,setBalance]=useState(0); const [rank,setRank]=useState("volunteer");
 const [title,setTitle]=useState(""); const [points,setPoints]=useState(""); const [note,setNote]=useState("");
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{
   setLoading(true);setError("");
   try{
     const [recordsResponse,progressResponse]=await Promise.all([fetch("/api/records",{cache:"no-store"}),fetch("/api/member-progress?memberId="+encodeURIComponent(id),{cache:"no-store"})]);
     if(recordsResponse.status===401||progressResponse.status===401){router.replace("/login");return;}
     const records=await recordsResponse.json();const progress=await progressResponse.json();
     if(!recordsResponse.ok)throw new Error(records.error||"دریافت پرونده‌ها ناموفق بود.");
     if(!progressResponse.ok)throw new Error(progress.error||"دریافت سابقه ناموفق بود.");
     const found=(records.members||[]).find((m:Member)=>m.id===id);
     if(!found)throw new Error("پرونده عضو پیدا نشد.");
     setMember({...found,membershipTier:found.membershipTier||"affiliate",memberRank:found.memberRank||"volunteer"});
     setRank(progress.member.memberRank||"volunteer");setEvents(progress.pointEvents||[]);setBalance(Number(progress.pointsBalance)||0);
   }catch(e){setError(e instanceof Error?e.message:"دریافت پرونده ناموفق بود.");}
   finally{setLoading(false);}
 },[id,router]);
 useEffect(()=>{void load();},[load]);
 async function submit(e:FormEvent){
   e.preventDefault();setSaving(true);setError("");setNotice("");
   try{
     const payload:Record<string,unknown>={memberId:id,memberRank:rank};
     if(title.trim()){payload.title=title.trim();payload.points=Number(points);payload.note=note.trim();}
     const r=await fetch("/api/member-progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
     const d=await r.json();if(!r.ok)throw new Error(d.error||"ثبت تغییرات انجام نشد.");
     setTitle("");setPoints("");setNote("");setNotice("پرونده و سوابق عضو به‌روزرسانی شد.");await load();
   }catch(e){setError(e instanceof Error?e.message:"ثبت تغییرات انجام نشد.");}
   finally{setSaving(false);}
 }
 return <main dir="rtl" className="internal-app min-h-screen px-4 pb-16 pt-28 text-[#18304A]"><div className="container-site">
  <header className="rounded-3xl bg-[#18304A] p-6 text-white md:p-8"><a href="/internal/roles/members" className="text-sm font-bold text-[#F2A900]">← بازگشت به فهرست اعضا</a><p className="mt-4 text-sm text-[#E6EAF0]">پرونده اختصاصی عضو</p><h1 className="mt-1 text-3xl font-extrabold">{member?.fullName||"پرونده عضو"}</h1><p className="mt-2 text-sm text-[#E6EAF0]">نوع عضویت: عضو وابسته · رده فعلی: {rankLabels[member?.memberRank||"volunteer"]||"داوطلب"}</p></header>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  {loading?<div className="mt-6 rounded-2xl bg-white p-6">در حال دریافت پرونده…</div>:member?<div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
   <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#D8D0C4] md:p-6"><h2 className="text-xl font-extrabold">اطلاعات عضو</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["وضعیت",member.status],["تلفن",member.phone],["ایمیل",member.email],["شهر",member.city],["تخصص",member.expertise],["امتیاز کل",fmt(balance)]].map(([label,value])=><div key={label} className="rounded-xl bg-[#F7F5F0] p-3"><p className="text-xs text-[#65717B]">{label}</p><p className="mt-1 break-words text-sm font-bold">{value||"ثبت نشده"}</p></div>)}</div><div className="mt-5"><h3 className="font-extrabold">رده عضویت</h3><p className="mt-1 text-sm leading-6 text-[#65717B]">رده را می‌توان مستقل از نوع عضویت تغییر داد. تغییر رده در سابقه پرونده ثبت می‌شود.</p><div className="mt-3 flex flex-wrap gap-2">{(member.rankHistory||[]).slice().reverse().map((h,i)=><span key={i} className="rounded-full bg-[#F7F5F0] px-3 py-2 text-xs">{rankLabels[h.from||""]||"شروع"} ← {rankLabels[h.to]||h.to} · {date(h.at)}</span>)}</div></div></section>
   <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#D8D0C4] md:p-6"><h2 className="text-xl font-extrabold">ثبت امتیاز یا ارتقای رده</h2><form onSubmit={submit} className="mt-4 space-y-4">
    <label className="block text-sm font-bold">رده عضویت<select className={input} value={rank} onChange={e=>setRank(e.target.value)}><option value="volunteer">داوطلب</option><option value="professional">حرفه‌ای</option><option value="club_manager">مدیر باشگاه</option></select></label>
    <div className="rounded-xl bg-[#F7F5F0] p-4"><p className="font-bold">ثبت امتیاز فعالیت</p><p className="mt-1 text-xs leading-5 text-[#65717B]">برای تغییر رده بدون ثبت امتیاز، شرح امتیاز را خالی بگذارید. امتیاز مثبت یا منفی قابل ثبت است.</p>
     <label className="mt-3 block text-sm font-bold">شرح فعالیت / دلیل امتیاز<input className={input} value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} placeholder="مثلاً مشارکت در اجرای برنامه"/></label>
     <label className="mt-3 block text-sm font-bold">امتیاز (مثبت یا منفی)<input className={input} type="number" min={-10000} max={10000} step={1} required={!!title.trim()} value={points} onChange={e=>setPoints(e.target.value)} placeholder="مثلاً ۱۰ یا ۵-"/></label>
     <label className="mt-3 block text-sm font-bold">توضیح تکمیلی<textarea className={input} rows={3} maxLength={1200} value={note} onChange={e=>setNote(e.target.value)} placeholder="توضیحی برای سابقه داخلی پرونده"/></label>
    </div>
    <button disabled={saving} className="w-full rounded-xl bg-[#18304A] px-5 py-3 font-bold text-white disabled:opacity-50">{saving?"در حال ذخیره…":"ثبت تغییرات پرونده"}</button>
   </form></section>
   <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#D8D0C4] lg:col-span-2 md:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-extrabold">سابقه امتیازها</h2><span className="rounded-xl bg-[#F0DFB8] px-4 py-2 font-extrabold">مجموع: {fmt(balance)} امتیاز</span></div>{events.length?<div className="mt-4 space-y-3">{events.map(event=><article key={event.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#E5DED3] p-4"><div><h3 className="font-bold">{event.title}</h3><p className="mt-1 text-sm leading-6 text-[#65717B]">{event.note||"بدون توضیح تکمیلی"}</p><p className="mt-2 text-xs text-[#65717B]">{date(event.createdAt)} · ثبت‌کننده: {event.actor}</p></div><strong className={"text-lg "+(event.points<0?"text-red-700":"text-emerald-800")}>{event.points>0?"+":""}{fmt(event.points)}</strong></article>)}</div>:<p className="mt-4 rounded-xl bg-[#F7F5F0] p-5 text-sm text-[#65717B]">هنوز امتیازی برای این عضو ثبت نشده است.</p>}</section>
  </div>:<div className="mt-6 rounded-2xl bg-white p-6">پرونده عضو پیدا نشد.</div>}
 </div></main>;
}
