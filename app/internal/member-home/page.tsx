"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type UpgradeRequest = { id:string; target:"artist"|"expert"|"consultant"; status:"pending"|"approved"|"rejected"|"needs_info"; assignedRole:"artists"|"csr"; submittedAt:string; reviewedAt?:string; reviewer?:string; note?:string };
type ProfessionalProfile = { headline?:string; specialties?:string|string[]; education?:string; educationField?:string; experience?:string; portfolio?:string; biography?:string; website?:string; resumeText?:string; submittedAt?:string; verified?:boolean };
type Member = { id:string; fullName:string; memberType:string; membershipTier?:string; membershipGrade?:string; phone:string; email:string; city:string; expertise:string; biography:string; status:string; clubIds:string[]; artistProfile?:ProfessionalProfile; expertProfile?:ProfessionalProfile; upgradeRequests?:UpgradeRequest[] };
type Club = { id:string; name:string; clubType:string; city:string; description:string; status:string };
type Program = { id:string; title:string; description:string; startsAt:string; location:string; clubName:string; format:string; href?:string };
type ClubFeedItem = { id:string; kind:string; title:string; description?:string; dateLabel?:string; href?:string; clubIds?:string[]; showToMembers?:boolean };
type PointEvent = { id:string; title:string; points:number; createdAt:string; note:string };
type ContentSubmission = { id:string; title:string; kind:"text"|"image"|"video"; status:string; createdAt:string; description?:string; mediaNote?:string; adminNote?:string };
type DashboardData = { pointsBalance:number; pointEvents:PointEvent[]; programs:Program[] };
const tierLabels:Record<string,string>={affiliate:"عضو وابسته",professional:"عضو حرفه‌ای / تخصصی",supporter_partner:"حامی مالی / شریک سازمانی"};
const typeLabels:Record<string,string>={individual:"شخص حقیقی",artist:"هنرمند",figure:"چهره و صاحب‌نظر",supporter:"حامی",expert:"متخصص",organization:"شخصیت حقوقی",media:"رسانه"};
const gradeLabels:Record<string,string>={volunteer:"داوطلب",professional:"حرفه‌ای",club_manager:"مدیر باشگاه"};
const inputClass="w-full rounded-xl border border-[#D8D0C4] bg-white px-3 py-3 text-sm text-[#18304A] outline-none focus:border-[#B99450]";
const services = [
 {icon:"✦",title:"برنامه‌ها و نشست‌های اعضا",description:"دسترسی به برنامه‌های اعلام‌شده برای باشگاه‌ها و رده عضویت شما.",status:"قابل استفاده",ready:true},
 {icon:"◎",title:"باشگاه‌های تخصصی",description:"پیگیری باشگاه‌هایی که عضویت شما در آن‌ها ثبت شده است.",status:"قابل استفاده",ready:true},
 {icon:"↗",title:"ارسال اثر و محتوای تولیدی",description:"ثبت متن، تصویر یا ویدیو برای بررسی و انتشار توسط تیم مربوطه.",status:"ارسال به کارتابل معاون رسانه",ready:true},
 {icon:"◇",title:"فرصت‌های آموزشی و همکاری",description:"اطلاع‌رسانی فرصت‌های مرتبط پس از ثبت رسمی در سامانه.",status:"به‌تدریج فعال می‌شود",ready:false},
 {icon:"＋",title:"خدمات و مزایای ویژه اعضا",description:"نمایش مزایای فعال بر اساس رده عضویت و توافق‌های نهایی سازمان.",status:"در حال تکمیل",ready:false},
];
const money = (value:number) => new Intl.NumberFormat("fa-IR").format(value);
const dateLabel = (value:string) => { if(!value) return "زمان متعاقباً اعلام می‌شود"; const d=new Date(value); return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeStyle:"short"}).format(d); };

