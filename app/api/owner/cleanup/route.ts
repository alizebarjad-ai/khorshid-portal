import { del } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { deleteCollection, listStored, putStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_PREFIXES = ["member-content/", "member-upgrades/"] as const;
const CATEGORIES = {
  members: {
    label: "اعضا و پرونده‌های عضویت",
    collections: ["members", "member-accounts", "member-content", "member-points", "member-upgrades", "member-upgrade-documents", "membership-documents", "member-contributions"],
  },
  clubs: {
    label: "باشگاه‌ها و برنامه‌ها",
    collections: ["clubs", "club-programs"],
  },
  projects: {
    label: "پروژه‌ها و پیشنهادها",
    collections: ["projects", "project-proposals", "opportunities"],
  },
} as const;

type Category = keyof typeof CATEGORIES;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function owner(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: error("برای ادامه وارد سامانه شوید.", 401) };
  if (user.role !== "owner" || user.mustChangePassword) {
    return { user: null, response: error("فقط مالک سامانه پس از تعیین رمز شخصی می‌تواند داده‌ها را مدیریت کند.", 403) };
  }
  return { user, response: null };
}

export async function DELETE(request: NextRequest) {
  const checked = owner(request);
  if (!checked.user) return checked.response!;
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return error("درخواست از مبدأ نامعتبر پذیرفته نشد.", 403);

  let body: { category?: string; confirmation?: string };
  try {
    body = await request.json();
  } catch {
    return error("درخواست معتبر نیست.", 400);
  }

  const category = body.category as Category;
  const selected = CATEGORIES[category];
  if (!selected || body.confirmation !== selected.label) {
    return error("دسته انتخاب‌شده یا عبارت تأیید معتبر نیست.", 400);
  }

  try {
    let deletedRecords = 0;
    let deletedFiles = 0;
    let failedFiles = 0;
    let deletedWebsiteRequests = 0;
    const paths = new Set<string>();

    // Membership applications are stored in the main website database, not the portal store.
    // Clear that authoritative queue first; if the bridge is unavailable, leave portal records untouched.
    if (category === "members") {
      const base = process.env.WEBSITE_MEMBERSHIP_API_URL;
      const key = process.env.PORTAL_MEMBERSHIP_API_KEY;
      if (!base || !key) throw new Error("اتصال امن به صف درخواست‌های عضویت سایت تنظیم نشده است.");
      const remote = await fetch(base.endsWith("/") ? base.slice(0, -1) : base, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-portal-membership-key": key },
        body: JSON.stringify({ confirmation: "DELETE_MEMBERSHIP_REQUESTS" }),
        cache: "no-store",
      });
      const remoteData = await remote.json().catch(() => ({})) as { error?: string; deletedRequests?: number };
      if (!remote.ok) throw new Error(remoteData.error || "حذف درخواست‌های عضویت از سایت اصلی انجام نشد.");
      deletedWebsiteRequests = Number(remoteData.deletedRequests) || 0;
    }

    for (const collection of selected.collections) {
      const records = await listStored<Record<string, unknown>>(collection);
      deletedRecords += records.length;
      if (category === "members") {
        for (const record of records) {
          for (const key of ["pathname", "blobPathname", "storagePath"]) {
            const path = typeof record[key] === "string" ? (record[key] as string).trim() : "";
            if (PRIVATE_PREFIXES.some((prefix) => path.startsWith(prefix)) && !path.includes("..") && !path.startsWith("/")) paths.add(path);
          }
        }
      }
    }

    for (const path of paths) {
      try {
        await del(path);
        deletedFiles += 1;
      } catch {
        failedFiles += 1;
      }
    }

    for (const collection of selected.collections) await deleteCollection(collection);

    const auditRecorded = await putStored("security-audit", {
      id: randomUUID(),
      kind: "security-audit",
      actor: checked.user.username,
      action: "delete-data-category",
      target: category,
      metadata: { categoryLabel: selected.label, collections: selected.collections.join(","), deletedRecords: String(deletedRecords), deletedFiles: String(deletedFiles), deletedWebsiteRequests: String(deletedWebsiteRequests) },
      at: new Date().toISOString(),
    }).then(() => true).catch(() => false);

    return NextResponse.json({
      success: true,
      category,
      categoryLabel: selected.label,
      deletedRecords,
      deletedWebsiteRequests,
      deletedFiles,
      failedFiles,
      preserved: ["staff-accounts", "security-audit", "record-audit", ...(category === "members" ? [] : ["members"]), ...(category === "clubs" ? [] : ["clubs"]), ...(category === "projects" ? [] : ["projects"])],
      auditRecorded,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    console.error("Owner category cleanup failed", caught instanceof Error ? caught.name : "UnknownError");
    return error("حذف دسته کامل نشد؛ پیش از تکرار وضعیت داده‌ها بررسی شود.", 503);
  }
}
