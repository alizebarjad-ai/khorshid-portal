import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { createRecord, deleteRecord, readClubs, readMembers, updateRecord } from "@/lib/records-store";
import { mergeClubCatalog } from "@/lib/club-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const allowed = ["members"] as const;

async function actor(request: NextRequest) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return { user: null, response: NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 }) };
  if (!allowed.includes(user.role as typeof allowed[number])) {
    return { user: null, response: NextResponse.json({ error: "دسترسی به پرونده اعضا و باشگاه‌ها برای این نقش مجاز نیست." }, { status: 403 }) };
  }
  return { user, response: null };
}

export async function GET(request: NextRequest) {
  const auth = await actor(request);
  if (!auth.user) return auth.response!;
  try {
    const [members, clubs] = await Promise.all([readMembers(), readClubs()]);
    return NextResponse.json({ members, clubs: mergeClubCatalog(clubs as unknown as Array<Record<string, unknown>>) });
  } catch (error) {
    console.error("Records GET failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "دریافت اطلاعات انجام نشد." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await actor(request);
  if (!auth.user) return auth.response!;
  try {
    const body = await request.json();
    const kind = body.kind === "club" ? "club" : body.kind === "member" ? "member" : null;
    if (!kind || !body.data || typeof body.data !== "object") {
      return NextResponse.json({ error: "نوع پرونده یا اطلاعات ارسالی معتبر نیست." }, { status: 400 });
    }
    const safeData = { ...body.data } as Record<string, unknown>;
    delete safeData.membershipRank;
    delete safeData.membershipRankReason;
    const item = await createRecord(kind, safeData, { username: auth.user.username });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت پرونده انجام نشد." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await actor(request);
  if (!auth.user) return auth.response!;
  try {
    const body = await request.json();
    if (!["member", "club"].includes(body.kind) || typeof body.id !== "string" || !body.data || typeof body.data !== "object") {
      return NextResponse.json({ error: "درخواست ویرایش معتبر نیست." }, { status: 400 });
    }
    const safeData = { ...body.data } as Record<string, unknown>;
    delete safeData.membershipRank;
    delete safeData.membershipRankReason;
    const item = await updateRecord(body.kind, body.id, safeData, { username: auth.user.username });
    if (!item) return NextResponse.json({ error: "پرونده موردنظر پیدا نشد." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ذخیره تغییرات انجام نشد." }, { status: 400 });
  }
}


export async function DELETE(request: NextRequest) {
  const auth = await actor(request);
  if (!auth.user) return auth.response!;
  try {
    const body = await request.json();
    if (!["member", "club"].includes(body.kind) || typeof body.id !== "string" || !body.id.trim()) {
      return NextResponse.json({ error: "درخواست حذف معتبر نیست." }, { status: 400 });
    }
    const result = await deleteRecord(body.kind as "member" | "club", body.id, { username: auth.user.username });
    if (!result.deleted) {
      return NextResponse.json({
        error: `این باشگاه به ${result.linkedMemberCount} عضو متصل است. ابتدا ارتباط اعضا با این باشگاه را از پرونده آن‌ها بردارید.`,
        linkedMemberCount: result.linkedMemberCount,
      }, { status: 409 });
    }
    return NextResponse.json({ deleted: true, kind: body.kind, id: body.id });
  } catch (error) {
    console.error("Records DELETE failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "حذف پرونده انجام نشد." }, { status: 400 });
  }
}
