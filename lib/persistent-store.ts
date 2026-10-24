import { del, list, put } from "@vercel/blob";

const PREFIX = "khorshid-portal-data";

function token() {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new Error("ذخیره‌سازی پایدار سامانه پیکربندی نشده است.");
  return value;
}

export async function listStored<T>(collection: string): Promise<T[]> {
  const accessToken = token();
  const result = await list({ prefix: `${PREFIX}/${collection}/`, token: accessToken });
  const records: T[] = [];
  for (const blob of result.blobs) {
    const response = await fetch(blob.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("خواندن اطلاعات ذخیره‌شده کامل نشد.");
    records.push(await response.json() as T);
  }
  return records;
}

export async function getStored<T>(collection: string, id: string): Promise<T | null> {
  const items = await listStored<T & { id: string }>(collection);
  return items.find((item) => item.id === id) ?? null;
}

export async function putStored<T extends { id: string }>(collection: string, item: T): Promise<T> {
  await put(`${PREFIX}/${collection}/${item.id}.json`, JSON.stringify(item), {
    access: "private",
    token: token(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
  });
  return item;
}

export async function deleteStored(collection: string, id: string): Promise<void> {
  const accessToken = token();
  const result = await list({ prefix: `${PREFIX}/${collection}/`, token: accessToken });
  const blob = result.blobs.find((item) => item.pathname === `${PREFIX}/${collection}/${id}.json`);
  if (blob) await del(blob.url, { token: accessToken });
}

export async function deleteCollection(collection: string): Promise<void> {
  const accessToken = token();
  const result = await list({ prefix: `${PREFIX}/${collection}/`, token: accessToken });
  if (result.blobs.length) await del(result.blobs.map((item) => item.url), { token: accessToken });
}
