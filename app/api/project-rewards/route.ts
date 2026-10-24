import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { deleteCollection, getStored, listStored, putStored } from "@/lib/persistent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionUser = { username: string; name: string; role: string };
const projectRoles = ["finance", "ceo", "deputy", "economic", "csr", "media", "artists", "education", "members", "beneficiary"];
const proposalRoles = ["finance", "ceo", "deputy", "economic", "csr", "media", "artists", "education", "members", "beneficiary"];

async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return decodeSession(store.get(COOKIE_NAME)?.value) as SessionUser | null;
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function changedKeys(existing: Record<string, unknown>, next: Record<string, unknown>) {
  return Object.keys(next).filter((key) => JSON.stringify(existing[key]) !== JSON.stringify(next[key]));
}

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("برای ادامه وارد سامانه شوید.", 401);
  if (!projectRoles.includes(user.role)) return fail("دسترسی به اطلاعات پروژه‌ها مجاز نیست.", 403);

  try {
    const [projects, proposals] = await Promise.all([
      user.role === "beneficiary" ? Promise.resolve([]) : listStored<Record<string, unknown>>("projects"),
      listStored<Record<string, unknown>>("project-proposals"),
    ]);
    return NextResponse.json({
      projects,
      proposals: user.role === "beneficiary"
        ? proposals.filter((item) => item.creator === user.username)
        : proposals,
    });
  } catch (error) {
    console.error("GET /api/project-rewards failed", error);
    return fail(error instanceof Error ? error.message : "خواندن اطلاعات انجام نشد.", 503);
  }
}

export async function PUT(request: NextRequest) {
  const user = await currentUser();
  if (!user) return fail("برای ادامه وارد سامانه شوید.", 401);
  if (!projectRoles.includes(user.role)) return fail("دسترسی مجاز نیست.", 403);

  try {
    const body = await request.json();
    const kind = body.kind === "project" || body.kind === "proposal" ? body.kind : null;
    const item = body.item as Record<string, unknown> | undefined;
    if (!kind || !item || typeof item.id !== "string" || !item.id) {
      return fail("نوع پرونده یا شناسه آن معتبر نیست.", 400);
    }

    const collection = kind === "project" ? "projects" : "project-proposals";
    const existing = await getStored<Record<string, unknown>>(collection, item.id);

    if (kind === "project") {
      if (user.role === "beneficiary") return fail("دسترسی به پروژه‌ها مجاز نیست.", 403);
      if (!existing && user.role !== "finance") return fail("ایجاد پروژه فقط در اختیار واحد مالی است.", 403);
      if (existing && user.role !== "finance") {
        if (user.role !== "ceo") return fail("ویرایش پروژه برای نقش شما مجاز نیست.", 403);
        const allowed = ["people", "approvalStatus", "approvedBy", "approvedAt", "status"];
        const changes = changedKeys(existing, item);
        if (changes.some((key) => !allowed.includes(key))) {
          return fail("مدیرعامل فقط می‌تواند ترکیب تیم و وضعیت تأیید پروژه را تغییر دهد.", 403);
        }
      }
      return NextResponse.json({ item: await putStored(collection, item) });
    }

    if (!existing) {
      if (!proposalRoles.includes(user.role)) return fail("ثبت پیشنهاد برای نقش شما مجاز نیست.", 403);
      const newItem = {
        ...item,
        creator: user.username,
        creatorName: user.name,
      };
      if (user.role === "beneficiary") {
        newItem.status = "در حال بررسی قائم‌مقام";
        newItem.assignedTo = "deputy";
        newItem.assignedToName = "قائم‌مقام";
      }
      return NextResponse.json({ item: await putStored(collection, newItem) }, { status: 201 });
    }

    if (user.role === "beneficiary") return fail("پس از ثبت، ویرایش پیشنهاد باید از مسیر گردش کار انجام شود.", 403);
    const allowedByRole: Record<string, string[]> = {
      deputy: ["status", "assignedTo", "assignedToName", "specialistBrief", "proposalDetails", "negotiationNote", "contractNo", "contractValue", "contractDate", "financeNote", "history"],
      ceo: ["status", "assignedTo", "assignedToName", "proposalDetails", "negotiationNote", "contractNo", "contractValue", "contractDate", "financeNote", "history"],
      finance: ["status", "contractNo", "contractValue", "contractDate", "financeNote", "history"],
      economic: ["status", "proposalDetails", "negotiationNote", "history"],
      csr: ["status", "specialistBrief", "proposalDetails", "history"],
      media: ["status", "specialistBrief", "proposalDetails", "history"],
      artists: ["status", "specialistBrief", "proposalDetails", "history"],
      education: ["status", "specialistBrief", "proposalDetails", "history"],
      members: ["status", "specialistBrief", "proposalDetails", "history"],
    };
    const changes = changedKeys(existing, item);
    const allowed = allowedByRole[user.role] || [];
    if (changes.some((key) => !allowed.includes(key))) {
      return fail("تغییرات ارسالی خارج از محدوده دسترسی این نقش است.", 403);
    }
    return NextResponse.json({ item: await putStored(collection, item) });
  } catch (error) {
    console.error("PUT /api/project-rewards failed", error);
    return fail(error instanceof Error ? error.message : "ذخیره اطلاعات انجام نشد.", 503);
  }
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser();
  if (!user) return fail("برای ادامه وارد سامانه شوید.", 401);
  if (user.role !== "finance") return fail("پاک‌سازی پرونده‌های پروژه فقط در اختیار واحد مالی است.", 403);
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind !== "projects") return fail("درخواست حذف معتبر نیست.", 400);
  try {
    await deleteCollection("projects");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/project-rewards failed", error);
    return fail(error instanceof Error ? error.message : "حذف اطلاعات انجام نشد.", 503);
  }
}
