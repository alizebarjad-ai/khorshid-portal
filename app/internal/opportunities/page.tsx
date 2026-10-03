"use client";

import { useEffect, useState, type ReactNode } from "react";

type Role = "finance"|"ceo"|"deputy"|"beneficiary"|"economic"|"csr"|"media"|"artists"|"education"|"members";
type Status = "در حال بررسی قائم‌مقام"|"نیازمند تکمیل"|"ارسال به مدیرعامل"|"تشکیل تیم پروژه"|"در حال تدوین طرح و پروپوزال"|"قیمت‌گذاری و بررسی مالی"|"مذاکرات اولیه"|"ارسال طرح نهایی به مدیرعامل"|"تأیید نهایی مدیرعامل"|"قرارداد تنظیم شد"|"ثبت پروژه"|"رد توسط قائم‌مقام"|"رد توسط مدیرعامل در مرحله اول"|"رد نهایی مدیرعامل";
type Proposal = {id:string;code:string;type:string;title:string;clientName:string;clientContact:string;description:string;expectedValue:number;creator:string;creatorName:string;createdAt:string;status:Status|string;assignedTo:string;assignedToName:string;specialistBrief:string;proposalDetails:string;negotiationNote:string;contractNo:string;contractValue:number;contractDate:string;financeNote:string;directCost:number;rewardBase:number;history:Array<{id:string;date:string;actor:string;action:string;note:string}>;team?:string[];estimatedCost?:number;proposedPrice?:number;unitNote?:string};

const ROLE_LABEL:Record<Role,string>={finance:"معاون توسعه منابع مالی و اداری",ceo:"مدیرعامل",deputy:"قائم‌مقام و معاون برنامه‌ریزی و راهبردی",beneficiary:"ذی‌نفع پروژه",economic:"معاونت توسعه مشارکت‌های اقتصادی",csr:"معاونت اجتماعی برنامه‌های حمایتی",media:"معاونت رسانه و محتوا",artists:"معاونت امور هنرمندان",education:"معاونت آموزش، پژوهش و نوآوری",members:"معاونت مفاخر و امور اعضا"};
const TEAM_ROLES={deputy:"قائم‌مقام و معاون برنامه‌ریزی و راهبردی",csr:"معاونت اجتماعی برنامه‌های حمایتی",media:"معاونت رسانه و محتوا",artists:"معاونت امور هنرمندان",education:"معاونت آموزش، پژوهش و نوآوری",members:"معاونت مفاخر و امور اعضا",economic:"معاونت توسعه مشارکت‌های اقتصادی",finance:"معاون توسعه منابع مالی و اداری"};
const uid=()=>Math.random().toString(36).slice(2,10);
const today=()=>new Intl.DateTimeFormat("fa-IR",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()).replaceAll("/","-");
function normalize(x:any):Proposal{return {id:x.id||uid(),code:x.code||"",type:x.type||"پروژه",title:x.title||"",clientName:x.clientName||"",clientContact:x.clientContact||"",description:x.description||"",expectedValue:Number(x.expectedValue||0),creator:x.creator||"",creatorName:x.creatorName||"",createdAt:x.createdAt||today(),status:x.status||"در حال بررسی قائم‌مقام",assignedTo:x.assignedTo||"",assignedToName:x.assignedToName||"",specialistBrief:x.specialistBrief||"",proposalDetails:x.proposalDetails||"",negotiationNote:x.negotiationNote||"",contractNo:x.contractNo||"",contractValue:Number(x.contractValue||0),contractDate:x.contractDate||"",financeNote:x.financeNote||"",directCost:Number(x.directCost||0),rewardBase:Number(x.rewardBase||0),history:x.history||[],team:x.team||[],estimatedCost:Number(x.estimatedCost||0),proposedPrice:Number(x.proposedPrice||0),unitNote:x.unitNote||""};}

