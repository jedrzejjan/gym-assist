import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { BaseSQLiteDatabase, SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import { randomUUID } from 'expo-crypto';

import type * as schema from './schema';

type Schema = typeof schema;

/** The app database: expo-sqlite on the phone, better-sqlite3 in tests. Both are synchronous. */
export type Db = BaseSQLiteDatabase<'sync', unknown, Schema>;

/** The handle Drizzle passes to `db.transaction(tx => …)`. */
export type Tx = SQLiteTransaction<'sync', unknown, Schema, ExtractTablesWithRelations<Schema>>;

/**
 * What every repository function takes. Repositories never open a transaction themselves:
 * nested transactions work on better-sqlite3 but throw on the phone's expo-sqlite.
 */
export type DbOrTx = Db | Tx;

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
