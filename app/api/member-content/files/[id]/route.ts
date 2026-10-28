import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { listStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Submission = {
  id: string;
  memberId: string;
  status: string;
  filePathname?: string;
};

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return jsonError("برای ادامه وارد سامانه شوید.", 401);
  if (!["member", "media", "ceo", "deputy"].includes(user.role)) {
    return jsonError("دسترسی به فایل محتوا مجاز نیست.", 403);
  }

  try {
    const { id } = await context.params;
    if (!id || id.length > 100) return jsonError("شناسه فایل معتبر نیست.", 400);
    const items = await listStored<Submission>("member-content");
    const item = items.find((candidate) => candidate.id === id);
    if (!item || !item.filePathname) return jsonError("فایل خصوصی پیدا نشد.", 404);

    if (user.role === "member" && item.memberId !== user.memberId) {
      return jsonError("این فایل به حساب شما تعلق ندارد.", 404);
    }
    if (user.role === "media" && !["pending_media", "approved_media", "rejected_media"].includes(item.status)) {
      return jsonError("این فایل هنوز در محدوده کارتابل رسانه نیست.", 403);
    }
    if (["ceo", "deputy"].includes(user.role) && !["forwarded_admin", "published", "rejected_admin"].includes(item.status)) {
      return jsonError("این فایل هنوز به مرحله بررسی مدیریتی نرسیده است.", 403);
    }

    const token = process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;
    const storeId = process.env.PRIVATE_BLOB_STORE_ID;
    if (!token || !storeId) return jsonError("اتصال فضای ذخیره‌سازی خصوصی ناقص است.", 503);
    if (!item.filePathname.startsWith(`member-content/${item.memberId}/`)) {
      return jsonError("مسیر فایل معتبر نیست.", 404);
    }

    const result = await get(item.filePathname, {
      access: "private",
      token,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return jsonError("فایل خصوصی پیدا نشد.", 404);
    }
    const contentType = result.blob.contentType || item.contentType || "application/octet-stream";
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      return jsonError("نوع فایل ذخیره‌شده مجاز نیست.", 415);
    }
    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return jsonError("دریافت فایل محتوا انجام نشد.", 503);
  }
}
