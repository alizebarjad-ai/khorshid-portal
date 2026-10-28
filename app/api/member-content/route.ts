import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { deleteStored, listStored, putStored } from "@/lib/persistent-store";
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
const jsonError = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });

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
      if (!process.env.BLOB_STORE_ID) return jsonError("مخزن خصوصی فایل‌ها در محیط سامانه پیکربندی نشده است.", 503);
      const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120) || "upload";
      // On Vercel, @vercel/blob uses VERCEL_OIDC_TOKEN + BLOB_STORE_ID.
      // Do not pass BLOB_READ_WRITE_TOKEN here: that legacy token belongs to the records store.
      const blob = await put("member-content/" + user.memberId + "/" + randomUUID() + "-" + safeName, file, {
        access: "private", addRandomSuffix: false, contentType: file.type
      });
      uploadedPathname = blob.pathname;
      item.pathname = blob.pathname;
      item.fileUrl = `/api/member-content/files/${item.id}`;
      item.fileName = file.name.slice(0, 240);
      item.contentType = file.type;
      item.size = file.size;
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
  if (!["member", "media"].includes(user.role)) return jsonError("دسترسی به کارتابل محتوا مجاز نیست.", 403);
  if (user.role === "member" && !user.memberId) return jsonError("پرونده عضو به حساب شما متصل نیست.", 403);
  try {
    const items = await listStored<Submission>(collection);
    const visible = items
      .filter(item => user.role === "member" ? item.memberId === user.memberId : ["pending_media", "approved_media", "rejected_media"].includes(item.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      // Derive the protected download route from the record ID and stored pathname.
      // Older records may have a pathname but no persisted fileUrl.
      .map(item => ({
        ...item,
        // New private uploads use the authenticated file route. Preserve legacy
        // public Blob URLs for records created before private storage was enabled.
        fileUrl: item.kind === "text"
          ? undefined
          : item.pathname
            ? `/api/member-content/files/${encodeURIComponent(item.id)}`
            : item.fileUrl,
      }));
    return NextResponse.json({ items: visible }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Member content list failed", error instanceof Error ? error.name : "UnknownError");
    return jsonError("دریافت کارتابل محتوا ناموفق بود.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return jsonError("برای ادامه وارد سامانه شوید.", 401);
  if (user.role !== "media") return jsonError("تغییر وضعیت محتوا فقط برای معاونت رسانه مجاز است.", 403);
  try {
    const body = await request.json() as { id?: string; action?: string; note?: string };
    if (!body.id || !["approve", "reject", "forward"].includes(String(body.action))) return jsonError("درخواست تصمیم‌گیری معتبر نیست.", 400);
    const items = await listStored<Submission>(collection);
    const current = items.find(item => item.id === body.id);
    if (!current) return jsonError("محتوا پیدا نشد.", 404);
    const note = String(body.note || "").trim().slice(0, 3000);
    let status: Submission["status"] = current.status;
    if (body.action === "approve" && current.status === "pending_media") status = "approved_media";
    else if (body.action === "reject" && current.status === "pending_media") {
      if (!note) return jsonError("برای رد محتوا، توضیح لازم است.", 400);
      status = "rejected_media";
    } else if (body.action === "forward" && current.status === "approved_media") {
      if (note.length < 20) return jsonError("برای ارجاع به ادمین سایت، توضیح انتشار دست‌کم ۲۰ نویسه‌ای لازم است.", 400);
      status = "forwarded_admin";
    } else return jsonError("این اقدام با وضعیت فعلی محتوا سازگار نیست.", 409);
    const updated: Submission = {
      ...current, status, updatedAt: new Date().toISOString(),
      mediaNote: note, reviewedBy: user.name,
      ...(body.action === "forward" ? { forwardedAt: new Date().toISOString() } : {})
    };
    await putStored(collection, updated);
    return NextResponse.json({ item: updated }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Media review action failed", error instanceof Error ? error.name : "UnknownError");
    return jsonError("ثبت تصمیم انجام نشد.", 400);
  }
}

export async function DELETE(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return jsonError("برای ادامه وارد سامانه شوید.", 401);
  if (user.role !== "media") return jsonError("حذف محتوا فقط برای معاونت رسانه مجاز است.", 403);
  try {
    const body = await request.json() as { id?: unknown };
    const id = typeof body.id === "string" ? body.id.trim().slice(0, 100) : "";
    if (!id) return jsonError("شناسه محتوا معتبر نیست.", 400);
    const items = await listStored<Submission>(collection);
    const current = items.find(item => item.id === id);
    if (!current || !["pending_media", "approved_media", "rejected_media"].includes(current.status)) {
      return jsonError("این محتوا در کارتابل معاون رسانه قابل حذف نیست.", 409);
    }

    // Delete the stored object before its database record. Support legacy public Blob
    // URLs created before uploads were moved to private, pathname-based storage.
    const legacyBlobUrl = (() => {
      if (current.pathname || !current.fileUrl) return undefined;
      try {
        const url = new URL(current.fileUrl);
        return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com")
          ? url.toString()
          : undefined;
      } catch {
        return undefined;
      }
    })();
    const storageTarget = current.pathname || legacyBlobUrl;
    if (current.kind !== "text" && !storageTarget) {
      return jsonError("مسیر فایل در مخزن ثبت نشده است؛ رکورد حذف نشد تا فایل یتیم باقی نماند.", 409);
    }
    if (current.pathname) {
      // Private uploads belong to BLOB_STORE_ID and use Vercel OIDC credentials.
      if (!process.env.BLOB_STORE_ID) return jsonError("مخزن خصوصی فایل‌ها در محیط سامانه پیکربندی نشده است.", 503);
      try {
        await del(current.pathname);
      } catch (error) {
        console.error("Media dashboard private Blob deletion failed", error instanceof Error ? error.name : "UnknownError");
        return jsonError("فایل از مخزن حذف نشد؛ رکورد برای جلوگیری از باقی‌ماندن فایل یتیم حفظ شد.", 503);
      }
    } else if (legacyBlobUrl) {
      // Legacy public files were uploaded to the older records store.
      if (!process.env.BLOB_READ_WRITE_TOKEN) return jsonError("تنظیمات حذف فایل قدیمی در مخزن موجود نیست.", 503);
      try {
        await del(legacyBlobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
      } catch (error) {
        console.error("Media dashboard legacy Blob deletion failed", error instanceof Error ? error.name : "UnknownError");
        return jsonError("فایل از مخزن حذف نشد؛ رکورد برای جلوگیری از باقی‌ماندن فایل یتیم حفظ شد.", 503);
      }
    }
    await deleteStored(collection, current.id);
    return NextResponse.json({ deleted: true, id: current.id }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Media dashboard content deletion failed", error instanceof Error ? error.name : "UnknownError");
    return jsonError("حذف محتوا انجام نشد؛ دوباره تلاش کنید.", 400);
  }
}
