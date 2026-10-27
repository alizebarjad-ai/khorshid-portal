import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { deleteStored, listStored, putStored } from "@/lib/persistent-store";
import { readMembers, updateRecord, type MemberRecord } from "@/lib/records-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Target = "artist" | "expert" | "consultant";
type LegacyTarget = Target;
type Status = "pending" | "approved" | "rejected" | "needs_info";
type UpgradeDocument = { id: string; fileName: string; mimeType: string; size: number; uploadedAt: string };
type StoredUpgradeDocument = UpgradeDocument & { memberId: string; requestId: string; dataBase64: string };
const DOCUMENTS = "member-upgrade-documents";
const assignedRole = (target: LegacyTarget) => target === "artist" ? "artists" : target === "expert" ? "education" : "csr";
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxFileBytes = 2 * 1024 * 1024;
const maxTotalBytes = 4 * 1024 * 1024;
const maxFiles = 4;

function session(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 }) };
  if (!["artists", "education", "csr", "members", "ceo", "deputy"].includes(user.role)) {
    return { user: null, response: NextResponse.json({ error: "دسترسی به درخواست‌های ارتقا مجاز نیست." }, { status: 403 }) };
  }
  return { user, response: null };
}

export async function GET(request: NextRequest) {
  const auth = session(request);
  if (!auth.user) return auth.response!;
  try {
    const members: MemberRecord[] = await readMembers();
    const statusOnly = ["members", "ceo", "deputy"].includes(auth.user.role);
    const visible = members.flatMap(member => (member.upgradeRequests || [])
      .filter(item => ["ceo", "deputy", "members"].includes(auth.user!.role) || item.assignedRole === auth.user!.role)
      .map(item => statusOnly
        ? ({
            id: item.id, target: item.target, status: item.status, assignedRole: item.assignedRole,
            submittedAt: item.submittedAt, reviewedAt: item.reviewedAt,
            member: { id: member.id, fullName: member.fullName },
          })
        : ({ ...item, member: {
            id: member.id, fullName: member.fullName, email: member.email, phone: member.phone,
            city: member.city, membershipTier: member.membershipTier || "affiliate",
            membershipGrade: member.membershipRank || member.membershipGrade || "volunteer",
            membershipRank: member.membershipRank || member.membershipGrade || "volunteer",
            professionalMemberships: member.professionalMemberships || [],
            pointsBalance: member.pointsBalance || 0, expertise: member.expertise, biography: member.biography,
            professionalProfiles: { [item.target]: member.professionalProfiles?.[item.target] || (item.target === "artist" ? member.artistProfile : member.expertProfile) || {} },
            artistProfile: item.target === "artist" ? (member.professionalProfiles?.artist || member.artistProfile || {}) : {},
            expertProfile: item.target !== "artist" ? (member.professionalProfiles?.[item.target] || member.expertProfile || {}) : {},
          } })));
    visible.sort((a,b) => b.submittedAt.localeCompare(a.submittedAt));
    return NextResponse.json({ items: visible }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "دریافت درخواست‌ها ناموفق بود." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  if (user.role !== "member" || !user.memberId) return NextResponse.json({ error: "ثبت درخواست ارتقا فقط از حساب عضو امکان‌پذیر است." }, { status: 403 });

  const newlyStoredIds: string[] = [];
  try {
    const form = await request.formData();
    const target = String(form.get("target") || "") as Target;
    if (!["artist", "expert"].includes(target)) return NextResponse.json({ error: "فقط درخواست هنرمند یا متخصص پذیرفته می‌شود." }, { status: 400 });

    const members = await readMembers();
    const member = members.find(item => item.id === user.memberId);
    if (!member || member.status !== "active") return NextResponse.json({ error: "پرونده عضو فعال پیدا نشد." }, { status: 404 });
    const headline = String(form.get("headline") || "").trim().slice(0, 160);
    const education = String(form.get("education") || "").trim().slice(0, 1200);
    const educationField = String(form.get("educationField") || "").trim().slice(0, 160);
    const experience = String(form.get("experience") || "").trim().slice(0, 5000);
    const specialtiesRaw = String(form.get("specialties") || "").trim().slice(0, 1200);
    const portfolio = String(form.get("portfolio") || "").trim().slice(0, 2000);
    const website = String(form.get("website") || "").trim().slice(0, 300);
    const resumeText = String(form.get("resumeText") || "").trim().slice(0, 8000);
    const biography = String(form.get("biography") || member.biography || "").trim().slice(0, 3000);
    if (!headline || !education || !experience || !specialtiesRaw) {
      return NextResponse.json({ error: "عنوان تخصصی، حوزه تخصص، تحصیلات و سوابق کاری را کامل کنید." }, { status: 400 });
    }
    if (website && !/^https?:\/\//i.test(website)) {
      return NextResponse.json({ error: "نشانی وب‌سایت باید با https:// یا http:// شروع شود." }, { status: 400 });
    }

    const existingRequests = member.upgradeRequests || [];
    const open = existingRequests.find(item => item.target === target && (item.status === "pending" || item.status === "needs_info"));
    if (open?.status === "pending") {
      return NextResponse.json({ error: "درخواست شما در حال بررسی است؛ درخواست تکراری ثبت نکنید." }, { status: 409 });
    }
    const requestId = open?.id || randomUUID();
    const assigned = assignedRole(target);
    const files = form.getAll("documents").filter((value): value is File => value instanceof File && value.size > 0);

    if (files.length > maxFiles) return NextResponse.json({ error: "حداکثر ۴ فایل می‌توانید پیوست کنید." }, { status: 413 });
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > maxTotalBytes || files.some(file => file.size > maxFileBytes)) {
      return NextResponse.json({ error: "حجم هر فایل حداکثر ۲ مگابایت و مجموع فایل‌ها حداکثر ۴ مگابایت است." }, { status: 413 });
    }
    for (const file of files) {
      if (!allowedMimeTypes.has(file.type)) {
        return NextResponse.json({ error: "فقط فایل‌های PDF، Word و تصویرهای JPG، PNG یا WEBP پذیرفته می‌شوند." }, { status: 415 });
      }
    }

    const uploadedAt = new Date().toISOString();
    const documents: UpgradeDocument[] = [];
    for (const file of files) {
      const id = randomUUID();
      const document: StoredUpgradeDocument = {
        id, memberId: member.id, requestId,
        fileName: file.name.replace(/[\/\u0000-\u001f]/g, "_").slice(0, 180) || "document",
        mimeType: file.type, size: file.size, uploadedAt,
        dataBase64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      };
      await putStored(DOCUMENTS, document);
      newlyStoredIds.push(id);
      documents.push({ id, fileName: document.fileName, mimeType: document.mimeType, size: document.size, uploadedAt });
    }

    const previousProfile = member.professionalProfiles?.[target] || (target === "artist" ? member.artistProfile : member.expertProfile) || {};
    const profile = {
      ...previousProfile,
      headline, education, educationField, experience,
      specialties: specialtiesRaw.split(/[،,\n]/).map(item => item.trim()).filter(Boolean).slice(0, 30),
      portfolio, website, resumeText, biography,
      submittedAt: uploadedAt, verified: false,
    };
    const requestItem = {
      ...(open || {}),
      id: requestId, target, status: "pending" as const, assignedRole: assigned,
      submittedAt: uploadedAt, documents: [...(open?.documents || []), ...documents],
      reviewer: undefined, reviewedAt: undefined, note: undefined,
    };
    const updatedRequests = open
      ? existingRequests.map(item => item.id === open.id ? requestItem : item)
      : [...existingRequests, requestItem];
    const updated = await updateRecord("member", member.id, {
      professionalProfiles: { ...(member.professionalProfiles || {}), [target]: profile },
      upgradeRequests: updatedRequests,
      membershipType: "affiliate",
      membershipTier: "affiliate",
    }, { username: user.username });
    if (!updated) throw new Error("ثبت پرونده تخصصی انجام نشد.");
    return NextResponse.json({ request: requestItem, member: updated }, { status: open ? 200 : 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    await Promise.all(newlyStoredIds.map(id => deleteStored(DOCUMENTS, id).catch(() => undefined)));
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت درخواست ارتقا انجام نشد." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = session(request);
  if (!auth.user) return auth.response!;
  try {
    const body = await request.json() as { memberId?: string; requestId?: string; status?: Status; note?: string };
    if (!body.memberId || !body.requestId || !["approved", "rejected", "needs_info"].includes(String(body.status))) {
      return NextResponse.json({ error: "شناسه عضو، درخواست و تصمیم معتبر الزامی است." }, { status: 400 });
    }
    const members = await readMembers();
    const member = members.find(item => item.id === body.memberId);
    if (!member) return NextResponse.json({ error: "پرونده عضو پیدا نشد." }, { status: 404 });
    const requests = member.upgradeRequests || [];
    const current = requests.find(item => item.id === body.requestId);
    if (!current) return NextResponse.json({ error: "درخواست ارتقا پیدا نشد." }, { status: 404 });
    if (auth.user.role !== "ceo" && current.assignedRole !== auth.user.role) {
      return NextResponse.json({ error: "این درخواست فقط در کارتابل معاونت ارجاع‌شده قابل تصمیم‌گیری است." }, { status: 403 });
    }
    if (current.status !== "pending" && current.status !== "needs_info") {
      return NextResponse.json({ error: "این درخواست قبلاً تعیین تکلیف شده است." }, { status: 409 });
    }
    const note = String(body.note || "").trim().slice(0, 3000);
    if (["rejected", "needs_info"].includes(body.status!) && !note) {
      return NextResponse.json({ error: "برای رد یا درخواست تکمیل، درج توضیح الزامی است." }, { status: 400 });
    }
    const reviewedAt = new Date().toISOString();
    const updatedRequests = requests.map(item => item.id === current.id ? { ...item, status: body.status!, reviewedAt, reviewer: auth.user!.name, note } : item);
    const patch: Record<string, unknown> = { upgradeRequests: updatedRequests, membershipType: "affiliate", membershipTier: "affiliate" };
    if (body.status === "approved") {
      const target = current.target as Target;
      const profiles = member.professionalProfiles || {};
      const profile = profiles[target] || (target === "artist" ? member.artistProfile : member.expertProfile) || {};
      patch.professionalProfiles = { ...profiles, [target]: { ...profile, designation: target, verified: true, verifiedAt: reviewedAt, verifiedBy: auth.user.name } };
      patch.professionalMemberships = Array.from(new Set([...(member.professionalMemberships || []), target]));
    }
    const updated = await updateRecord("member", member.id, patch, { username: auth.user.username });
    const updatedMember = updated as MemberRecord | null;
    return NextResponse.json({ item: updatedMember, request: updatedMember?.upgradeRequests?.find(item => item.id === current.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت تصمیم انجام نشد." }, { status: 400 });
  }
}
