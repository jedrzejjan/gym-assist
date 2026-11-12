import { asc, count, eq, sql } from 'drizzle-orm';

import { type Muscle, type Pattern, PATTERNS } from '../domain/catalogue';
import { exerciseMuscles, exercises } from './schema';
import type { SeedExercise } from './seed/exercises';
import { type DbOrTx, newId, nowIso } from './types';

export type ExerciseListItem = {
  id: string;
  nameEn: string;
  namePl: string | null;
  pattern: Pattern;
  usesBodyweight: boolean;
  isCustom: boolean;
};

export type ExerciseDetail = ExerciseListItem & {
  category: string;
  trainingType: string;
  muscles: Muscle[];
};

/**
 * Case folding in JS, not SQL: SQLite's lower() folds ASCII only, so "Ł" would not match "ł".
 * Used for search and for the "same name" check (spec section 6: names are unique ignoring case).
 */
export const foldName = (s: string) => s.trim().toLocaleLowerCase('pl');

const listColumns = {
  id: exercises.id,
  nameEn: exercises.nameEn,
  namePl: exercises.namePl,
  pattern: exercises.pattern,
  usesBodyweight: exercises.usesBodyweight,
  isCustom: exercises.isCustom,
};

/**
 * Adds the seed exercises whose English name is not in the library yet, with their muscles.
 * Returns how many were added. A custom exercise with the same name always stays (spec section 6).
 * Call it inside one transaction, so a crash can't leave an exercise without its muscles.
 */
export function seedExercises(db: DbOrTx, seed: SeedExercise[]): number {
  const existing = new Set(
    db
      .select({ nameEn: exercises.nameEn })
      .from(exercises)
      .all()
      .map((e) => foldName(e.nameEn)),
  );
  const now = nowIso();
  let added = 0;
  for (const s of seed) {
    const key = foldName(s.nameEn);
    if (existing.has(key)) continue;
    const id = newId();
    db.insert(exercises)
      .values({
        id,
        nameEn: s.nameEn,
        namePl: s.namePl,
        category: s.category,
        trainingType: s.trainingType,
        pattern: s.pattern,
        usesBodyweight: s.usesBodyweight,
        isCustom: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    for (const muscle of s.muscles) {
      db.insert(exerciseMuscles).values({ exerciseId: id, muscle, updatedAt: now }).run();
    }
    existing.add(key);
    added += 1;
  }
  return added;
}

/** Exercises sorted by English name, optionally one pattern, optionally matching a search. */
export function listExercises(
  db: DbOrTx,
  f: { pattern?: Pattern; search?: string },
): ExerciseListItem[] {
  const rows = db.select(listColumns).from(exercises).all() as ExerciseListItem[];
  const search = f.search ? foldName(f.search) : '';
  return rows
    .filter((e) => !f.pattern || e.pattern === f.pattern)
    .filter(
      (e) =>
        !search ||
        foldName(e.nameEn).includes(search) ||
        (e.namePl !== null && foldName(e.namePl).includes(search)),
    )
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en'));
}

export function getExercise(db: DbOrTx, id: string): ExerciseDetail | null {
  const row = db
    .select({ ...listColumns, category: exercises.category, trainingType: exercises.trainingType })
    .from(exercises)
    .where(eq(exercises.id, id))
    .get();
  if (!row) return null;
  // Muscles in the order they were saved (the seed's order). Best effort: rowid order survives
  // normal use, but VACUUM may renumber rows. If the order ever matters, add a position column.
  const muscles = db
    .select({ muscle: exerciseMuscles.muscle })
    .from(exerciseMuscles)
    .where(eq(exerciseMuscles.exerciseId, id))
    .orderBy(asc(sql`rowid`))
    .all()
    .map((m) => m.muscle as Muscle);
  return { ...(row as Omit<ExerciseDetail, 'muscles'>), muscles };
}

export function countExercises(db: DbOrTx): number {
  return db.select({ n: count() }).from(exercises).get()!.n;
}

/** How many exercises each pattern has, with 0 for empty ones (the "by pattern" list). */
export function countByPattern(db: DbOrTx): Record<Pattern, number> {
  const counts = Object.fromEntries(PATTERNS.map((p) => [p, 0])) as Record<Pattern, number>;
  const rows = db
    .select({ pattern: exercises.pattern, n: count() })
    .from(exercises)
    .groupBy(exercises.pattern)
    .all();
  for (const r of rows) {
    if (r.pattern in counts) counts[r.pattern as Pattern] = r.n;
  }
  return counts;
}
