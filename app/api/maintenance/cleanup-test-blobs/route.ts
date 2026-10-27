import { del, list } from "@vercel/blob";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expected = process.env.LEGACY_BLOB_CLEANUP_KEY;
  const provided = request.nextUrl.searchParams.get("key") || "";
  if (!expected || provided.length !== expected.length ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Legacy storage token is unavailable." }, { status: 503 });
  }

  try {
    let cursor: string | undefined;
    const candidates: { url: string; pathname: string }[] = [];
    do {
      const page = await list({ prefix: "member-content/", cursor, limit: 500, token });
      candidates.push(...page.blobs
        .filter((blob) => blob.pathname.startsWith("member-content/"))
        .map((blob) => ({ url: blob.url, pathname: blob.pathname })));
      if (candidates.length > 5000) {
        return NextResponse.json({ error: "Cleanup safety limit exceeded; nothing was deleted." }, { status: 413 });
      }
      cursor = page.cursor;
    } while (cursor);

    if (candidates.length) {
      for (let i = 0; i < candidates.length; i += 100) {
        await del(candidates.slice(i, i + 100).map((blob) => blob.url), { token });
      }
    }
    return NextResponse.json(
      { deleted: candidates.length, scope: "member-content/", note: "Only legacy test blobs in the member-content prefix were targeted." },
      { headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    console.error("[legacy-blob-cleanup] failed", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
    return NextResponse.json({ error: "Legacy test-file cleanup failed." }, { status: 503 });
  }
}
