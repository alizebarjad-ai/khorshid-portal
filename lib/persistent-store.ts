import { getPostgresStored, listPostgresStored, putPostgresStored, deletePostgresStored, deletePostgresCollection, consumeMemberActivationToken as consumePostgresMemberActivationToken, consumeMemberPasswordResetToken as consumePostgresPasswordResetToken, withPostgresAdvisoryLock as withPostgresAdvisoryLockImpl } from "@/lib/postgres-store";
export const listStored = listPostgresStored;
export const getStored = getPostgresStored;
export const putStored = putPostgresStored;
export const deleteStored = deletePostgresStored;
export const deleteCollection = deletePostgresCollection;

export const consumeMemberActivationToken = consumePostgresMemberActivationToken;
export const withPersistentAdvisoryLock = withPostgresAdvisoryLockImpl;

export const consumeMemberPasswordResetToken = consumePostgresPasswordResetToken;
