import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { deleteStored, listStored, putStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Submission = {
  id: string;
  kind: "text" | "image" | "video";
  title: string;
  description: string;
  text?: string;
  pathname?: string;
  fileName?: string;
  contentType?: string;
  size?: number;
  memberId: string;
  memberName: string;
  status: "pending_media" | "rejected_media" | "approved_media" | "forwarded_admin" | "published" | "rejected_admin";
  createdAt: string;
  updatedAt: string;
  mediaNote?: string;
  adminNote?: string;
  reviewedBy?: string;
  forwardedAt?: string;
};

const collection = "member-content";
const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });

function authorized(request: Request) {
  const expected = process.env.PORTAL_MEMBERSHIP_API_KEY;
  const supplied = request.headers.get("x-portal-membership-key");
  return Boolean(expected && supplied && supplied === expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return jsonError("دسترسی غیرمجاز است.", 401);
  try {
    const id = new URL(request.url).searchParams.get("id");
    const all = await listStored<Submission>(collection);
    const visible = all
      .filter(item => ["forwarded_admin", "published", "rejected_admin"].includes(item.status) && (!id || item.id === id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(item => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        description: item.description,
        text: item.text,
        fileName: item.fileName,
        contentType: item.contentType,
        size: item.size,
        memberName: item.memberName,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        mediaNote: item.mediaNote,
        adminNote: item.adminNote,
        forwardedAt: item.forwardedAt,
      }));
    return NextResponse.json(id ? { item: visible[0] || null } : { items: visible }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Media bridge GET failed", error instanceof Error ? error.name : "UnknownError");
    return jsonError("دریافت محتوای ارجاع‌شده انجام نشد.", 503);
  }
}

export async function PATCH(request: Request) {
  if (!authorized(request)) return jsonError("دسترسی غیرمجاز است.", 401);
  try {
    const body = await request.json() as { id?: unknown; action?: unknown; note?: unknown };
    const id = typeof body.id === "string" ? body.id.trim().slice(0, 100) : "";
    const action = typeof body.action === "string" ? body.action : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 3000) : "";
    if (!id || !["publish", "reject_admin"].includes(action)) return jsonError("اطلاعات اقدام معتبر نیست.", 400);
    if (action === "reject_admin" && !note) return jsonError("برای رد محتوا، دلیل لازم است.", 400);

    const items = await listStored<Submission>(collection);
    const current = items.find(item => item.id === id);
    if (!current || current.status !== "forwarded_admin") return jsonError("محتوای ارجاع‌شده پیدا نشد یا قبلاً تعیین تکلیف شده است.", 404);

    const updated: Submission = {
      ...current,
      status: action === "publish" ? "published" : "rejected_admin",
      adminNote: note,
      reviewedBy: "ادمین سایت",
      updatedAt: new Date().toISOString(),
    };
    await putStored(collection, updated);
    return NextResponse.json({ item: {
      id: updated.id, status: updated.status, adminNote: updated.adminNote, updatedAt: updated.updatedAt,
    } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Media bridge PATCH failed", error instanceof Error ? error.name : "UnknownError");
    return jsonError("ثبت تصمیم ادمین انجام نشد.", 400);
  }
}


export async function DELETE(request: Request) {
  if (!authorized(request)) return jsonError("دسترسی غیرمجاز است.", 401);
  try {
    const body = await request.json() as { id?: unknown };
    const id = typeof body.id === "string" ? body.id.trim().slice(0, 100) : "";
    if (!id) return jsonError("شناسه محتوا معتبر نیست.", 400);

    const items = await listStored<Submission>(collection);
    const current = items.find(item => item.id === id);
    if (!current || !["forwarded_admin", "published", "rejected_admin"].includes(current.status)) {
      return jsonError("محتوا در کارتابل ادمین پیدا نشد یا قبلاً حذف شده است.", 404);
    }

    // Remove the private uploaded file as well as the database record.
    if (current.pathname) {
      try {
        await del(current.pathname);
      } catch (error) {
        console.error("Media bridge blob deletion failed", error instanceof Error ? error.name : "UnknownError");
        return jsonError("فایل محتوا حذف نشد؛ رکورد برای جلوگیری از باقی‌ماندن فایل یتیم حفظ شد.", 503);
      }
    }

    await deleteStored(collection, current.id);
    return NextResponse.json({ deleted: true, id: current.id }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Media bridge DELETE failed", error instanceof Error ? error.name : "UnknownError");
    return jsonError("حذف محتوا انجام نشد؛ دوباره تلاش کنید.", 400);
  }
}
