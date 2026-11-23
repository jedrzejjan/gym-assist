import { asc, count, eq, sql } from 'drizzle-orm';

import {
  type Category,
  type Muscle,
  type Pattern,
  PATTERNS,
  type TrainingType,
} from '../domain/catalogue';
import { exerciseMuscles, exercises } from './schema';
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

import { foldName } from '../domain/library';

export { foldName };

const listColumns = {
  id: exercises.id,
  nameEn: exercises.nameEn,
  namePl: exercises.namePl,
  pattern: exercises.pattern,
  usesBodyweight: exercises.usesBodyweight,
  isCustom: exercises.isCustom,
};

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

export type NewExercise = {
  nameEn: string;
  namePl?: string;
  category: Category;
  trainingType: TrainingType;
  pattern: Pattern;
  usesBodyweight: boolean;
  muscles: Muscle[];
};

/** "An exercise with this name already exists" (spec section 5, Add exercise). */
export class DuplicateNameError extends Error {
  constructor(name: string) {
    super(`An exercise named "${name}" already exists`);
    this.name = 'DuplicateNameError';
  }
}

/**
 * Saves a custom exercise (`is_custom = 1`) with its muscles. The English name is trimmed and must
 * be unique ignoring case; the check is in JS (Polish letters fold too), the index is the backstop.
 * Call it inside one `mutate` from the screen.
 */
export function addCustomExercise(db: DbOrTx, e: NewExercise): string {
  const nameEn = e.nameEn.trim();
  if (!nameEn) throw new Error('An exercise needs an English name');
  const key = foldName(nameEn);
  const taken = db
    .select({ nameEn: exercises.nameEn })
    .from(exercises)
    .all()
    .some((x) => foldName(x.nameEn) === key);
  if (taken) throw new DuplicateNameError(nameEn);
  const id = newId();
  const now = nowIso();
  try {
    insertCustom(db, id, nameEn, e, now);
  } catch (err) {
    // The lower(name_en) index is the backstop: report it the same way as the JS check.
    if (String(err).includes('UNIQUE')) throw new DuplicateNameError(nameEn);
    throw err;
  }
  for (const muscle of e.muscles) {
    db.insert(exerciseMuscles).values({ exerciseId: id, muscle, updatedAt: now }).run();
  }
  return id;
}

function insertCustom(db: DbOrTx, id: string, nameEn: string, e: NewExercise, now: string) {
  db.insert(exercises)
    .values({
      id,
      nameEn,
      namePl: e.namePl?.trim() || null,
      category: e.category,
      trainingType: e.trainingType,
      pattern: e.pattern,
      usesBodyweight: e.usesBodyweight,
      isCustom: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}
