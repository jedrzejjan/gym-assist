import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { foldName } from '../../domain/library';
import { syncLibrary } from '../library';
import { exerciseAliases, exercises } from '../schema';
import { SEED_EXERCISES } from '../seed/exercises';
import * as schema from '../schema';
import type { Db, DbOrTx } from '../types';
import { createTestDb } from './testDb';

/** Test helper: installs the whole library, as a fresh phone does at its first start. */
export function seedLibrary(db: DbOrTx): void {
  syncLibrary(db, SEED_EXERCISES);
}

/**
 * Test helper: an exercise's id by its English name or an alias, ignoring case, so tests can
 * keep using the old app names ("Back squat", "Overhand pull-up"), which are aliases now.
 */
export function exerciseId(db: DbOrTx, name: string): string {
  const key = foldName(name);
  const byName = db
    .select({ id: exercises.id, nameEn: exercises.nameEn })
    .from(exercises)
    .all()
    .find((e) => foldName(e.nameEn) === key);
  if (byName) return byName.id;
  const byAlias = db
    .select()
    .from(exerciseAliases)
    .all()
    .find((a) => foldName(a.alias) === key);
  if (byAlias) return byAlias.exerciseId;
  throw new Error(`No exercise named ${name}`);
}

let template: Buffer | null = null;

/**
 * Test helper: a fresh database with the whole library, like createTestDb() plus seedLibrary()
 * but fast. The library (831 exercises) is seeded once per test file and each call gets its own
 * copy of that database, so tests stay independent.
 */
export function seededTestDb(): Db {
  if (!template) {
    const db = createTestDb();
    seedLibrary(db);
    template = (db as unknown as { $client: Database.Database }).$client.serialize();
  }
  const sqlite = new Database(template);
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema }) as unknown as Db;
}
