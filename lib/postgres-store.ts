import { Pool } from "pg";
import { list } from "@vercel/blob";

type Item = { id: string };
const url = process.env.PRISMA_DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
let pool: Pool | undefined;
let schema: Promise<void> | undefined;

// pg-connection-string currently treats these legacy modes as verify-full.
// Make that effective behavior explicit and avoid a future-major-version warning.
function normalizeSslMode(connectionString: string) {
  return connectionString.replace(
    /([?&]sslmode=)(prefer|require|verify-ca)(?=(&|#|$))/i,
    "$1verify-full",
  );
}

function db() {
  if (!url) throw new Error("اتصال پایگاه داده PostgreSQL تنظیم نشده است.");
  if (!pool) pool = new Pool({ connectionString: normalizeSslMode(url), max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000, application_name: "khorshid-portal" });
  return pool;
}
async function ready() {
  if (!schema) schema = db().query(`
    CREATE TABLE IF NOT EXISTS portal_records (
      collection TEXT NOT NULL, id TEXT NOT NULL, data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS portal_records_updated_idx ON portal_records (collection, updated_at DESC);
    CREATE TABLE IF NOT EXISTS portal_migrations (
      name TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), imported_count INTEGER NOT NULL DEFAULT 0
    );
  `).then(() => undefined).catch((e: Error) => { schema = undefined; throw e; });
  return schema;
}
const prefixes: Record<string, string[]> = {
  opportunities: ["khorshid-portal-data/opportunities/"],
  projects: ["khorshid-portal-data/projects/"],
  "project-proposals": ["khorshid-portal-data/project-proposals/"],
  members: ["khorshid-records/member/"],
  clubs: ["khorshid-records/club/"],
};
async function importLegacy(collection: string) {
  await ready();
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["khorshid-import:" + collection]);
    const marker = await client.query("SELECT name FROM portal_migrations WHERE name=$1", ["blob-import:" + collection]);
    if (marker.rowCount) { await client.query("COMMIT"); return; }
    let count = 0;
    const legacyPrefixes = prefixes[collection] || [];
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (legacyPrefixes.length && !token) throw new Error("دسترسی انتقال داده‌های قبلی تنظیم نشده است.");
    for (const prefix of legacyPrefixes) {
      let cursor: string | undefined;
      do {
        const page = await list({ prefix, token: token!, ...(cursor ? { cursor } : {}) });
        for (const blob of page.blobs) {
          const response = await fetch(blob.url, { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
          if (!response.ok) throw new Error("خواندن یکی از رکوردهای قدیمی ناموفق بود؛ انتقال متوقف شد.");
          const item = await response.json() as Item;
          if (!item?.id) throw new Error("یک رکورد قدیمی شناسه معتبر ندارد؛ انتقال متوقف شد.");
          const saved = await client.query("INSERT INTO portal_records (collection,id,data) VALUES ($1,$2,$3::jsonb) ON CONFLICT (collection,id) DO NOTHING", [collection, item.id, JSON.stringify(item)]);
          count += saved.rowCount || 0;
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    }
    await client.query("INSERT INTO portal_migrations (name,imported_count) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING", ["blob-import:" + collection, count]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK").catch(() => undefined); throw e; }
  finally { client.release(); }
}
export async function listPostgresStored<T>(collection: string): Promise<T[]> {
  await importLegacy(collection);
  const result = await db().query("SELECT data FROM portal_records WHERE collection=$1 ORDER BY updated_at DESC,id ASC", [collection]);
  return result.rows.map((row: { data: T }) => row.data);
}
export async function getPostgresStored<T>(collection: string, id: string): Promise<T | null> {
  await importLegacy(collection);
  const result = await db().query("SELECT data FROM portal_records WHERE collection=$1 AND id=$2", [collection, id]);
  return result.rows[0] ? result.rows[0].data as T : null;
}
export async function putPostgresStored<T extends Item>(collection: string, item: T): Promise<T> {
  await importLegacy(collection);
  await db().query("INSERT INTO portal_records (collection,id,data,updated_at) VALUES ($1,$2,$3::jsonb,NOW()) ON CONFLICT (collection,id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()", [collection, item.id, JSON.stringify(item)]);
  return item;
}
export async function deletePostgresStored(collection: string, id: string): Promise<void> {
  await importLegacy(collection);
  await db().query("DELETE FROM portal_records WHERE collection=$1 AND id=$2", [collection, id]);
}
export async function deletePostgresCollection(collection: string): Promise<void> {
  await importLegacy(collection);
  await db().query("DELETE FROM portal_records WHERE collection=$1", [collection]);
}
