import { del } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { deleteCollection, listStored, putStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately preserve staff credentials and the security audit trail.
const PRIVATE_TEST_BLOB_PREFIXES = ["member-content/", "member-upgrades/"] as const;

const TEST_COLLECTIONS = [
  "projects",
  "project-proposals",
  "opportunities",
  "club-programs",
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
    let failedFiles = 0;
    const filePaths = new Map<string, boolean>();

    // First collect private blob paths, then remove records. Staff accounts and audit
    // history are intentionally excluded so this operation cannot lock out the owner.
    for (const collection of TEST_COLLECTIONS) {
      const items = await listStored<Record<string, unknown>>(collection);
      deletedRecords += items.length;
      for (const item of items) {
        for (const key of ["pathname", "blobPathname", "storagePath"]) {
          const path = typeof item[key] === "string" ? (item[key] as string).trim() : "";
          // Only delete private objects from the portal's dedicated upload namespaces.
          // Never trust arbitrary stored paths to select a Blob object for deletion.
          if (PRIVATE_TEST_BLOB_PREFIXES.some((prefix) => path.startsWith(prefix)) && !path.includes("..") && !path.startsWith("/")) {
            filePaths.set(path, false);
          }
        }
        for (const key of ["fileUrl", "imageUrl", "coverImageUrl", "attachmentUrl", "thumbnailUrl", "image", "url"]) {
          if (typeof item[key] !== "string" || !item[key]) continue;
          try {
            const legacyUrl = new URL(item[key] as string);
            if (legacyUrl.protocol === "https:" && legacyUrl.hostname.endsWith(".blob.vercel-storage.com")) {
              filePaths.set(legacyUrl.toString(), true);
            }
          } catch {
            // Ignore non-URL references; only trusted Vercel Blob URLs are eligible for deletion.
          }
        }
      }
    }

    for (const [path, legacyPublicUrl] of filePaths) {
      try {
        if (legacyPublicUrl) {
          const token = process.env.BLOB_READ_WRITE_TOKEN;
          if (!token) { failedFiles += 1; continue; }
          await del(path, { token });
        } else {
          await del(path);
        }
        deletedFiles += 1;
      } catch {
        failedFiles += 1;
        // Continue removing test records; report any files that could not be deleted.
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
      failedFiles,
      preserved: ["staff-accounts", "security-audit"],
      auditRecorded,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    console.error("Owner test-data cleanup failed", caught instanceof Error ? caught.name : "UnknownError");
    return error("پاک‌سازی کامل نشد. پیش از تکرار، وضعیت داده‌ها بررسی شود.", 503);
  }
}
