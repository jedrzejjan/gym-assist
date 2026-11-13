// Exporting the whole database as one JSON file (spec section 5, Backup plan; GYM-26).
import { sql } from 'drizzle-orm';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { BackupFile } from '../domain/backup';
import journal from './migrations/meta/_journal.json';
import {
  appSettings,
  clients,
  exerciseMuscles,
  exercises,
  measurements,
  oneRepMaxes,
  sessionExercises,
  sessions,
  sets,
} from './schema';
import { type DbOrTx, nowIso } from './types';

/** The number of migrations the app has run: a restore accepts only a backup with the same. */
export const SCHEMA_VERSION = journal.entries.length;

/** Every table, parents before children, so a restore can insert them in this order. */
export const BACKUP_TABLES: { name: string; table: SQLiteTable }[] = [
  clients,
  exercises,
  exerciseMuscles,
  measurements,
  oneRepMaxes,
  sessions,
  sessionExercises,
  sets,
  appSettings,
].map((table) => ({ name: getTableConfig(table).name, table }));

/**
 * A full copy of the database. Rows keep their insertion order (SQLite's rowid), so a restore
 * that inserts them in file order keeps every tie broken the same way, e.g. two 1RMs saved in
 * the same millisecond (GYM-24, GYM-103).
 */
export function exportAll(db: DbOrTx): BackupFile {
  const tables: Record<string, unknown[]> = {};
  for (const { name, table } of BACKUP_TABLES) {
    tables[name] = db
      .select()
      .from(table)
      .orderBy(sql`rowid`)
      .all();
  }
  return {
    app: 'gym-assist',
    formatVersion: 1,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    tables,
  };
}
