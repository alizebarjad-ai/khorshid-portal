import { del } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { deleteCollection, listStored, putStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately preserve staff credentials and the security audit trail.
const TEST_COLLECTIONS = [
  "projects",
  "project-proposals",
  "opportunities",
  "members",
  "clubs",
  "member-accounts",
  "member-content",
  "member-points",
  "member-upgrades",
  "member-upgrade-documents",
  "membership-documents",
  "record-audit",
  "member-contributions",
  "login-throttle",
  "password-reset-throttle",
] as const;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return error("برای ادامه وارد سامانه شوید.", 401);
  if (user.role !== "owner" || user.mustChangePassword) return error("فقط مالک سامانه پس از تعیین رمز شخصی می‌تواند داده‌های آزمایشی را پاک کند.", 403);

  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return error("درخواست از مبدأ نامعتبر پذیرفته نشد.", 403);

  let body: { confirmation?: string };
  try {
    body = await request.json();
  } catch {
    return error("درخواست معتبر نیست.", 400);
  }
  if (body.confirmation !== "DELETE_ALL_TEST_DATA") {
    return error("عبارت تأیید پاک‌سازی معتبر نیست.", 400);
  }

  try {
    let deletedRecords = 0;
    let deletedFiles = 0;
    const filePaths = new Set<string>();

    // First collect private blob paths, then remove records. Staff accounts and audit
    // history are intentionally excluded so this operation cannot lock out the owner.
    for (const collection of TEST_COLLECTIONS) {
      const items = await listStored<Record<string, unknown>>(collection);
      deletedRecords += items.length;
      for (const item of items) {
        for (const key of ["pathname", "blobPathname", "storagePath"]) {
          if (typeof item[key] === "string" && item[key]) filePaths.add(item[key] as string);
        }
      }
    }

    for (const path of filePaths) {
      try {
        await del(path);
        deletedFiles += 1;
      } catch {
        // Continue removing test records; a missing/already-deleted blob is non-fatal.
      }
    }

    for (const collection of TEST_COLLECTIONS) {
      await deleteCollection(collection);
    }

    const auditRecorded = await putStored("security-audit", {
      id: randomUUID(),
      kind: "security-audit",
      actor: user.username,
      action: "purge-test-data",
      target: "portal-test-data",
      metadata: { collections: TEST_COLLECTIONS.join(","), deletedRecords: String(deletedRecords), deletedFiles: String(deletedFiles) },
      at: new Date().toISOString(),
    }).then(() => true).catch(() => false);

    return NextResponse.json({
      success: true,
      deletedRecords,
      deletedFiles,
      preserved: ["staff-accounts", "security-audit"],
      auditRecorded,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    console.error("Owner test-data cleanup failed", caught instanceof Error ? caught.name : "UnknownError");
    return error("پاک‌سازی کامل نشد. پیش از تکرار، وضعیت داده‌ها بررسی شود.", 503);
  }
}
