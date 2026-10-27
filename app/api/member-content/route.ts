import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { listStored, putStored } from "@/lib/persistent-store";
import { readMembers } from "@/lib/records-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Submission = {
  id: string; kind: "text" | "image" | "video"; title: string; description: string;
  text?: string; fileUrl?: string; pathname?: string; fileName?: string; contentType?: string; size?: number;
  memberId: string; memberName: string; memberEmail: string; status: "pending_media" | "rejected_media" | "approved_media" | "forwarded_admin" | "published" | "rejected_admin";
  createdAt: string; updatedAt: string; mediaNote?: string; adminNote?: string; reviewedBy?: string; forwardedAt?: string;
};
const collection = "member-content";
const jsonError = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return jsonError("برای ادامه وارد سامانه شوید.", 401);
  if (user.role !== "member" || !user.memberId) return jsonError("ارسال محتوا فقط از حساب عضو امکان‌پذیر است.", 403);
  let uploadedPathname: string | undefined;
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
      const valid = kind === "image" ? file.type.startsWith("image/") : file.type.startsWith("video/");
      if (!valid) return jsonError(kind === "image" ? "برای این نوع محتوا فایل تصویری انتخاب کنید." : "برای این نوع محتوا فایل ویدیویی انتخاب کنید.", 415);
      if (!process.env.BLOB_READ_WRITE_TOKEN) return jsonError("ذخیره‌سازی فایل هنوز در محیط سامانه پیکربندی نشده است.", 503);
      const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120) || "upload";
      const blob = await put(`member-content/${user.memberId}/${randomUUID()}-${safeName}`, file, {
        access: "private", addRandomSuffix: false, contentType: file.type, token: process.env.BLOB_READ_WRITE_TOKEN
      });
      uploadedPathname = blob.pathname;
      item.pathname = blob.pathname;
      item.fileUrl = `/api/member-content/files/${item.id}`;
      item.fileName = file.name.slice(0, 240); item.contentType = file.type; item.size = file.size;
    }
    await putStored(collection, item);
    return NextResponse.json({ item: { ...item, memberEmail: undefined } }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (uploadedPathname) await del(uploadedPathname).catch(() => undefined);
    console.error("Member content submission failed", error instanceof Error ? error.name : "UnknownError");
    return jsonError("ارسال محتوا انجام نشد. لطفاً دوباره تلاش کنید.", 400);
  }
}

export async function GET(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return jsonError("برای ادامه وارد سامانه شوید.", 401);
  if (!["member", "media", "owner"].includes(user.role)) return jsonError("دسترسی به کارتابل محتوا مجاز نیست.", 403);
  if (user.role === "member" && !user.memberId) return jsonError("پرونده عضو به حساب شما متصل نیست.", 403);
  try {
    const items = await listStored<Submission>(collection);
    const visible = items.filter(item => user.role === "member" ? item.memberId === user.memberId : user.role === "media" ? ["pending_media", "approved_media", "rejected_media"].includes(item.status) : ["forwarded_admin", "published", "rejected_admin"].includes(item.status));
    visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ items: visible }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "دریافت کارتابل محتوا ناموفق بود.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return jsonError("برای ادامه وارد سامانه شوید.", 401);
  if (!["media", "owner"].includes(user.role)) return jsonError("دسترسی به تغییر وضعیت محتوا مجاز نیست.", 403);
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