export default function MemberHomePage(){
 const router=useRouter();
 const [member,setMember]=useState<Member|null>(null);
 const [clubs,setClubs]=useState<Club[]>([]);
 const [dashboard,setDashboard]=useState<DashboardData>({pointsBalance:0,pointEvents:[],programs:[]});
 const [loading,setLoading]=useState(true);
 const [currentPassword,setCurrentPassword]=useState("");
 const [newPassword,setNewPassword]=useState("");
 const [confirm,setConfirm]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [editing,setEditing]=useState(false);
 const [city,setCity]=useState("");
 const [expertise,setExpertise]=useState("");
 const [biography,setBiography]=useState("");
 const [upgradeTarget,setUpgradeTarget]=useState<"artist"|"expert"|"consultant">("artist");
 const [professionalHeadline,setProfessionalHeadline]=useState("");
 const [professionalSpecialties,setProfessionalSpecialties]=useState("");
 const [professionalEducation,setProfessionalEducation]=useState("");
 const [professionalExperience,setProfessionalExperience]=useState("");
 const [professionalPortfolio,setProfessionalPortfolio]=useState("");
 const [professionalBio,setProfessionalBio]=useState("");
 const [professionalWebsite,setProfessionalWebsite]=useState("");
 const [upgradeBusy,setUpgradeBusy]=useState(false);

 const [contentType,setContentType]=useState<"text"|"image"|"video">("text");
 const [contentTitle,setContentTitle]=useState("");
 const [contentText,setContentText]=useState("");
 const [contentDescription,setContentDescription]=useState("");
 const [contentFile,setContentFile]=useState<File|null>(null);
 const [contentPreview,setContentPreview]=useState("");
 const [contentNotice,setContentNotice]=useState("");
 const [contentError,setContentError]=useState("");
 const [contentPrepared,setContentPrepared]=useState(false);
 const [contentSubmissions,setContentSubmissions]=useState<ContentSubmission[]>([]);
 const [loggingOut,setLoggingOut]=useState(false);

 useEffect(()=>{
   let cancelled=false;
   async function load(){
     setLoading(true);setError("");
     try{
       const [profileResponse,dashboardResponse,feedResponse,contentResponse]=await Promise.all([
         fetch("/api/member/profile",{cache:"no-store"}),
         fetch("/api/member/dashboard",{cache:"no-store"}),
         fetch("/api/club-feed",{cache:"no-store"}),
         fetch("/api/member-content",{cache:"no-store"})
       ]);
       const profile=await profileResponse.json();
       if(profileResponse.status===401||profileResponse.status===403){router.replace("/login");return;}
       if(!profileResponse.ok)throw new Error(profile.error||"دریافت پرونده ناموفق بود.");
       const dash=dashboardResponse.ok?await dashboardResponse.json():{pointsBalance:0,pointEvents:[],programs:[]};
       const feedData=feedResponse.ok?await feedResponse.json():{items:[]};
       const contentData=contentResponse.ok?await contentResponse.json():{items:[]};
       const sharedPrograms:Program[]=(Array.isArray(feedData.items)?feedData.items:[])
         .filter((item:ClubFeedItem)=>item.showToMembers===true)
         .map((item:ClubFeedItem)=>({id:"site-"+item.id,title:item.title,description:item.description||"",startsAt:item.dateLabel||"",location:"",clubName:(item.clubIds||[]).length?"باشگاه تخصصی":"خورشید مفاخر",format:item.kind==="project"?"پروژه":item.kind==="announcement"?"اطلاعیه":"برنامه",href:item.href?(item.href.startsWith("http")?item.href:"https://www.khorshid-mafakher.ir"+item.href):undefined}));
       if(cancelled)return;
       setMember(profile.member);setCity(profile.member.city||"");setExpertise(profile.member.expertise||"");setBiography(profile.member.biography||"");
       setClubs(profile.clubs||[]);
       setContentSubmissions(Array.isArray(contentData.items)?contentData.items:[]);
       setDashboard({pointsBalance:Number(dash.pointsBalance)||0,pointEvents:Array.isArray(dash.pointEvents)?dash.pointEvents:[],programs:[...(Array.isArray(dash.programs)?dash.programs:[]),...sharedPrograms]});
     }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"دریافت پرونده ناموفق بود.");}
     finally{if(!cancelled)setLoading(false);}
   }
   void load();
   return ()=>{cancelled=true;};
 },[router]);

 useEffect(()=>{
   const profile = upgradeTarget==="artist" ? member?.artistProfile : member?.expertProfile;
   if(!profile) return;
   setProfessionalHeadline(String(profile.educationField||profile.headline||""));
   const specialties=profile.specialties;
   setProfessionalSpecialties(Array.isArray(specialties)?specialties.join("، "):typeof specialties==="string"?specialties:"");
   setProfessionalEducation(String(profile.education||""));
   setProfessionalExperience(String(profile.experience||""));
   setProfessionalPortfolio(String(profile.portfolio||""));
   setProfessionalBio(String(profile.biography||""));
   setProfessionalWebsite(String(profile.website||""));
 },[member,upgradeTarget]);

 useEffect(()=>{
   if(!contentFile){setContentPreview("");return;}
   const url=URL.createObjectURL(contentFile);setContentPreview(url);
   return ()=>URL.revokeObjectURL(url);
 },[contentFile]);

 async function changePassword(e:FormEvent){
   e.preventDefault();setError("");setNotice("");
   if(newPassword.length<12){setError("رمز جدید باید دست‌کم ۱۲ نویسه داشته باشد.");return;}
   if(newPassword!==confirm){setError("تکرار رمز جدید یکسان نیست.");return;}
   if(newPassword===currentPassword){setError("رمز جدید باید با رمز فعلی متفاوت باشد.");return;}
   setBusy(true);
   try{const r=await fetch("/api/auth/change-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword,newPassword})});const d=await r.json();if(!r.ok)throw new Error(d.error||"تغییر رمز انجام نشد.");setCurrentPassword("");setNewPassword("");setConfirm("");setNotice("رمز عبور با موفقیت تغییر کرد.");}
   catch(e){setError(e instanceof Error?e.message:"تغییر رمز انجام نشد.");}
   finally{setBusy(false);}
 }
 async function saveProfile(e:FormEvent){
   e.preventDefault();setError("");setNotice("");setBusy(true);
   try{const r=await fetch("/api/member/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({city,expertise,biography})});const d=await r.json();if(!r.ok)throw new Error(d.error||"ذخیره پرونده انجام نشد.");setMember(d.member);setEditing(false);setNotice("اطلاعات پرونده ذخیره شد.");}
   catch(e){setError(e instanceof Error?e.message:"ذخیره پرونده انجام نشد.");}
   finally{setBusy(false);}
 }

 async function submitUpgrade(e:FormEvent){
   e.preventDefault();setError("");setNotice("");setUpgradeBusy(true);
   try{
     const response=await fetch("/api/member-upgrades",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target:upgradeTarget,headline:professionalHeadline,education:professionalEducation,educationField:professionalHeadline,experience:professionalExperience,specialties:professionalSpecialties,portfolio:professionalPortfolio,website:professionalWebsite,biography:professionalBio,resumeText:""})});
     const data=await response.json();
     if(!response.ok)throw new Error(data.error||"ثبت درخواست ارتقا انجام نشد.");
     setMember(prev=>prev?{...prev,upgradeRequests:data.member?.upgradeRequests||prev.upgradeRequests,artistProfile:data.member?.artistProfile||prev.artistProfile,expertProfile:data.member?.expertProfile||prev.expertProfile}:prev);
     setNotice(data.resubmitted ? "اطلاعات اصلاح‌شده ثبت شد و همان درخواست دوباره برای بررسی ارسال شد." : "درخواست شما ثبت شد و برای بررسی به کارتابل معاونت مربوطه ارسال شده است.");
   }catch(err){setError(err instanceof Error?err.message:"ثبت درخواست ارتقا انجام نشد.");}
   finally{setUpgradeBusy(false);}
 }
 function selectContentFile(e:ChangeEvent<HTMLInputElement>){
   const file=e.target.files?.[0]||null;setContentError("");setContentNotice("");setContentPrepared(false);
   if(!file){setContentFile(null);return;}
   const validType=contentType==="image"?file.type.startsWith("image/"):file.type.startsWith("video/");
   if(!validType){setContentError(contentType==="image"?"برای این نوع محتوا یک فایل تصویر انتخاب کنید.":"برای این نوع محتوا یک فایل ویدیویی انتخاب کنید.");e.target.value="";setContentFile(null);return;}
   if(file.size>25*1024*1024){setContentError("حجم فایل باید حداکثر ۲۵ مگابایت باشد.");e.target.value="";setContentFile(null);return;}
   setContentFile(file);
 }
 async function prepareContent(e:FormEvent<HTMLFormElement>){
   e.preventDefault();setContentError("");setContentNotice("");
   if(!contentTitle.trim()){setContentError("عنوان محتوا را وارد کنید.");return;}
   if(contentType==="text"&&!contentText.trim()){setContentError("متن محتوای خود را وارد کنید.");return;}
   if(contentType!=="text"&&!contentFile){setContentError("ابتدا فایل موردنظر را انتخاب کنید.");return;}
   if(contentFile&&contentFile.size>25*1024*1024){setContentError("حداکثر اندازه فایل ۲۵ مگابایت است.");return;}
   setContentPrepared(false);setBusy(true);
   try{
     const form=new FormData();
     form.set("kind",contentType);form.set("title",contentTitle.trim());form.set("description",contentDescription.trim());
     if(contentType==="text")form.set("text",contentText);
     else if(contentFile)form.set("file",contentFile);
     const response=await fetch("/api/member-content",{method:"POST",body:form});
     const data=await response.json();
     if(!response.ok)throw new Error(data.error||"ارسال محتوا انجام نشد.");
     setContentPrepared(true);if(data.item)setContentSubmissions(prev=>[data.item as ContentSubmission,...prev.filter(item=>item.id!==data.item.id)]);setContentNotice("محتوا با موفقیت برای بررسی معاون رسانه ارسال شد. وضعیت آن اکنون در فهرست پیگیری ثبت شده است.");
     setContentTitle("");setContentText("");setContentDescription("");setContentFile(null);setContentPreview("");
   }catch(error){setContentError(error instanceof Error?error.message:"ارسال محتوا انجام نشد.");}
   finally{setBusy(false);}
 }
 async function logout(){
   setLoggingOut(true);
   try{await fetch("/api/auth/logout",{method:"POST"});}finally{router.replace("/login");router.refresh();}
 }

 const upcomingPrograms=useMemo(()=>dashboard.programs.filter(p=>!p.startsAt||new Date(p.startsAt).getTime()>=Date.now()),[dashboard.programs]);
 const activeClubs=clubs.filter(c=>c.status==="active");
 const memberTier=tierLabels[member?.membershipTier||""]||"عضو خورشید";
 const memberType=typeLabels[member?.memberType||""]||member?.memberType||"عضو";
 const memberGrade=gradeLabels[member?.membershipGrade||""]||"داوطلب";
 const sections=[["home","نمای کلی"],["programs","برنامه‌ها"],["clubs","باشگاه‌های من"],["services","خدمات و امتیاز"],["content","ارسال محتوا"],["profile","پرونده من"]];

 return <main className="internal-app min-h-screen pb-24 text-[#172F48]">
   <div className="sticky top-0 z-30 border-b border-[#E3E0D8] bg-[#F7F5F0]/95 shadow-sm backdrop-blur">
     <div className="container-site flex items-center justify-between gap-3 py-3">
       <a href="#home" className="flex min-w-0 items-center gap-2"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#172F48] text-lg font-black text-[#B99450]">خ</span><span className="min-w-0"><strong className="block truncate text-sm">خورشید مفاخر</strong><span className="block text-[11px] text-[#687783]">باشگاه اعضا</span></span></a>
       <div className="flex shrink-0 items-center gap-2"><a href="https://www.khorshid-mafakher.ir/" className="hidden rounded-lg px-3 py-2 text-xs font-bold text-[#526173] sm:inline-flex">وب‌سایت اصلی ↗</a><button onClick={logout} disabled={loggingOut} className="rounded-xl border border-[#D8D0C4] bg-white px-3 py-2 text-xs font-bold disabled:opacity-50">{loggingOut?"در حال خروج…":"خروج"}</button></div>
     </div>
     <nav aria-label="منوی اعضا" className="container-site flex gap-2 overflow-x-auto pb-3">
       {sections.map(([id,label])=><a key={id} href={"#"+id} className="shrink-0 rounded-full border border-[#E3E0D8] bg-white px-4 py-2 text-xs font-bold text-[#526173] transition hover:border-[#B99450] hover:bg-[#F0DFB8] hover:text-[#172F48]">{label}</a>)}
     </nav>
   </div>
   <div className="container-site pt-5 md:pt-8">
     {error&&<p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
     {notice&&<p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
     {loading?<div className="rounded-3xl border border-[#E3E0D8] bg-white p-8 text-center">در حال دریافت پرونده شما…</div>:member?<>
       <section id="home" className="scroll-mt-36 overflow-hidden rounded-[28px] bg-[#172F48] p-5 text-white shadow-lg md:p-8">
         <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
           <div className="min-w-0"><p className="text-xs font-bold tracking-wide text-[#D7B978]">جامعه اعضای خورشید مفاخر</p><h1 className="mt-2 text-2xl font-extrabold md:text-3xl">سلام {member.fullName}</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-[#E6EAF0]">اینجا مرکز شخصی شما برای برنامه‌های باشگاهی، خدمات عضویت، امتیازها و ارسال آثار است.</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">{memberType}</span><span className="rounded-full bg-[#F0DFB8] px-3 py-1.5 text-xs font-bold text-[#172F48]">{memberTier}</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold">{memberGrade}</span><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">عضویت فعال</span></div></div>
           <div className="grid w-full grid-cols-2 gap-3 sm:max-w-[270px]"><div className="rounded-2xl border border-white/10 bg-white/10 p-4"><span className="text-xs text-[#E6EAF0]">باشگاه‌های فعال</span><strong className="mt-1 block text-2xl">{money(activeClubs.length)}</strong></div><div className="rounded-2xl border border-white/10 bg-white/10 p-4"><span className="text-xs text-[#E6EAF0]">امتیاز ثبت‌شده</span><strong className="mt-1 block text-2xl">{money(dashboard.pointsBalance)}</strong></div></div>
         </div>
       </section>
       <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
         {[{label:"برنامه‌های پیش‌رو",value:upcomingPrograms.length,icon:"▦",href:"#programs"},{label:"باشگاه‌های من",value:clubs.length,icon:"◎",href:"#clubs"},{label:"خدمات قابل استفاده",value:services.filter(s=>s.ready).length,icon:"✦",href:"#services"},{label:"سوابق امتیاز",value:dashboard.pointEvents.length,icon:"◇",href:"#services"}].map(item=><a key={item.label} href={item.href} className="rounded-2xl border border-[#E3E0D8] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#B99450]"><span className="text-lg text-[#B99450]">{item.icon}</span><strong className="mt-1 block text-2xl">{money(item.value)}</strong><span className="mt-1 block text-xs leading-5 text-[#687783]">{item.label}</span></a>)}
       </section>

       <section id="programs" className="mt-8 scroll-mt-36">
         <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold text-[#96763D]">تقویم اختصاصی</p><h2 className="mt-1 text-xl font-extrabold">برنامه‌های پیش‌رو</h2></div><span className="rounded-full bg-[#EEECE6] px-3 py-1 text-xs text-[#526173]">ویژه باشگاه‌های شما</span></div>
         {upcomingPrograms.length?<div className="grid gap-3 md:grid-cols-2">{upcomingPrograms.map(p=><article key={p.id} className="rounded-2xl border border-[#E3E0D8] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="rounded-lg bg-[#F0DFB8] px-2.5 py-1 text-xs font-bold text-[#172F48]">{p.format||"برنامه باشگاهی"}</span><span className="text-xs text-[#687783]">{dateLabel(p.startsAt)}</span></div><h3 className="mt-3 font-extrabold">{p.href?<a href={p.href} target="_blank" rel="noopener noreferrer" className="hover:text-[#B07800]">{p.title} ↗</a>:p.title}</h3><p className="mt-2 text-sm leading-6 text-[#687783]">{p.description||"توضیحات تکمیلی متعاقباً اعلام می‌شود."}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-[#526173]"><span>باشگاه: {p.clubName||"خورشید مفاخر"}</span>{p.location&&<span>· مکان: {p.location}</span>}</div></article>)}</div>:<div className="rounded-2xl border border-dashed border-[#D8D0C4] bg-white p-6"><p className="font-bold">فعلاً برنامه‌ای برای باشگاه‌های شما ثبت نشده است.</p><p className="mt-2 text-sm leading-7 text-[#687783]">به‌محض اینکه برنامه‌ای برای یکی از باشگاه‌های عضو شما در سامانه ثبت و منتشر شود، زمان و جزئیات آن در همین بخش نمایش داده می‌شود.</p></div>}
       </section>

       <section id="clubs" className="mt-8 scroll-mt-36">
         <div className="mb-4"><p className="text-xs font-bold text-[#96763D]">شبکه ارتباطی شما</p><h2 className="mt-1 text-xl font-extrabold">باشگاه‌های من</h2></div>
         <div className="grid gap-3 md:grid-cols-2">{clubs.map(club=><article key={club.id} className="rounded-2xl border border-[#E3E0D8] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><h3 className="font-extrabold">{club.name}</h3><span className={"shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold "+(club.status==="active"?"bg-emerald-50 text-emerald-800":"bg-[#EEECE6] text-[#526173]")}>{club.status==="active"?"فعال":"در حال برنامه‌ریزی"}</span></div><p className="mt-2 text-xs text-[#687783]">{club.city||"سراسری"}{club.clubType? " · "+club.clubType:""}</p><p className="mt-3 text-sm leading-7 text-[#526173]">{club.description||"معرفی باشگاه هنوز تکمیل نشده است."}</p></article>)}{!clubs.length&&<div className="rounded-2xl border border-dashed border-[#D8D0C4] bg-white p-6 md:col-span-2"><p className="font-bold">هنوز باشگاهی به پرونده شما متصل نشده است.</p><p className="mt-2 text-sm leading-6 text-[#687783]">پس از ثبت عضویت شما در یک باشگاه توسط معاونت اعضا، اطلاعات آن در این بخش دیده می‌شود.</p></div>}</div>
       </section>

       <section id="services" className="mt-8 scroll-mt-36">
         <div className="mb-4"><p className="text-xs font-bold text-[#96763D]">مزایا و مشارکت</p><h2 className="mt-1 text-xl font-extrabold">امتیازها و خدمات اعضا</h2></div>
         <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
           <article className="rounded-2xl bg-[#F0DFB8] p-5"><p className="text-sm font-bold text-[#526173]">موجودی امتیاز شما</p><div className="mt-2 flex items-baseline gap-2"><strong className="text-4xl">{money(dashboard.pointsBalance)}</strong><span className="text-sm">امتیاز</span></div><p className="mt-3 text-xs leading-6 text-[#526173]">امتیازها فقط پس از ثبت فعالیت و تصویب سازوکار امتیازدهی در این بخش محاسبه می‌شوند. عدد صفر به معنی ثبت‌نشدن امتیاز در سامانه است.</p></article>
           <div className="rounded-2xl border border-[#E3E0D8] bg-white p-5"><h3 className="font-extrabold">آخرین تغییرات امتیاز</h3>{dashboard.pointEvents.length?<ul className="mt-3 divide-y divide-[#E3E0D8]">{dashboard.pointEvents.slice(0,5).map(p=><li key={p.id} className="flex items-start justify-between gap-3 py-3"><div><p className="text-sm font-bold">{p.title}</p><p className="mt-1 text-xs text-[#687783]">{p.note||dateLabel(p.createdAt)}</p></div><strong className={"shrink-0 text-sm "+(p.points<0?"text-red-700":"text-emerald-800")}>{p.points>0?"+":""}{money(p.points)}</strong></li>)}</ul>:<p className="mt-3 text-sm leading-7 text-[#687783]">هنوز سابقه امتیازی ثبت نشده است. با فعال شدن برنامه‌های مشارکت، سوابق مصوب شما اینجا نمایش داده می‌شود.</p>}</div>
         </div>
         <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{services.map(s=><article key={s.title} className="rounded-2xl border border-[#E3E0D8] bg-white p-5"><div className="flex items-start justify-between gap-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F7F5F0] text-xl text-[#96763D]">{s.icon}</span><span className={"rounded-full px-2.5 py-1 text-[10px] font-bold "+(s.ready?"bg-emerald-50 text-emerald-800":"bg-[#EEECE6] text-[#687783]")}>{s.status}</span></div><h3 className="mt-3 font-extrabold">{s.title}</h3><p className="mt-2 text-sm leading-7 text-[#687783]">{s.description}</p></article>)}</div>
       </section>

       <section id="content" className="mt-8 scroll-mt-36">
         <div className="mb-4"><p className="text-xs font-bold text-[#96763D]">رسانه و مشارکت</p><h2 className="mt-1 text-xl font-extrabold">ارسال محتوای تولیدی</h2><p className="mt-2 text-sm leading-7 text-[#687783]">متن، تصویر یا ویدیوی تولید خود را ارسال کنید تا برای بررسی به کارتابل معاون رسانه برود. محتوای تأییدشده همراه با توضیحات انتشار به ادمین ارجاع می‌شود.</p></div>
         <form onSubmit={prepareContent} className="rounded-2xl border border-[#E3E0D8] bg-white p-5 shadow-sm md:p-6">
           <div className="grid gap-4 sm:grid-cols-2">
             <label className="text-sm font-bold">نوع محتوا<select className={inputClass+" mt-2"} value={contentType} onChange={e=>{setContentType(e.target.value as "text"|"image"|"video");setContentFile(null);setContentPreview("");setContentPrepared(false);setContentNotice("");setContentError("");}}><option value="text">متن / یادداشت</option><option value="image">تصویر / عکس</option><option value="video">ویدیو</option></select></label>
             <label className="text-sm font-bold">عنوان محتوا<input className={inputClass+" mt-2"} value={contentTitle} onChange={e=>setContentTitle(e.target.value)} maxLength={160} placeholder="عنوان کوتاه و روشن" required /></label>
           </div>
           {contentType==="text"?<label className="mt-4 block text-sm font-bold">متن محتوا<textarea className={inputClass+" mt-2"} rows={6} value={contentText} onChange={e=>setContentText(e.target.value)} maxLength={12000} placeholder="متن یا یادداشت خود را بنویسید…" required/><span className="mt-1 block text-xs font-normal text-[#687783]">{money(contentText.length)} از ۱۲٬۰۰۰ نویسه</span></label>:<div className="mt-4"><label className="block text-sm font-bold">انتخاب فایل<input className={inputClass+" mt-2"} type="file" accept={contentType==="image"?"image/*":"video/*"} onChange={selectContentFile}/></label><p className="mt-2 text-xs leading-6 text-[#687783]">حداکثر اندازه فایل ۲۵ مگابایت است. فایل پس از ثبت فرم در فضای ذخیره‌سازی سامانه بارگذاری می‌شود و برای انتشار مستقیم در سایت قرار نمی‌گیرد.</p>{contentFile&&<div className="mt-4 rounded-xl border border-[#E3E0D8] bg-[#F7F5F0] p-3"><p className="break-all text-sm font-bold">{contentFile.name}</p><p className="mt-1 text-xs text-[#687783]">{(contentFile.size/1024/1024).toFixed(2)} مگابایت · پیش‌نمایش محلی</p>{contentPreview&&(contentType==="image"?<img src={contentPreview} alt="پیش‌نمایش محتوای انتخاب‌شده" className="mt-3 max-h-80 w-full rounded-lg object-contain"/>:<video src={contentPreview} controls className="mt-3 max-h-80 w-full rounded-lg bg-black"/> )}</div>}</div>}
           <label className="mt-4 block text-sm font-bold">توضیح برای تیم بررسی <textarea className={inputClass+" mt-2"} rows={3} value={contentDescription} onChange={e=>setContentDescription(e.target.value)} maxLength={3000} placeholder="زمینه اثر، توضیحات یا منبع تصویر/ویدیو (اختیاری)"/></label>
           <p className="mt-3 rounded-xl bg-[#F7F5F0] p-3 text-xs leading-6 text-[#687783]">لطفاً فقط محتوایی را ارسال کنید که حق انتشار آن را دارید و در صورت حضور اشخاص دیگر، رضایت لازم برای انتشار را گرفته‌اید.</p>
           {contentError&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{contentError}</p>}
           {contentNotice&&<p role="status" className="mt-3 rounded-xl border border-[#D9C48E] bg-[#FBF5E7] p-3 text-sm leading-6 text-[#72551C]">{contentNotice}</p>}
           <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[#687783]">وضعیت: {contentPrepared?"ارسال شد":"پیش‌نویس"}</p><button disabled={busy} className="rounded-xl bg-[#172F48] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#28445D] disabled:opacity-50">{busy?"در حال ارسال…":contentPrepared?"ارسال مجدد محتوا":"ارسال برای بررسی رسانه"}</button></div>
         </form>
         <div className="mt-4 rounded-2xl border border-[#E3E0D8] bg-white p-5"><h3 className="font-extrabold">پیگیری محتواهای ارسالی</h3>{contentSubmissions.length?<div className="mt-3 space-y-3">{contentSubmissions.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(item=><article key={item.id} className="rounded-xl border border-[#E3E0D8] bg-[#F7F5F0] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><strong className="text-sm">{item.title}</strong><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold">{({pending_media:"در انتظار معاون رسانه",approved_media:"تأییدشده، در انتظار ارجاع",rejected_media:"ردشده توسط رسانه",forwarded_admin:"ارجاع‌شده به ادمین",published:"بارگذاری‌شده در سایت",rejected_admin:"ردشده توسط ادمین"} as Record<string,string>)[item.status]||item.status}</span></div><p className="mt-1 text-xs text-[#687783]">{dateLabel(item.createdAt)} · {item.kind==="image"?"تصویر":item.kind==="video"?"ویدیو":"متن"}</p>{(item.mediaNote||item.adminNote)&&<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#526173]">{item.adminNote||item.mediaNote}</p>}</article>)}</div>:<p className="mt-2 text-sm leading-6 text-[#687783]">هنوز محتوایی ارسال نکرده‌اید. پس از ارسال، وضعیت بررسی در همین بخش نمایش داده می‌شود.</p>}</div>
       </section>

       <section id="profile" className="mt-8 scroll-mt-36">
         <div className="mb-4"><p className="text-xs font-bold text-[#96763D]">حساب و اطلاعات شخصی</p><h2 className="mt-1 text-xl font-extrabold">پرونده من</h2></div>
         <div className="grid gap-4 lg:grid-cols-2">
           <section className="rounded-2xl border border-[#E3E0D8] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold">اطلاعات عضویت</h3><p className="mt-1 text-xs text-[#687783]">برای تغییر نام و اطلاعات هویتی، با معاونت اعضا هماهنگ کنید.</p></div><button type="button" onClick={()=>setEditing(v=>!v)} className="shrink-0 rounded-xl border border-[#D8D0C4] px-3 py-2 text-xs font-bold">{editing?"لغو":"ویرایش"}</button></div>
             <div className="mt-4 grid grid-cols-2 gap-3">{[["نام",member.fullName],["نوع عضویت",memberTier],["رده عضویت",memberGrade],["نوع عضو",memberType],["وضعیت","فعال"],["شماره تماس",member.phone],["ایمیل",member.email]].map(([label,value])=><div key={label} className="min-w-0 rounded-xl bg-[#F7F5F0] p-3"><p className="text-[11px] text-[#687783]">{label}</p><p className="mt-1 break-words text-sm font-bold">{value||"ثبت نشده"}</p></div>)}</div>
             {editing&&<form onSubmit={saveProfile} className="mt-4 grid gap-3"><label className="text-sm font-bold">شهر<input className={inputClass+" mt-2"} maxLength={120} value={city} onChange={e=>setCity(e.target.value)}/></label><label className="text-sm font-bold">حوزه تخصصی<input className={inputClass+" mt-2"} maxLength={240} value={expertise} onChange={e=>setExpertise(e.target.value)}/></label><label className="text-sm font-bold">معرفی کوتاه<textarea className={inputClass+" mt-2"} rows={4} maxLength={3000} value={biography} onChange={e=>setBiography(e.target.value)}/></label><button disabled={busy} className="rounded-xl bg-[#172F48] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?"در حال ذخیره…":"ذخیره پرونده"}</button></form>}
             {!editing&&<div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[#F7F5F0] p-3"><p className="text-[11px] text-[#687783]">شهر</p><p className="mt-1 text-sm font-semibold">{member.city||"ثبت نشده"}</p></div><div className="rounded-xl bg-[#F7F5F0] p-3"><p className="text-[11px] text-[#687783]">تخصص</p><p className="mt-1 text-sm font-semibold">{member.expertise||"ثبت نشده"}</p></div><div className="rounded-xl bg-[#F7F5F0] p-3 sm:col-span-2"><p className="text-[11px] text-[#687783]">معرفی کوتاه</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{member.biography||"هنوز معرفی کوتاهی ثبت نشده است."}</p></div></div>}
           </section>
           <section className="rounded-2xl border border-[#E3E0D8] bg-white p-5 shadow-sm">
             <h3 className="font-extrabold">پروفایل حرفه‌ای و درخواست ارتقا</h3>
             <p className="mt-2 text-sm leading-6 text-[#687783]">اطلاعات حرفه‌ای را ثبت کنید. درخواست هنرمندی به معاونت امور هنرمندان و درخواست متخصص یا مشاور به معاونت CSR ارجاع می‌شود. اگر وضعیت «نیازمند تکمیل اطلاعات» است، توضیح بررسی را بخوانید، اطلاعات را اصلاح کنید و همان درخواست را دوباره بفرستید؛ درخواست تکراری ساخته نمی‌شود. تأیید نهایی، نوع پرونده و بانک اطلاعاتی را به‌روزرسانی می‌کند.</p>
             {(member.upgradeRequests||[]).length>0&&<div className="mt-4 space-y-2">{(member.upgradeRequests||[]).slice().reverse().map(req=><div key={req.id} className="rounded-xl border border-[#E3E0D8] bg-[#F7F5F0] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{req.target==="artist"?"هنرمند":req.target==="expert"?"متخصص":"مشاور"}</strong><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold">{req.status==="pending"?"در انتظار بررسی":req.status==="approved"?"تأیید شده":req.status==="needs_info"?"نیازمند تکمیل اطلاعات":"رد شده"}</span></div><p className="mt-1 text-xs text-[#687783]">مسیر بررسی: {req.assignedRole==="artists"?"معاونت امور هنرمندان":"معاونت اجتماعی برنامه‌های حمایتی"} · {dateLabel(req.submittedAt)}</p>{req.note&&<p className="mt-2 text-sm leading-6">{req.note}</p>}</div>)}</div>}
             <form onSubmit={submitUpgrade} className="mt-4 grid gap-3">
               <label className="text-sm font-bold">عنوان مورد درخواست<select className={inputClass+" mt-2"} value={upgradeTarget} onChange={e=>setUpgradeTarget(e.target.value as "artist"|"expert"|"consultant")}><option value="artist">هنرمند</option><option value="expert">متخصص</option><option value="consultant">مشاور</option></select></label>
               <label className="text-sm font-bold">عنوان حرفه‌ای / زمینه فعالیت<input className={inputClass+" mt-2"} value={professionalHeadline} onChange={e=>setProfessionalHeadline(e.target.value)} maxLength={160} placeholder="مثلاً نقاش، پژوهشگر هنر، مشاور مسئولیت اجتماعی" required/></label>
               <label className="text-sm font-bold">تخصص‌ها و حوزه‌های کاری<textarea className={inputClass+" mt-2"} rows={3} value={professionalSpecialties} onChange={e=>setProfessionalSpecialties(e.target.value)} maxLength={1200} required/></label>
               <label className="text-sm font-bold">تحصیلات و گواهی‌های مرتبط<textarea className={inputClass+" mt-2"} rows={3} value={professionalEducation} onChange={e=>setProfessionalEducation(e.target.value)} maxLength={1200} required/></label>
               <label className="text-sm font-bold">سوابق کاری و حرفه‌ای<textarea className={inputClass+" mt-2"} rows={4} value={professionalExperience} onChange={e=>setProfessionalExperience(e.target.value)} maxLength={3000} required/></label>
               <label className="text-sm font-bold">نمونه آثار، پروژه‌ها یا پیوند نمونه‌کارها<textarea className={inputClass+" mt-2"} rows={3} value={professionalPortfolio} onChange={e=>setProfessionalPortfolio(e.target.value)} maxLength={2000} placeholder="لینک یا شرح نمونه‌کارها (اختیاری)"/></label>
               <label className="text-sm font-bold">معرفی حرفه‌ای<textarea className={inputClass+" mt-2"} rows={3} value={professionalBio} onChange={e=>setProfessionalBio(e.target.value)} maxLength={3000} placeholder="معرفی کوتاه برای پروفایل تخصصی (اختیاری)"/></label>
               <label className="text-sm font-bold">وب‌سایت یا صفحه حرفه‌ای<input className={inputClass+" mt-2"} value={professionalWebsite} onChange={e=>setProfessionalWebsite(e.target.value)} maxLength={300} placeholder="https://…"/></label>
               <p className="rounded-xl bg-[#F7F5F0] p-3 text-xs leading-6 text-[#687783]">در این مرحله اطلاعات متنی ذخیره می‌شود. بارگذاری امن فایل رزومه و مدارک، و ساخت بانک اطلاعاتی نهایی Art Connect، تا تکمیل زیرساخت دریافت و مدیریت مدارک فعال نمی‌شود.</p>
               <button disabled={upgradeBusy} className="rounded-xl bg-[#172F48] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{upgradeBusy?"در حال ثبت…":(member.upgradeRequests||[]).some(req=>req.target===upgradeTarget&&req.status==="needs_info")?"اصلاح و ارسال مجدد درخواست":"ثبت درخواست ارتقا و پروفایل حرفه‌ای"}</button>
             </form>
           </section>
           <section className="rounded-2xl border border-[#E3E0D8] bg-white p-5 shadow-sm"><h3 className="font-extrabold">تغییر رمز عبور</h3><p className="mt-2 text-sm leading-6 text-[#687783]">برای امنیت حساب، رمز جدید حداقل ۱۲ نویسه داشته باشد و با رمز فعلی متفاوت باشد.</p><form onSubmit={changePassword} className="mt-4 grid gap-3"><label className="text-sm font-bold">رمز فعلی<input className={inputClass+" mt-2"} type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required/></label><label className="text-sm font-bold">رمز جدید<input className={inputClass+" mt-2"} type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/></label><label className="text-sm font-bold">تکرار رمز جدید<input className={inputClass+" mt-2"} type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label><button disabled={busy} className="rounded-xl bg-[#172F48] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?"در حال تغییر…":"تغییر رمز عبور"}</button></form></section>
         </div>
       </section>
     </>:<div className="rounded-2xl border border-[#E3E0D8] bg-white p-6">پرونده عضو پیدا نشد.</div>}
     <footer className="mt-8 border-t border-[#E3E0D8] py-5 text-center text-xs leading-6 text-[#687783]">سازمان مردم‌نهاد خورشید مفاخر · پنل اختصاصی اعضا · اطلاعات حساب فقط برای صاحب حساب و نقش‌های مجاز قابل دسترسی است.</footer>
   </div>
   <nav aria-label="دسترسی سریع موبایل" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E3E0D8] bg-[#FFFEFA]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden"><div className="mx-auto flex max-w-lg justify-around gap-1">{[["home","خانه","⌂"],["programs","برنامه‌ها","▦"],["clubs","باشگاه","◎"],["content","ارسال اثر","↗"],["profile","حساب","◉"]].map(([id,label,icon])=><a key={id} href={"#"+id} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-bold text-[#526173] hover:bg-[#F0DFB8]"><span className="text-base text-[#96763D]">{icon}</span><span>{label}</span></a>)}</div></nav>
 </main>;
}
