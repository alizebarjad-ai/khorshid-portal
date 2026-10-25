"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { dashboardPathForRole } from "@/lib/dashboard-path";

type Member = {id:string;kind:"member";fullName:string;memberType:string;membershipType?:string;membershipTier?:string;membershipRank?:string;rankHistory?:{from:string|null;to:string;at:string;actor:string;reason:string}[];supplementalData?:Record<string,string>;membershipHistory?:unknown[];status:string;phone:string;email:string;city:string;expertise:string;biography:string;clubIds:string[];notes:string;createdAt:string;updatedAt:string};
type PointEntry = {id:string;memberId:string;points:number;title:string;note:string;createdAt:string;createdBy:string};
type PointSummary = {balance:number;events:PointEntry[]};
type Club = {id:string;kind:"club";name:string;clubType:string;status:string;city:string;description:string;coordinator:string;contact:string;notes:string};
const blank = {fullName:"",memberType:"artist",membershipType:"affiliate",membershipTier:"affiliate",status:"pending",phone:"",email:"",city:"",expertise:"",biography:"",clubIds:[] as string[],supplementalData:{} as Record<string,string>,notes:""};
const typeLabel:Record<string,string>={artist:"هنرمند",figure:"چهره و صاحب‌نظر",supporter:"حامی",expert:"متخصص",organization:"شخصیت حقوقی"};
const rankLabel:Record<string,string>={volunteer:"داوطلب",professional:"حرفه‌ای",club_manager:"مدیر باشگاه"};
const membershipTypeLabel="عضو وابسته";
const statusLabel:Record<string,string>={pending:"در انتظار بررسی",active:"فعال",inactive:"غیرفعال",suspended:"تعلیق‌شده"};
const inputClass="w-full rounded-xl border border-[#D8D0C4] bg-white px-3 py-2.5 text-sm text-[#18304A] outline-none focus:border-[#B07800]";
export default function MembersPage(){
 const router=useRouter(); const [dashboardHref,setDashboardHref]=useState("/internal/roles/members"); const [members,setMembers]=useState<Member[]>([]); const [clubs,setClubs]=useState<Club[]>([]);
 const [form,setForm]=useState<any>(blank); const [editing,setEditing]=useState(""); const [query,setQuery]=useState(""); const [status,setStatus]=useState("all"); const [memberType,setMemberType]=useState("all");
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [deleting,setDeleting]=useState(""); const [error,setError]=useState(""); const [notice,setNotice]=useState("");
 const [pointsByMember,setPointsByMember]=useState<Record<string,PointSummary>>({}); const [actionBusy,setActionBusy]=useState(""); const [actionMessages,setActionMessages]=useState<Record<string,string>>({}); const [rankReasons,setRankReasons]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const [auth,r,pointsResponse]=await Promise.all([
    fetch("/api/auth/me",{cache:"no-store"}),
    fetch("/api/records",{cache:"no-store"}),
    fetch("/api/records/member-development",{cache:"no-store"})
   ]);
   if(auth.ok){const authData=await auth.json();setDashboardHref(dashboardPathForRole(authData.user?.role));}
   const d=await r.json();
   if(r.status===401){router.push("/login");return;}
   if(!r.ok)throw new Error(d.error||"دریافت اطلاعات ناموفق بود.");
   setMembers(d.members||[]);setClubs(d.clubs||[]);
   if(pointsResponse.ok){const pointData=await pointsResponse.json();setPointsByMember(pointData.pointsByMember||{});}
   setError("");
  }catch(e){setError(e instanceof Error?e.message:"خطا در دریافت اطلاعات");}
  finally{setLoading(false);}
 },[router]);
 useEffect(()=>{void load();},[load]);
 const filtered=useMemo(()=>members.filter(m=>(!query||[m.fullName,m.phone,m.email,m.city,m.expertise].some(v=>String(v||"").toLowerCase().includes(query.toLowerCase())))&&(status==="all"||m.status===status)&&(memberType==="all"||m.memberType===memberType)),[members,query,status,memberType]);
 function reset(){setForm(blank);setEditing("");setError("");}
 async function submit(e:FormEvent){e.preventDefault();setSaving(true);setError("");setNotice("");try{const r=await fetch("/api/records",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(editing?{kind:"member",id:editing,data:form}:{kind:"member",data:form})});const d=await r.json();if(!r.ok)throw new Error(d.error||"ذخیره انجام نشد.");setNotice(editing?"پرونده عضو به‌روزرسانی شد.":"عضو جدید ثبت شد.");reset();await load();}catch(e){setError(e instanceof Error?e.message:"ذخیره انجام نشد.");}finally{setSaving(false);}}
 function edit(m:Member){setEditing(m.id);setForm({fullName:m.fullName,memberType:m.memberType,membershipType:"affiliate",membershipTier:"affiliate",status:m.status,phone:m.phone,email:m.email,city:m.city,expertise:m.expertise,biography:m.biography,clubIds:m.clubIds||[],supplementalData:m.supplementalData||{},notes:m.notes});setNotice("");setError("");window.scrollTo({top:0,behavior:"smooth"});}
 async function awardPoints(e:FormEvent<HTMLFormElement>,m:Member){
  e.preventDefault();const formElement=e.currentTarget;const formData=new FormData(formElement);
  const points=Number(formData.get("points"));const title=String(formData.get("title")||"").trim();const note=String(formData.get("note")||"").trim();
  setActionBusy(m.id+":points");setActionMessages(current=>({...current,[m.id]:""}));
  try{
   const r=await fetch("/api/records/member-development",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"award-points",memberId:m.id,points,title,note})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"ثبت امتیاز ناموفق بود.");
   setPointsByMember(current=>{const old=current[m.id]||{balance:0,events:[]};return {...current,[m.id]:{balance:Number(d.pointsBalance)||old.balance+(Number(d.item?.points)||0),events:[d.item,...old.events].slice(0,200)}};});
   formElement.reset();setActionMessages(current=>({...current,[m.id]:"امتیاز با موفقیت در پرونده ثبت شد."}));
  }catch(e){setActionMessages(current=>({...current,[m.id]:e instanceof Error?e.message:"ثبت امتیاز ناموفق بود."}));}
  finally{setActionBusy("");}
 }
 async function promoteRank(m:Member){
  const reason=(rankReasons[m.id]||"").trim();if(reason.length<5){setActionMessages(current=>({...current,[m.id]:"برای ارتقا، دلیل کوتاه و روشن بنویسید."}));return;}
  setActionBusy(m.id+":rank");setActionMessages(current=>({...current,[m.id]:""}));
  try{
   const r=await fetch("/api/records/member-development",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"promote-tier",memberId:m.id,reason})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"ارتقای رده انجام نشد.");
   setMembers(current=>current.map(item=>item.id===m.id?{...item,membershipType:"affiliate",membershipTier:"affiliate",membershipRank:d.member.membershipRank,rankHistory:d.member.rankHistory||item.rankHistory||[]}:item));
   setRankReasons(current=>({...current,[m.id]:""}));setActionMessages(current=>({...current,[m.id]:"رده عضویت از «"+d.from+"» به «"+d.to+"» ارتقا یافت."}));
  }catch(e){setActionMessages(current=>({...current,[m.id]:e instanceof Error?e.message:"ارتقای رده انجام نشد."}));}
  finally{setActionBusy("");}
 }
 async function remove(m:Member){if(!window.confirm(`پرونده «${m.fullName}» حذف شود؟ این عملیات قابل بازگشت نیست.`))return;setDeleting(m.id);setError("");setNotice("");try{const r=await fetch("/api/records",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"member",id:m.id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"حذف پرونده انجام نشد.");if(editing===m.id)reset();setNotice("پرونده عضو حذف شد.");await load();}catch(e){setError(e instanceof Error?e.message:"حذف پرونده انجام نشد.");}finally{setDeleting("");}}
 return <main className="internal-app min-h-screen px-4 pb-16 pt-28 text-[#18304A]"><div className="container-site">
 <header className="rounded-3xl bg-[#18304A] p-6 text-white md:p-8"><a href={dashboardHref} className="text-sm text-[#F2A900]">← بازگشت به داشبورد</a><h1 className="mt-3 text-3xl font-extrabold">پرونده اعضا و مفاخر</h1><p className="mt-2 text-sm leading-7 text-[#E6EAF0]">ثبت، جست‌وجو و به‌روزرسانی اطلاعات اعضا؛ اطلاعات در فضای ذخیره‌سازی خصوصی سامانه نگهداری می‌شود.</p><div className="mt-5 flex flex-wrap gap-3"><span className="rounded-xl bg-white/10 px-4 py-2">کل پرونده‌ها: {members.length}</span><span className="rounded-xl bg-white/10 px-4 py-2">فعال: {members.filter(m=>m.status==="active").length}</span><a href="/internal/clubs" className="rounded-xl bg-[#F2A900] px-4 py-2 font-bold text-[#18304A]">مدیریت باشگاه‌ها ←</a><a href="/internal/history" className="rounded-xl border border-white/30 px-4 py-2 font-bold text-white">سوابق تغییرات</a></div></header>
 <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
 <form onSubmit={submit} className="h-fit rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#D8D0C4] md:p-6"><h2 className="text-xl font-extrabold">{editing?"ویرایش پرونده عضو":"ثبت عضو جدید"}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">
 <label className="text-sm font-bold sm:col-span-2">نام و نام خانوادگی *<input className={inputClass+" mt-2"} required value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/></label>
 <label className="text-sm font-bold">نوع پرونده<select className={inputClass+" mt-2"} value={form.memberType} onChange={e=>setForm({...form,memberType:e.target.value})}>{Object.entries(typeLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <label className="text-sm font-bold">نوع عضویت<div className={inputClass+" mt-2"}>عضو وابسته</div></label>
 <label className="text-sm font-bold">رده عضویت<div className={inputClass+" mt-2"}>{editing ? rankLabel[members.find(m=>m.id===editing)?.membershipRank||"volunteer"] : "داوطلب"}</div><span className="mt-1 block text-xs font-normal text-[#596474]">ارتقای رده فقط از پرونده عضو و همراه با ثبت دلیل انجام می‌شود.</span></label>
 {form.membershipTier==="affiliate"&&<div className="sm:col-span-2 grid gap-3 rounded-xl bg-[#F7F5F0] p-4 sm:grid-cols-2"><p className="sm:col-span-2 font-extrabold">اطلاعات تکمیلی عضو وابسته</p>{[["interestArea","باشگاه یا حوزه علاقه‌مندی"],["volunteerInterest","زمینه مشارکت داوطلبانه"],["availability","زمان در دسترس"],["participationRegion","شهر یا محدوده فعالیت"]].map(([key,label])=><label key={key} className="text-sm font-bold">{label}<input className={inputClass+" mt-2"} value={form.supplementalData?.[key]||""} onChange={e=>setForm({...form,supplementalData:{...(form.supplementalData||{}),[key]:e.target.value}})}/></label>)}</div>}
 {form.membershipTier==="professional"&&<div className="sm:col-span-2 grid gap-3 rounded-xl bg-[#F7F5F0] p-4 sm:grid-cols-2"><p className="sm:col-span-2 font-extrabold">اطلاعات تکمیلی عضو حرفه‌ای / تخصصی</p>{[["professionalExpertise","تخصص اصلی"],["portfolioUrl","پیوند نمونه آثار"],["professionalExperience","سابقه حرفه‌ای"],["collaborationInterest","زمینه همکاری مطلوب"]].map(([key,label])=><label key={key} className="text-sm font-bold">{label}<input className={inputClass+" mt-2"} value={form.supplementalData?.[key]||""} onChange={e=>setForm({...form,supplementalData:{...(form.supplementalData||{}),[key]:e.target.value}})}/></label>)}</div>}
 {form.membershipTier==="supporter_partner"&&<div className="sm:col-span-2 grid gap-3 rounded-xl bg-[#F7F5F0] p-4 sm:grid-cols-2"><p className="sm:col-span-2 font-extrabold">اطلاعات تکمیلی حامی / شریک سازمانی</p>{[["supportType","نوع حمایت یا مشارکت"],["supportCapacity","بازه تقریبی ظرفیت حمایت"],["partnerDetails","نام مجموعه / سمت تصمیم‌گیر"],["csrInterest","حوزه مسئولیت اجتماعی مورد علاقه"]].map(([key,label])=><label key={key} className="text-sm font-bold">{label}<input className={inputClass+" mt-2"} value={form.supplementalData?.[key]||""} onChange={e=>setForm({...form,supplementalData:{...(form.supplementalData||{}),[key]:e.target.value}})}/></label>)}</div>}
 <label className="text-sm font-bold">وضعیت عضویت<select className={inputClass+" mt-2"} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(statusLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <label className="text-sm font-bold">تلفن<input className={inputClass+" mt-2"} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} autoComplete="tel"/></label>
 <label className="text-sm font-bold">ایمیل<input className={inputClass+" mt-2"} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
 <label className="text-sm font-bold">شهر<input className={inputClass+" mt-2"} value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label>
 <label className="text-sm font-bold">حوزه تخصصی<input className={inputClass+" mt-2"} value={form.expertise} onChange={e=>setForm({...form,expertise:e.target.value})}/></label>
 <label className="text-sm font-bold sm:col-span-2">باشگاه‌های مرتبط<select multiple className={inputClass+" mt-2 min-h-24"} value={form.clubIds} onChange={e=>setForm({...form,clubIds:Array.from(e.target.selectedOptions).map(o=>o.value)})}>{clubs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><span className="mt-1 block text-xs font-normal text-[#596474]">برای انتخاب چند باشگاه از Ctrl یا Command استفاده کنید.</span></label>
 <label className="text-sm font-bold sm:col-span-2">معرفی کوتاه<textarea className={inputClass+" mt-2"} rows={3} value={form.biography} onChange={e=>setForm({...form,biography:e.target.value})}/></label>
 <label className="text-sm font-bold sm:col-span-2">یادداشت داخلی<textarea className={inputClass+" mt-2"} rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
 </div>{error&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice&&<p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}<div className="mt-5 flex gap-2"><button disabled={saving} className="rounded-xl bg-[#18304A] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving?"در حال ذخیره…":editing?"ذخیره تغییرات":"ثبت عضو"}</button>{editing&&<button type="button" onClick={reset} className="rounded-xl border px-4 py-3 text-sm">انصراف</button>}</div></form>
 <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#D8D0C4] md:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-extrabold">فهرست اعضا</h2><button onClick={()=>void load()} className="rounded-lg border px-3 py-2 text-sm">به‌روزرسانی</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_180px_180px]"><input className={inputClass} placeholder="جست‌وجوی نام، تلفن، شهر..." value={query} onChange={e=>setQuery(e.target.value)}/><select className={inputClass} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">همه وضعیت‌ها</option>{Object.entries(statusLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select className={inputClass} value={memberType} onChange={e=>setMemberType(e.target.value)}><option value="all">همه انواع پرونده</option>{Object.entries(typeLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>{loading?<p className="py-10 text-center text-sm">در حال دریافت اطلاعات…</p>:filtered.length===0?<p className="py-10 text-center text-sm text-[#596474]">پرونده‌ای مطابق جست‌وجو پیدا نشد.</p>:<div className="mt-4 space-y-3">{filtered.map(m=><article key={m.id} className="rounded-2xl border border-[#E5DED3] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{m.fullName}</h3><p className="mt-1 text-xs text-[#596474]">{typeLabel[m.memberType]||m.memberType} · {membershipTypeLabel} · رده {rankLabel[m.membershipRank||"volunteer"]||"داوطلب"} · {statusLabel[m.status]||m.status}{m.city?" · "+m.city:""}</p></div><div className="flex gap-2"><button onClick={()=>edit(m)} className="rounded-lg border border-[#D8D0C4] px-3 py-2 text-sm font-bold">ویرایش</button><button disabled={deleting===m.id} onClick={()=>void remove(m)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50">{deleting===m.id?"در حال حذف…":"حذف"}</button></div></div><div className="mt-3 grid gap-1 text-sm text-[#596474] sm:grid-cols-2">{m.phone&&<p>تلفن: {m.phone}</p>}{m.email&&<p>ایمیل: {m.email}</p>}{m.expertise&&<p>تخصص: {m.expertise}</p>}<p>باشگاه‌های مرتبط: {(m.clubIds||[]).map(id=>clubs.find(c=>c.id===id)?.name).filter(Boolean).join("، ")||"ثبت نشده"}</p></div>
 <details className="mt-4 rounded-xl border border-[#E5DED3] bg-[#F7F5F0] p-4">
  <summary className="cursor-pointer font-extrabold">ثبت امتیاز و ارتقای رده · {rankLabel[m.membershipRank||"volunteer"]||"داوطلب"}</summary>
  <div className="mt-4 grid gap-4 lg:grid-cols-2">
   <section className="rounded-xl bg-white p-4">
    <div className="flex items-center justify-between gap-3"><h4 className="font-extrabold">امتیازهای عضو</h4><span className="rounded-full bg-[#F0DFB8] px-3 py-1 text-xs font-bold">{new Intl.NumberFormat("fa-IR").format(pointsByMember[m.id]?.balance||0)} امتیاز</span></div>
    <form className="mt-3 grid gap-3" onSubmit={e=>void awardPoints(e,m)}>
     <label className="text-sm font-bold">امتیاز مثبت<input name="points" type="number" min="1" max="10000" step="1" required className={inputClass+" mt-1"} placeholder="مثلاً ۱۰"/></label>
     <label className="text-sm font-bold">شرح فعالیت<input name="title" maxLength={160} required className={inputClass+" mt-1"} placeholder="مثلاً مشارکت در اجرای برنامه"/></label>
     <label className="text-sm font-bold">توضیح تکمیلی (اختیاری)<textarea name="note" maxLength={1000} rows={2} className={inputClass+" mt-1"} placeholder="جزئیات یا مستند فعالیت"/></label>
     <button disabled={actionBusy===m.id+":points"} className="rounded-xl bg-[#18304A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{actionBusy===m.id+":points"?"در حال ثبت…":"ثبت امتیاز در پرونده"}</button>
    </form>
    <div className="mt-4 border-t border-[#E5DED3] pt-3"><p className="text-xs font-extrabold">آخرین سوابق</p>{(pointsByMember[m.id]?.events||[]).slice(0,4).length?<div className="mt-2 space-y-2">{(pointsByMember[m.id]?.events||[]).slice(0,4).map(point=><div key={point.id} className="flex items-start justify-between gap-3 text-xs"><div><p className="font-bold">{point.title}</p><p className="mt-1 text-[#687783]">{point.note||new Date(point.createdAt).toLocaleDateString("fa-IR")}</p></div><strong className="shrink-0 text-emerald-800">+{new Intl.NumberFormat("fa-IR").format(point.points)}</strong></div>)}</div>:<p className="mt-2 text-xs text-[#687783]">هنوز امتیازی ثبت نشده است.</p>}</div>
   </section>
   <section className="rounded-xl bg-white p-4">
    <h4 className="font-extrabold">ارتقای رده عضویت</h4><p className="mt-2 text-sm text-[#596474]">نوع عضویت: عضو وابسته · رده فعلی: {rankLabel[m.membershipRank||"volunteer"]||"داوطلب"}</p>
    {(m.membershipRank||"volunteer")==="club_manager"?<p className="mt-4 rounded-lg bg-[#F7F5F0] p-3 text-sm">این عضو در بالاترین رده تعریف‌شده فعلی قرار دارد.</p>:<form className="mt-3 grid gap-3" onSubmit={e=>{e.preventDefault();void promoteRank(m);}}>
     <p className="rounded-lg bg-[#F7F5F0] p-3 text-sm">رده بعدی: <strong>{(m.membershipRank||"volunteer")==="volunteer"?"حرفه‌ای":"مدیر باشگاه"}</strong></p>
     <label className="text-sm font-bold">دلیل ارتقا<textarea value={rankReasons[m.id]||""} onChange={e=>setRankReasons(current=>({...current,[m.id]:e.target.value}))} required minLength={5} maxLength={1000} rows={3} className={inputClass+" mt-1"} placeholder="مبنای ارتقا، مشارکت یا مسئولیت پذیرفته‌شده را بنویسید."/></label>
     <button disabled={actionBusy===m.id+":rank"} className="rounded-xl bg-[#F2A900] px-4 py-2.5 text-sm font-extrabold text-[#18304A] disabled:opacity-50">{actionBusy===m.id+":rank"?"در حال ثبت…":"تأیید و ارتقای رده"}</button>
    </form>}
    {(m.rankHistory||[]).length>0&&<div className="mt-4 border-t border-[#E5DED3] pt-3"><p className="text-xs font-extrabold">سوابق ارتقا</p><div className="mt-2 space-y-2">{(m.rankHistory||[]).slice().reverse().slice(0,4).map((h,i)=><div key={h.at+"-"+i} className="text-xs"><p className="font-bold">از {rankLabel[h.from||""]||"بدون رده"} به {rankLabel[h.to]||h.to}</p><p className="mt-1 text-[#687783]">{new Date(h.at).toLocaleDateString("fa-IR")} · {h.reason}</p></div>)}</div></div>}
   </section>
  </div>
  {actionMessages[m.id]&&<p role="status" className="mt-3 rounded-lg bg-[#F0DFB8] p-3 text-sm text-[#18304A]">{actionMessages[m.id]}</p>}
 </details></article>)}</div>}</section>
 </section></div></main>;
}
