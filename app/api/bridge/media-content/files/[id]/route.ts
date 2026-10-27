import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { listStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Submission = {
  id: string;
  kind: "text" | "image" | "video";
  title: string;
  pathname?: string;
  fileName?: string;
  contentType?: string;
  size?: number;
  status: string;
};

function authorized(request: Request) {
  const expected = process.env.PORTAL_MEMBERSHIP_API_KEY;
  const supplied = request.headers.get("x-portal-membership-key");
  return Boolean(expected && supplied && supplied === expected);
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return error("دسترسی غیرمجاز است.", 401);
  const { id } = await context.params;
  try {
    const items = await listStored<Submission>("member-content");
    const item = items.find(entry => entry.id === id);
    if (!item || !item.pathname || !["forwarded_admin", "published", "rejected_admin"].includes(item.status)) {
      return error("فایل ارجاع‌شده پیدا نشد.", 404);
    }
    const result = await get(item.pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return error("فایل در مخزن پیدا نشد.", 404);
    const inline = item.kind === "image" || item.kind === "video";
    const headers = new Headers({
      "Content-Type": result.blob.contentType || item.contentType || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(item.fileName || item.title || "content")}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    if (item.size) headers.set("Content-Length", String(item.size));
    return new Response(result.stream, { headers });
  } catch (caught) {
    console.error("Media bridge file read failed", caught instanceof Error ? caught.name : "UnknownError");
    return error("دریافت فایل انجام نشد.", 503);
  }
}
