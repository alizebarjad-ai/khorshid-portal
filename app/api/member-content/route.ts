import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { listStored, putStored } from "@/lib/persistent-store";
import { readMembers } from "@/lib/records-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Submission = {
  id: string; kind: "text" | "image" | "video"; title: string; description: string;
  text?: string; fileUrl?: string; filePathname?: string; fileName?: string; contentType?: string; size?: number;
  memberId: string; memberName: string; memberEmail: string; status: "pending_media" | "rejected_media" | "approved_media" | "forwarded_admin" | "published" | "rejected_admin";
  createdAt: string; updatedAt: string; mediaNote?: string; adminNote?: string; reviewedBy?: string; forwardedAt?: string;
};
const collection = "member-content";
const jsonError = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return jsonError("برای ادامه وارد سامانه شوید.", 401);
  if (user.role !== "member" || !user.memberId) return jsonError("ارسال محتوا فقط از حساب عضو امکان‌پذیر است.", 403);
  try {
    const member = (await readMembers()).find(item => item.id === user.memberId && item.status === "active");
    if (!member) return jsonError("پرونده عضو فعال پیدا نشد.", 404);
    const form = await request.formData();
    const kind = String(form.get("kind") || "");
    const title = String(form.get("title") || "").trim().slice(0, 160);
    const description = String(form.get("description") || "").trim().slice(0, 3000);
    if (!title || !["text", "image", "video"].includes(kind)) return jsonError("نوع و عنوان محتوا الزامی است.", 400);
    const item: Submission = {
      id: randomUUID(), kind: kind as Submission["kind"], title, description,
      memberId: user.memberId, memberName: member.fullName, memberEmail: member.email,
      status: "pending_media", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    if (kind === "text") {
      const text = String(form.get("text") || "").trim();
      if (!text) return jsonError("متن محتوا را وارد کنید.", 400);
      item.text = text.slice(0, 12000);
    } else {
      const file = form.get("file");
      if (!(file instanceof File) || file.size <= 0) return jsonError("فایل محتوا را انتخاب کنید.", 400);
      if (file.size > 25 * 1024 * 1024) return jsonError("حداکثر اندازه فایل ۲۵ مگابایت است.", 413);
      const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
      const allowedVideoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
      const allowedTypes = kind === "image" ? allowedImageTypes : allowedVideoTypes;
      if (!allowedTypes.has(file.type)) {
        return jsonError(kind === "image"
          ? "فقط تصویرهای JPEG، PNG، WebP یا GIF مجاز هستند؛ فایل SVG پذیرفته نمی‌شود."
          : "فقط ویدیوهای MP4، WebM یا QuickTime مجاز هستند.", 415);
      }
      const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const ascii = (start: number, end: number) => String.fromCharCode(...signature.slice(start, end));
      const isPng = signature.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => signature[index] === value);
      const isJpeg = signature.length >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
      const isWebp = signature.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
      const isGif = signature.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(0, 6));
      const isMp4 = signature.length >= 12 && ascii(4, 8) === "ftyp";
      const isWebm = signature.length >= 4 && signature[0] === 0x1a && signature[1] === 0x45 && signature[2] === 0xdf && signature[3] === 0xa3;
      const signatureMatches = kind === "image"
        ? (file.type === "image/jpeg" && isJpeg)
          || (file.type === "image/png" && isPng)
          || (file.type === "image/webp" && isWebp)
          || (file.type === "image/gif" && isGif)
        : (["video/mp4", "video/quicktime"].includes(file.type) && isMp4)
          || (file.type === "video/webm" && isWebm);
      if (!signatureMatches) return jsonError("محتوای فایل با نوع اعلام‌شده سازگار نیست یا قالب فایل پشتیبانی نمی‌شود.", 415);
      if (!process.env.BLOB_STORE_ID) {
        return jsonError("فضای ذخیره‌سازی خصوصی هنوز به این محیط متصل نشده است؛ فایل ارسال نشد.", 503);
      }
      const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120) || "upload";
      const blob = await put(`member-content/${user.memberId}/${randomUUID()}-${safeName}`, file, {
        access: "private", addRandomSuffix: false, contentType: file.type
      });
      item.filePathname = blob.pathname;
      item.fileUrl = `/api/member-content/files/${item.id}`;
      item.fileName = file.name.slice(0, 240); item.contentType = file.type; item.size = file.size;
    }
    await putStored(collection, item);
    const safeItem = { ...item };
    delete safeItem.filePathname;
    return NextResponse.json({ item: { ...safeItem, memberEmail: undefined } }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[member-content] upload failed", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
    return jsonError("ارسال محتوا انجام نشد؛ دوباره تلاش کنید.", 503);
  }
}

