import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth";
import { listStored } from "@/lib/persistent-store";
import { readMembers } from "@/lib/records-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoredUpgradeDocument = {
  id: string;
  memberId: string;
  requestId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  dataBase64: string;
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ error: "برای ادامه وارد سامانه شوید." }, { status: 401 });
  const { id } = await context.params;
  try {
    const documents = await listStored<StoredUpgradeDocument>("member-upgrade-documents");
    const document = documents.find(item => item.id === id);
    if (!document) return NextResponse.json({ error: "مدرک پیدا نشد." }, { status: 404 });

    if (user.role === "member") {
      if (user.memberId !== document.memberId) return NextResponse.json({ error: "دسترسی به این مدرک مجاز نیست." }, { status: 403 });
    } else {
      const allowedStaff = ["ceo", "deputy"].includes(user.role);
      if (!allowedStaff && !["artists", "education", "csr"].includes(user.role)) {
        return NextResponse.json({ error: "دسترسی به مدارک ارتقا مجاز نیست." }, { status: 403 });
      }
      const member = (await readMembers()).find(item => item.id === document.memberId);
      const linkedRequest = member?.upgradeRequests?.find(item => item.id === document.requestId);
      if (!linkedRequest || (!allowedStaff && linkedRequest.assignedRole !== user.role)) {
        return NextResponse.json({ error: "این مدرک به کارتابل شما ارجاع نشده است." }, { status: 403 });
      }
    }

    const bytes = Buffer.from(document.dataBase64, "base64");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(document.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "دریافت مدرک انجام نشد." }, { status: 503 });
  }
}