export default function OpportunitiesPage(){
 const [user,setUser]=useState<{username:string;name:string;role:Role}|null>(null); const [items,setItems]=useState<Proposal[]>([]); const [selected,setSelected]=useState(""); const [loading,setLoading]=useState(true);
 const [selectedStage,setSelectedStage]=useState<number|null>(null); const [note,setNote]=useState(""); const [contractNo,setContractNo]=useState(""); const [contractValue,setContractValue]=useState(""); const [contractDate,setContractDate]=useState(""); const [directCost,setDirectCost]=useState(""); const [rewardBase,setRewardBase]=useState(""); const [brief,setBrief]=useState(""); const [details,setDetails]=useState(""); const [negotiation,setNegotiation]=useState(""); const [cost,setCost]=useState(""); const [price,setPrice]=useState(""); const [unit,setUnit]=useState(""); const [team,setTeam]=useState<string[]>([]);
 useEffect(()=>{
  async function load(){
   try{
    const auth=await fetch("/api/auth/me");
    if(!auth.ok)throw new Error();
    const d=await auth.json();
    if(d.user?.role==="beneficiary"){location.href="/internal/my-reward";return;}
    setUser(d.user);
    const response=await fetch("/api/opportunities",{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"خطا در دریافت کارتابل");
    setItems((data.items||[]).map(normalize));
   }catch{location.href="/login";}
   finally{setLoading(false);}
  }
  load();
 },[]);
 const current=items.find(x=>x.id===selected)||null;
 useEffect(()=>{if(current){setBrief(current.specialistBrief);setDetails(current.proposalDetails);setNegotiation(current.negotiationNote);setCost(String(current.estimatedCost||""));setPrice(String(current.proposedPrice||""));setUnit(current.unitNote||"");setTeam(current.team||[]);setContractNo(current.contractNo||"");setContractValue(String(current.contractValue||current.proposedPrice||""));setContractDate(current.contractDate||"");setDirectCost(String(current.directCost||""));setRewardBase(String(current.rewardBase||current.contractValue||current.proposedPrice||""));}},[current]);
 const canDeputy=user?.role==="deputy", canCeo=user?.role==="ceo", canFinance=user?.role==="finance", canEconomic=user?.role==="economic";
 const canSpecialist=!!user&&["csr","media","artists","education","members"].includes(user.role); const canWork=canFinance||canEconomic||canSpecialist;
 const canEditTeamNow=canCeo&&!!current&&current.status!=="ثبت پروژه";
 const canViewHistory=canCeo||canDeputy;
 const isAssignedSpecialist=!!user&&current?.team?.includes(user.role);
 async function save(next:Partial<Proposal>,action:string,message?:string){
  if(!current||!user)return;
  try{
   const response=await fetch("/api/opportunities",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:current.id,patch:next,action,note:message||note})});
   const raw=await response.text();
   let data:any={};
   try{data=raw?JSON.parse(raw):{};}catch{data={error:raw||"پاسخ نامعتبر از سرور دریافت شد."};}
   if(!response.ok){
    throw new Error(data.error||`ذخیره انجام نشد. (HTTP ${response.status})`);
   }
   if(!data.item)throw new Error("سرور پاسخ ذخیره را برنگرداند.");
   setItems(prev=>prev.map(item=>item.id===data.item.id?normalize(data.item):item));
   setSelected(data.item.id);
  }catch(error){alert(error instanceof Error?error.message:"ذخیره انجام نشد.");}
 }
 const approveDeputy=()=>save({status:"ارسال به مدیرعامل"},"تأیید قائم‌مقام","پیشنهاد برای تصمیم مدیرعامل ارسال شد.");
 const requestMore=()=>save({status:"نیازمند تکمیل"},"درخواست تکمیل",note||"اطلاعات پیشنهاد باید تکمیل شود.");
 const rejectDeputy=()=>save({status:"رد توسط قائم‌مقام"},"رد پیشنهاد",note);
 const approveCeo=()=>save({status:"تشکیل تیم پروژه",team,assignedTo:team[0]||"deputy",assignedToName:team.map(r=>TEAM_ROLES[r as keyof typeof TEAM_ROLES]).join("، ")||"قائم‌مقام"},"تأیید مرحله اول و تشکیل تیم","فرصت برای تشکیل تیم و طراحی طرح تأیید شد. تیم ارجاع‌شده: "+(team.map(r=>TEAM_ROLES[r as keyof typeof TEAM_ROLES]).join("، ")||"تعیین نشده"));
 const updateCeoTeam=()=>{if(!current||!canCeo||current.status==="ارسال به مدیرعامل"||current.status==="رد توسط مدیرعامل در مرحله اول")return; save({team,assignedTo:team[0]||"deputy",assignedToName:team.map(r=>TEAM_ROLES[r as keyof typeof TEAM_ROLES]).join("، ")||"قائم‌مقام"},"اصلاح اعضای تیم","اعضای تیم توسط مدیرعامل اصلاح شد.");};
 const workflowStages=["در حال بررسی قائم‌مقام","ارسال به مدیرعامل","تشکیل تیم پروژه","در حال تدوین طرح و پروپوزال","قیمت‌گذاری و بررسی مالی","مذاکرات اولیه","ارسال طرح نهایی به مدیرعامل","تأیید نهایی مدیرعامل","قرارداد تنظیم شد","ثبت پروژه"];
 const currentStage=Math.max(0,workflowStages.indexOf(current?.status||""));
 const canMoveWorkflow=!!current && ((canCeo && ["ارسال طرح نهایی به مدیرعامل","تأیید نهایی مدیرعامل"].includes(current.status)) || (isAssignedSpecialist && ["تشکیل تیم پروژه","در حال تدوین طرح و پروپوزال","قیمت‌گذاری و بررسی مالی","مذاکرات اولیه"].includes(current.status)) || (canFinance && ["قرارداد تنظیم شد","ثبت پروژه"].includes(current.status)) || (canDeputy && current.status==="تأیید نهایی مدیرعامل"));
 const canSelectWorkflowStage=(index:number)=>{
   if(!current)return false;
   if(canCeo)return index===2&&current.status!=="ثبت پروژه";
   if(isAssignedSpecialist)return index>=2&&index<=5;
   if(canFinance)return index>=8&&index<=9;
   if(canDeputy)return false;
   return false;
 };
 const jumpWorkflow=(index:number)=>{
   if(!current||index!==2||!canCeo||current.status==="ثبت پروژه")return;
   if(currentStage===2)return;
   setSelectedStage(2);
 };
 const moveWorkflow=(direction:1|-1)=>{void direction;};
 const rejectCeo=()=>save({status:"رد توسط مدیرعامل در مرحله اول"},"رد مرحله اول",note);
 const formTeam=()=>save({status:"تشکیل تیم پروژه",team},"تشکیل تیم","اعضای تیم: "+(team.map(r=>TEAM_ROLES[r as keyof typeof TEAM_ROLES]).join("، ")||"تعیین نشده"));
 const startDesign=()=>save({status:"در حال تدوین طرح و پروپوزال",specialistBrief:brief,unitNote:unit},"ثبت خروجی تخصصی",brief);
 const saveCommercial=()=>save({status:"قیمت‌گذاری و بررسی مالی",proposalDetails:details,estimatedCost:Number(cost)||0,proposedPrice:Number(price)||0,unitNote:unit},"ثبت طرح و قیمت‌گذاری",unit);
 const sendNegotiation=()=>save({status:"مذاکرات اولیه",negotiationNote:negotiation},"آغاز مذاکرات اولیه",negotiation);
 const sendFinal=()=>save({status:"ارسال طرح نهایی به مدیرعامل",proposalDetails:details,negotiationNote:negotiation,estimatedCost:Number(cost)||0,proposedPrice:Number(price)||0},"ارسال طرح نهایی","طرح برای تأیید نهایی مدیرعامل ارسال شد.");
 const finalApprove=()=>save({status:"تأیید نهایی مدیرعامل"},"تأیید نهایی","طرح، قیمت و چارچوب تجاری برای ورود به قرارداد تأیید شد.");
 const markContract=()=>save({status:"قرارداد تنظیم شد",contractValue:Number(contractValue)||current?.proposedPrice||0,contractNo},"ثبت قرارداد تنظیم‌شده","قرارداد پس از امضا در پرونده ثبت شد و برای تکمیل اطلاعات مالی به معاون توسعه منابع مالی و اداری ارجاع شد.");
 const register=()=>save({status:"ثبت پروژه"},"تکمیل اطلاعات مالی","اطلاعات مالی قرارداد تکمیل شد و پرونده آماده استفاده در استخر پاداش است.");
 function logout(){fetch("/api/auth/logout",{method:"POST"}).finally(()=>location.href="/login");}
 if(loading||!user)return <main className="internal-app min-h-screen pt-28 pb-16"><div className="container-site"><div className="rounded-3xl bg-white p-8 text-center">در حال بررسی دسترسی...</div></div></main>;
 return <main className="internal-app min-h-screen pt-24 pb-16"><div className="container-site">
  <header className="rounded-3xl bg-[#18304A] p-6 text-white md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-[#F2A900]">سامانه گردش فرصت و پروژه</p><h1 className="mt-2 text-3xl font-extrabold">مدیریت پیشنهادها</h1><p className="mt-2 text-sm text-[#E6EAF0]">کاربر: {user.name} · {ROLE_LABEL[user.role]}</p></div><div className="flex flex-wrap gap-2"><a href="/internal/submit-proposal" className="inline-flex items-center justify-center rounded-xl bg-[#F2A900] px-4 py-2 text-sm font-extrabold text-[#18304A] shadow-sm hover:bg-[#FFC44D]">+ ثبت پیشنهاد اولیه</a><a href="/internal" className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white px-4 py-2 text-sm font-extrabold text-[#18304A] shadow-sm hover:bg-[#FFF4D6]">← صفحه اصلی سامانه</a><button onClick={logout} className="rounded-xl bg-white/10 px-4 py-2 font-bold text-white">خروج</button></div></div></header>
  <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#D8D0C4] bg-[#FFFDF8] p-3"><a href="/internal" className="inline-flex items-center justify-center rounded-xl border border-[#D8D0C4] bg-[#FFFDF8] px-5 py-3 text-sm font-extrabold text-[#18304A] shadow-sm hover:bg-[#FFF4D6]">← صفحه اصلی سامانه</a><span className="text-xs font-bold text-[#687687]">بازگشت به داشبورد و سایر بخش‌های سامانه</span></div>
  <div className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
   <aside className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#D8D0C4]"><div className="mb-3 flex items-center justify-between"><h2 className="font-extrabold">پرونده‌ها</h2><span className="text-xs text-[#687687]">{items.length} مورد</span></div><div className="space-y-2">{items.map(p=><button key={p.id} onClick={()=>setSelected(p.id)} className={selected===p.id?"w-full rounded-2xl border border-[#D99A16] bg-[#FFF4D6] p-3 text-right":"w-full rounded-2xl border border-[#E1DBD1] bg-[#FFFDF8] p-3 text-right"}><div className="font-bold">{p.title||"بدون عنوان"}</div><div className="mt-1 text-xs text-[#687687]">{p.code} · {p.status}</div></button>)}</div></aside>
   <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#D8D0C4] md:p-7">{!current?<div className="py-16 text-center text-[#687687]">یک پرونده را انتخاب کنید.</div>:<>
    <div className="border-b border-[#E2DCD3] pb-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-xs font-bold text-[#B07800]">{current.code}</span><h2 className="mt-1 text-2xl font-extrabold">{current.title}</h2></div><span className="rounded-full bg-[#F0EBE2] px-3 py-2 text-xs font-bold">{current.status}</span></div><div className="mt-3 grid gap-3 text-sm md:grid-cols-3"><div><b>نوع:</b> {current.type}</div><div><b>مشتری/برند:</b> {current.clientName||"ثبت نشده"}</div><div><b>ارزش اولیه:</b> {current.expectedValue?current.expectedValue.toLocaleString("fa-IR")+" ریال":"ثبت نشده"}</div></div><p className="mt-4 leading-7 text-[#526173]">{current.description}</p></div>
   {current && <>
    <div className="mb-5 rounded-2xl border border-[#D8D0C4] bg-[#FFFDF8] p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-extrabold">مراحل گردش پرونده</h2><p className="mt-1 text-xs text-[#687687]">کاربر مسئول می‌تواند پرونده را در محدوده مرحله کاری خود جلو یا عقب ببرد.</p></div><span className="rounded-full bg-[#FFF4D6] px-3 py-1 text-xs font-bold">{current.status}</span></div>
      <div className="grid gap-2 md:grid-cols-5">{workflowStages.map((stage,i)=>{const editable=i===2&&canEditTeamNow;const viewable=canViewHistory&&i<currentStage;const active=i===currentStage;return <button type="button" key={stage} onClick={()=>{if(editable)jumpWorkflow(i);else if(viewable)setSelectedStage(i);}} disabled={(!editable&&!viewable)|| (active&&!viewable)} className={`rounded-xl border px-3 py-2 text-right text-xs font-bold transition ${active?"border-[#D99A16] bg-[#FFF4D6]":"border-[#E1DBD1] bg-[#F7F3EC]"} ${editable||viewable?"cursor-pointer hover:border-[#D99A16] hover:bg-[#FFF4D6]":"cursor-default opacity-70"}`}>{i+1}. {stage}{viewable?" · مشاهده":""}</button>;})}</div>
      {canEditTeamNow && currentStage>2 && <p className="mt-3 rounded-xl bg-[#FFF4D6] p-3 text-xs leading-6 text-[#6A531B]">مدیرعامل می‌تواند از همین پرونده به مرحله «تشکیل تیم پروژه» برگردد و اعضای تیم را اصلاح کند. این بازگشت فقط برای ویرایش تیم است و مرحله فعلی پرونده را تغییر نمی‌دهد.</p>}
      {selectedStage!==null && selectedStage<currentStage && canViewHistory && <div className="mt-3 rounded-xl border border-[#D8D0C4] bg-white p-4"><div className="flex items-center justify-between gap-3"><b>مشاهده مرحله: {workflowStages[selectedStage]}</b><button type="button" className="text-xs font-bold text-[#B07800]" onClick={()=>setSelectedStage(null)}>بستن</button></div><div className="mt-3 grid gap-3 md:grid-cols-2 text-sm leading-7"><div><b>شرح پیشنهاد:</b><p className="text-[#526173]">{current.description||"ثبت نشده"}</p></div><div><b>خروجی تخصصی:</b><p className="text-[#526173]">{current.specialistBrief||"ثبت نشده"}</p></div><div><b>طرح و پروپوزال:</b><p className="text-[#526173]">{current.proposalDetails||"ثبت نشده"}</p></div><div><b>نتیجه مذاکرات:</b><p className="text-[#526173]">{current.negotiationNote||"ثبت نشده"}</p></div><div><b>هزینه برآوردی:</b><p className="text-[#526173]">{(current.estimatedCost||0).toLocaleString("fa-IR")} ریال</p></div><div><b>قیمت پیشنهادی:</b><p className="text-[#526173]">{(current.proposedPrice||0).toLocaleString("fa-IR")} ریال</p></div></div></div>}
    </div>
   </>}

    <div className="mt-6 grid gap-5">
     {canDeputy&&current.status==="در حال بررسی قائم‌مقام"&&<ActionCard title="اقدام قائم‌مقام"><Textarea label="یادداشت" value={note} set={setNote}/><div className="flex flex-wrap gap-2"><button onClick={approveDeputy} className="btn-primary px-5 py-3">تأیید و ارسال به مدیرعامل</button><button onClick={requestMore} className="btn-secondary px-5 py-3">درخواست تکمیل</button><button onClick={rejectDeputy} className="btn-danger px-5 py-3">رد پیشنهاد</button></div></ActionCard>}
     {canCeo&&canEditTeamNow&&(current.status==="ارسال به مدیرعامل"||current.status==="تشکیل تیم پروژه"||selectedStage===2)&&<ActionCard title={current.status==="ارسال به مدیرعامل"?"تأیید مرحله اول و تعیین تیم پروژه":"تعیین و اصلاح اعضای تیم پروژه"}><p className="text-sm leading-7 text-[#526173]">{current.status==="ارسال به مدیرعامل"?"با تأیید مرحله اول، مدیرعامل تیم موردنیاز را تعیین می‌کند و پرونده برای واحدهای انتخاب‌شده ارجاع می‌شود. این تأیید به معنی تأیید قیمت یا قرارداد نیست.":"این بخش مربوط به همین مرحله است. مدیرعامل می‌تواند اعضای تیم را تعیین یا اصلاح کند، سپس پرونده را به مرحله تدوین طرح و پروپوزال ارسال کند."}</p><div className="rounded-2xl border border-[#D8D0C4] bg-[#F5F1E9] p-4"><p className="mb-3 text-sm font-extrabold text-[#18304A]">واحدهای عضو تیم را انتخاب کنید</p><div className="grid gap-2 md:grid-cols-2">{Object.entries(TEAM_ROLES).map(([role,label])=><label key={role} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#D8D0C4] bg-white p-3 text-sm font-bold"><input type="checkbox" checked={team.includes(role)} onChange={e=>setTeam(v=>e.target.checked?[...v,role]:v.filter(r=>r!==role))}/><span>{label}</span></label>)}</div><p className="mt-3 text-xs leading-6 text-[#687687]">هر واحد انتخاب‌شده، پرونده را در کارتابل خود می‌بیند و مأموریت تخصصی خود را در ادامه فرایند ثبت می‌کند.</p></div><Textarea label="یادداشت / شرح مأموریت اولیه تیم" value={unit} set={setUnit}/><div className="flex flex-wrap gap-2">{current.status==="ارسال به مدیرعامل"?<><button disabled={!team.length} onClick={approveCeo} className="btn-primary px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50">ذخیره تیم و رفتن به مرحله بعد</button><button onClick={rejectCeo} className="btn-danger px-5 py-3">رد در مرحله اول</button></>:<button disabled={!team.length} onClick={()=>save({status:"در حال تدوین طرح و پروپوزال",team,assignedTo:team[0]||"deputy",assignedToName:team.map(r=>TEAM_ROLES[r as keyof typeof TEAM_ROLES]).join("، ")||"قائم‌مقام",unitNote:unit},"تأیید اعضای تیم","اعضای تیم تعیین شد و پرونده برای تدوین طرح و پروپوزال ارسال شد.")} className="btn-primary px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50">ذخیره تیم و رفتن به تدوین طرح</button>}</div></ActionCard>}

     {canWork&&isAssignedSpecialist&&["تشکیل تیم پروژه","در حال تدوین طرح و پروپوزال"].includes(current.status)&&<ActionCard title="کار تخصصی"><Textarea label="شرح مأموریت / نیازمندی" value={brief} set={setBrief}/><Textarea label="طرح و پروپوزال" value={details} set={setDetails}/><button onClick={startDesign} className="btn-primary px-5 py-3">ثبت خروجی تخصصی</button></ActionCard>}
     {(canEconomic||canFinance)&&["در حال تدوین طرح و پروپوزال","قیمت‌گذاری و بررسی مالی"].includes(current.status)&&<ActionCard title="توسعه مشارکت‌ها و مالی"><div className="grid gap-4 md:grid-cols-2"><Input label="برآورد هزینه" value={cost} set={setCost} type="number"/><Input label="قیمت پیشنهادی" value={price} set={setPrice} type="number"/></div><Textarea label="یادداشت تجاری / مالی" value={unit} set={setUnit}/><div className="flex flex-wrap gap-2"><button onClick={saveCommercial} className="btn-primary px-5 py-3">ثبت قیمت‌گذاری</button><button onClick={sendNegotiation} className="btn-secondary px-5 py-3">ثبت ورود به مذاکرات اولیه</button></div></ActionCard>}
     {(canEconomic||canDeputy)&&current.status==="مذاکرات اولیه"&&<ActionCard title="مذاکرات اولیه و جمع‌بندی"><Textarea label="نتیجه مذاکرات" value={negotiation} set={setNegotiation}/><Textarea label="طرح نهایی" value={details} set={setDetails}/><div className="grid gap-4 md:grid-cols-2"><Input label="هزینه نهایی" value={cost} set={setCost} type="number"/><Input label="قیمت نهایی پیشنهادی" value={price} set={setPrice} type="number"/></div>{canEconomic&&<button onClick={()=>save({status:"مذاکرات اولیه",proposalDetails:details,negotiationNote:negotiation,estimatedCost:Number(cost)||0,proposedPrice:Number(price)||0},"به‌روزرسانی مذاکرات","اطلاعات تجاری و مذاکرات به‌روزرسانی شد.")} className="btn-secondary px-5 py-3">ذخیره مذاکرات</button>}{canDeputy&&<button onClick={sendFinal} className="btn-primary px-5 py-3">ارسال طرح نهایی به مدیرعامل</button>}</ActionCard>}
     {canCeo&&current.status==="ارسال طرح نهایی به مدیرعامل"&&<ActionCard title="تأیید نهایی مدیرعامل"><div className="rounded-2xl bg-[#F5F1E9] p-4 text-sm leading-7">هزینه: <b>{(current.estimatedCost||0).toLocaleString("fa-IR")}</b> ریال · قیمت: <b>{(current.proposedPrice||0).toLocaleString("fa-IR")}</b> ریال</div><Textarea label="یادداشت تأیید" value={note} set={setNote}/><div className="flex flex-wrap gap-2"><button onClick={finalApprove} className="btn-primary px-5 py-3">تأیید نهایی و ارجاع برای قرارداد</button><button onClick={()=>save({status:"رد نهایی مدیرعامل"},"رد نهایی",note)} className="btn-danger px-5 py-3">رد نهایی</button></div></ActionCard>}
     {(canCeo||canDeputy)&&current.status==="تأیید نهایی مدیرعامل"&&<ActionCard title="ثبت تنظیم و امضای قرارداد"><p className="text-sm leading-7 text-[#526173]">پس از امضای قرارداد، این گزینه را ثبت کنید تا پرونده به‌صورت خودکار به معاون توسعه منابع مالی و اداری ارجاع شود.</p><Input label="شماره قرارداد / شناسه" value={contractNo} set={setContractNo}/><button disabled={!contractNo.trim()} onClick={markContract} className="btn-primary px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50">قرارداد تنظیم شد</button></ActionCard>}
     {canFinance&&current.status==="قرارداد تنظیم شد"&&<ActionCard title="تکمیل اطلاعات مالی قرارداد"><p className="text-sm leading-7 text-[#526173]">این اطلاعات مبنای ثبت پروژه و استفاده بعدی در استخر پاداش خواهد بود.</p><div className="grid gap-4 md:grid-cols-2"><Input label="شماره قرارداد" value={contractNo} set={setContractNo}/><Input label="تاریخ قرارداد" value={contractDate} set={setContractDate}/><Input label="مبلغ قرارداد" value={contractValue} set={setContractValue} type="number"/><Input label="هزینه مستقیم/اجرایی" value={directCost} set={setDirectCost} type="number"/><Input label="مبنای استخر پاداش" value={rewardBase} set={setRewardBase} type="number"/></div><Textarea label="یادداشت مالی" value={note} set={setNote}/><button onClick={()=>save({status:"ثبت پروژه",contractNo,contractDate,contractValue:Number(contractValue)||0,directCost:Number(directCost)||0,rewardBase:Number(rewardBase)||0,financeNote:note},"تکمیل اطلاعات مالی","اطلاعات مالی قرارداد تکمیل شد و پرونده برای استفاده در استخر پاداش آماده است.")} className="btn-primary px-5 py-3">تکمیل اطلاعات مالی و ثبت پروژه</button></ActionCard>}
    </div>
    <div className="mt-7 rounded-2xl bg-[#F5F1E9] p-5"><h3 className="font-extrabold">تاریخچه گردش کار</h3><div className="mt-4 space-y-3">{[...(current.history||[])].reverse().map(h=><div key={h.id} className="rounded-xl bg-white p-3 text-sm"><b>{h.action}</b><span className="mx-2 text-[#9AA3AE]">·</span>{h.actor}<span className="mx-2 text-[#9AA3AE]">·</span>{h.date}<p className="mt-1 text-[#687687]">{h.note}</p></div>)}</div></div>
   </>}</section>
  </div>
 </div></main>;
}
function ActionCard({title,children}:{title:string;children:ReactNode}){return <div className="rounded-2xl border border-[#D8D0C4] bg-[#FFFDF8] p-5"><h3 className="mb-4 font-extrabold text-[#18304A]">{title}</h3><div className="space-y-4">{children}</div></div>}

function Input({label,value,set,type="text"}:{label:string;value:string;set:(v:string)=>void;type?:string}){return <label className="block text-sm font-bold">{label}<input type={type} value={value} onChange={e=>set(e.target.value)} className="form-input mt-2"/></label>}
function Textarea({label,value,set}:{label:string;value:string;set:(v:string)=>void}){return <label className="block text-sm font-bold">{label}<textarea value={value} onChange={e=>set(e.target.value)} className="form-input mt-2 min-h-28 resize-y"/></label>}
