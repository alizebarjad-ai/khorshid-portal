import { getPostgresStored, listPostgresStored, putPostgresStored, deletePostgresStored, deletePostgresCollection } from "@/lib/postgres-store";
export const listStored = listPostgresStored;
export const getStored = getPostgresStored;
export const putStored = putPostgresStored;
export const deleteStored = deletePostgresStored;
export const deleteCollection = deletePostgresCollection;
