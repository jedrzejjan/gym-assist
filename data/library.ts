// Installing and upgrading the exercise library at start-up (spec section 5, Seed; GYM-149).
// data/db/open.ts calls syncLibrary in one transaction after the migrations, every start.
import { eq, inArray } from 'drizzle-orm';

import { foldName, planLibraryUpgrade } from '../domain/library';
import {
  exerciseAliases,
  exerciseMuscles,
  exercises,
  oneRepMaxes,
  sessionExercises,
  sessions,
} from './schema';
import type { SeedExercise } from './seed/exercises';
import { SEED_VERSION } from './seed/exercises';
import { getSetting, setSetting } from './settings';
import { type DbOrTx, newId, nowIso } from './types';

/** app_settings key: the library version this database has (missing = v1, before GYM-144). */
export const LIBRARY_VERSION = 'library.version';

/** SQLite's limit on bound variables: insert and delete in chunks so 831 rows can't hit it. */
const CHUNK = 100;

function chunks<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
  return out;
}

export type SyncResult = {
  mapped: number;
  dropped: number;
  inserted: number;
  sessionsDeleted: number;
};

/**
 * Brings the library up to the seed. Below the seed's version this is the one-time upgrade:
 * existing exercises are mapped onto library exercises by name or alias (ids, and so history,
 * stay); exercises with no match are deleted with their session exercises, sets and 1RMs, and a
 * session left with no exercises goes too (owner rules, GYM-149); the rest of the library is
 * inserted. At the seed's version it only adds library exercises whose names are all free, so
 * nothing the trainer made is ever touched again. Run it inside one transaction.
 */
export function syncLibrary(db: DbOrTx, seed: SeedExercise[]): SyncResult {
  const version = Number(getSetting(db, LIBRARY_VERSION) ?? '1');
  const result =
    version < SEED_VERSION ? upgrade(db, seed) : { ...addNew(db, seed), mapped: 0, dropped: 0, sessionsDeleted: 0 };
  if (version < SEED_VERSION) setSetting(db, LIBRARY_VERSION, String(SEED_VERSION));
  return result;
}

function existingWithAliases(db: DbOrTx) {
  const rows = db.select({ id: exercises.id, nameEn: exercises.nameEn }).from(exercises).all();
  const aliasesOf = new Map<string, string[]>();
  for (const a of db.select().from(exerciseAliases).all()) {
    aliasesOf.set(a.exerciseId, [...(aliasesOf.get(a.exerciseId) ?? []), a.alias]);
  }
  return rows.map((r) => ({ ...r, aliases: aliasesOf.get(r.id) ?? [] }));
}

function upgrade(db: DbOrTx, seed: SeedExercise[]): SyncResult {
  const existing = existingWithAliases(db);
  const plan = planLibraryUpgrade(existing, seed);
  const sessionsDeleted = dropExercises(db, plan.drop);
  const now = nowIso();

  // Every name and alias the library will hold, so an old name only becomes an alias when free.
  const used = new Set(seed.flatMap((s) => [s.nameEn, ...s.aliases]).map(foldName));
  const oldName = new Map(existing.map((e) => [e.id, e.nameEn]));

  for (const { id, seedIndex } of plan.map) {
    const s = seed[seedIndex];
    db.update(exercises)
      .set({ ...exerciseColumns(s), isCustom: false, updatedAt: now })
      .where(eq(exercises.id, id))
      .run();
    db.delete(exerciseMuscles).where(eq(exerciseMuscles.exerciseId, id)).run();
    db.delete(exerciseAliases).where(eq(exerciseAliases.exerciseId, id)).run();
    const aliases = [...s.aliases];
    const old = oldName.get(id)!.trim();
    if (!used.has(foldName(old))) {
      aliases.push(old);
      used.add(foldName(old));
    }
    insertChildren(db, [{ id, s, aliases }], now);
  }
  const inserted = insertExercises(db, plan.insert.map((i) => seed[i]), now);
  return { mapped: plan.map.length, dropped: plan.drop.length, inserted, sessionsDeleted };
}