export async function GET(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return jsonError("برای ادامه وارد سامانه شوید.", 401);
  if (!["member", "media", "ceo", "deputy"].includes(user.role)) return jsonError("دسترسی به کارتابل محتوا مجاز نیست.", 403);
  if (user.role === "member" && !user.memberId) return jsonError("پرونده عضو به حساب شما متصل نیست.", 403);
  try {
    const items = await listStored<Submission>(collection);
    const visible = items.filter(item => user.role === "member" ? item.memberId === user.memberId : user.role === "media" ? ["pending_media", "approved_media", "rejected_media"].includes(item.status) : ["forwarded_admin", "published", "rejected_admin"].includes(item.status));
    visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ items: visible.map(({ filePathname, ...item }) => ({ ...item, fileUrl: filePathname ? `/api/member-content/files/${encodeURIComponent(item.id)}` : undefined })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "دریافت کارتابل محتوا ناموفق بود.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return jsonError("برای ادامه وارد سامانه شوید.", 401);
  if (!["media", "ceo", "deputy"].includes(user.role)) return jsonError("دسترسی به تغییر وضعیت محتوا مجاز نیست.", 403);
  try {
    const body = await request.json() as { id?: string; action?: string; note?: string };
    if (!body.id || !["approve", "reject", "forward", "publish", "reject_admin"].includes(String(body.action))) return jsonError("درخواست تصمیم‌گیری معتبر نیست.", 400);
    const items = await listStored<Submission>(collection);
    const current = items.find(item => item.id === body.id);
    if (!current) return jsonError("محتوا پیدا نشد.", 404);
    const note = String(body.note || "").trim().slice(0, 3000);
    let status: Submission["status"] = current.status;
    if (user.role === "media") {
      if (body.action === "approve" && current.status === "pending_media") status = "approved_media";
      else if (body.action === "reject" && current.status === "pending_media") {
        if (!note) return jsonError("برای رد محتوا، توضیح لازم است.", 400);
        status = "rejected_media";
      } else if (body.action === "forward" && current.status === "approved_media") {
        if (note.length < 20) return jsonError("برای ارجاع به ادمین، توضیح انتشار دست‌کم ۲۰ نویسه‌ای لازم است.", 400);
        status = "forwarded_admin";
      } else return jsonError("این اقدام با وضعیت فعلی محتوا سازگار نیست.", 409);
    } else {
      if (body.action === "publish" && current.status === "forwarded_admin") status = "published";
      else if (body.action === "reject_admin" && current.status === "forwarded_admin") {
        if (!note) return jsonError("برای رد محتوا، توضیح لازم است.", 400);
        status = "rejected_admin";
      } else return jsonError("این اقدام با وضعیت فعلی محتوا سازگار نیست.", 409);
    }
    const updated: Submission = {
      ...current, status, updatedAt: new Date().toISOString(),
      ...(user.role === "media" ? { mediaNote: note, reviewedBy: user.name } : { adminNote: note, reviewedBy: user.name }),
      ...(body.action === "forward" ? { forwardedAt: new Date().toISOString() } : {})
    };
    await putStored(collection, updated);
    return NextResponse.json({ item: updated }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "ثبت تصمیم انجام نشد.", 400);
  }
}
