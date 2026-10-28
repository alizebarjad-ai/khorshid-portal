import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { listStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Submission = {
  id: string;
  kind: "text" | "image" | "video";
  title: string;
  fileUrl?: string;
  pathname?: string;
  fileName?: string;
  contentType?: string;
  size?: number;
  memberId: string;
  status: "pending_media" | "rejected_media" | "approved_media" | "forwarded_admin" | "published" | "rejected_admin";
};

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return jsonError("برای ادامه وارد سامانه شوید.", 401);

  const { id } = await context.params;
  try {
    const items = await listStored<Submission>("member-content");
    const item = items.find(entry => entry.id === id);
    if (!item || !item.pathname) return jsonError("فایل محتوا پیدا نشد.", 404);

    if (user.role === "member") {
      if (!user.memberId || user.memberId !== item.memberId) {
        return jsonError("دسترسی به این فایل مجاز نیست.", 403);
      }
    } else if (user.role === "media") {
      if (!["pending_media", "approved_media", "rejected_media"].includes(item.status)) {
        return jsonError("این محتوا در کارتابل رسانه نیست.", 403);
      }
    } else {
      return jsonError("فایل خام محتوا فقط برای صاحب محتوا یا معاونت رسانه در مرحله بررسی رسانه مجاز است.", 403);
    }

    if (!process.env.BLOB_STORE_ID) return jsonError("مخزن خصوصی فایل‌ها در محیط سامانه پیکربندی نشده است.", 503);
    // Use Vercel OIDC + BLOB_STORE_ID. Do not pass the legacy records-store token.
    const result = await get(item.pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return jsonError("فایل محتوا در مخزن پیدا نشد.", 404);
    }

    const contentType = result.blob.contentType || item.contentType || "application/octet-stream";
    const safeInline = item.kind === "image" || item.kind === "video";
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": `${safeInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(item.fileName || item.title || "content")}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    if (item.size) headers.set("Content-Length", String(item.size));
    return new Response(result.stream, { headers });
  } catch (error) {
    console.error("Private member content file read failed", error instanceof Error ? error.name : "UnknownError");
    return jsonError("دریافت فایل محتوا انجام نشد.", 503);
  }
}