/** Deletes exercises and everything that points at them; returns how many sessions it emptied. */
function dropExercises(db: DbOrTx, ids: string[]): number {
  if (ids.length === 0) return 0;
  const touched = new Set<string>();
  for (const part of chunks(ids)) {
    for (const se of db
      .select({ sessionId: sessionExercises.sessionId })
      .from(sessionExercises)
      .where(inArray(sessionExercises.exerciseId, part))
      .all()) {
      touched.add(se.sessionId);
    }
    db.delete(oneRepMaxes).where(inArray(oneRepMaxes.exerciseId, part)).run();
    db.delete(sessionExercises).where(inArray(sessionExercises.exerciseId, part)).run(); // sets cascade
    db.delete(exercises).where(inArray(exercises.id, part)).run(); // muscles and aliases cascade
  }
  if (touched.size === 0) return 0;
  // A session needs an exercise: those the deletes emptied go too (drafts included).
  const stillUsed = new Set(
    db
      .select({ sessionId: sessionExercises.sessionId })
      .from(sessionExercises)
      .where(inArray(sessionExercises.sessionId, [...touched]))
      .all()
      .map((r) => r.sessionId),
  );
  const empty = [...touched].filter((id) => !stillUsed.has(id));
  for (const part of chunks(empty)) db.delete(sessions).where(inArray(sessions.id, part)).run();
  return empty.length;
}

function addNew(db: DbOrTx, seed: SeedExercise[]): { inserted: number } {
  const taken = new Set(
    existingWithAliases(db)
      .flatMap((e) => [e.nameEn, ...e.aliases])
      .map(foldName),
  );
  const fresh: SeedExercise[] = [];
  for (const s of seed) {
    const names = [s.nameEn, ...s.aliases].map(foldName);
    if (names.some((n) => taken.has(n))) continue;
    for (const n of names) taken.add(n);
    fresh.push(s);
  }
  return { inserted: insertExercises(db, fresh, nowIso()) };
}

function exerciseColumns(s: SeedExercise) {
  return {
    nameEn: s.nameEn,
    namePl: s.namePl,
    trainingType: s.trainingType,
    pattern: s.pattern,
    subcategory: s.subcategory,
    equipment: s.equipment,
    mechanic: s.mechanic,
    level: s.level,
    unilateral: s.unilateral,
    usesBodyweight: s.usesBodyweight,
    importance: s.importance,
  };
}

function insertExercises(db: DbOrTx, seed: SeedExercise[], now: string): number {
  const rows = seed.map((s) => ({ id: newId(), s, aliases: s.aliases }));
  for (const part of chunks(rows)) {
    db.insert(exercises)
      .values(
        part.map(({ id, s }) => ({ id, ...exerciseColumns(s), isCustom: false, createdAt: now, updatedAt: now })),
      )
      .run();
  }
  insertChildren(db, rows, now);
  return rows.length;
}

function insertChildren(
  db: DbOrTx,
  rows: { id: string; s: SeedExercise; aliases: string[] }[],
  now: string,
) {
  const muscles = rows.flatMap(({ id, s }) => [
    ...s.primaryMuscles.map((muscle) => ({ exerciseId: id, muscle, role: 'primary' as const, updatedAt: now })),
    ...s.secondaryMuscles.map((muscle) => ({ exerciseId: id, muscle, role: 'secondary' as const, updatedAt: now })),
  ]);
  for (const part of chunks(muscles)) db.insert(exerciseMuscles).values(part).run();
  const aliases = rows.flatMap(({ id, aliases: list }) =>
    list.map((alias) => ({ exerciseId: id, alias, updatedAt: now })),
  );
  for (const part of chunks(aliases)) db.insert(exerciseAliases).values(part).run();
}

