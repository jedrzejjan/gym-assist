// Reading and adding exercises (spec section 5; GYM-144, GYM-149). The library has 831 rows:
// lists read everything in three queries and filter, search and sort in JS, where Polish letters
// fold properly (SQLite's lower() folds ASCII only).
import { count, eq, isNotNull, sql } from 'drizzle-orm';

import {
  type Equipment,
  type Level,
  type Muscle,
  type Pattern,
  PATTERNS,
  type Subcategory,
  subcategoryFits,
  type TrainingType,
} from '../domain/catalogue';
import { foldName } from '../domain/library';
import { exerciseAliases, exerciseMuscles, exercises } from './schema';
import { type DbOrTx, newId, nowIso } from './types';

export { foldName };

export type ExerciseListItem = {
  id: string;
  nameEn: string;
  namePl: string | null;
  pattern: Pattern | null;
  subcategory: Subcategory | null;
  equipment: Equipment;
  primaryMuscles: Muscle[];
  importance: number;
  usesBodyweight: boolean;
  isCustom: boolean;
  /** The alias a search matched, when neither the English nor the Polish name did. */
  matchedAlias: string | null;
};

export type ExerciseDetail = ExerciseListItem & {
  trainingType: TrainingType;
  secondaryMuscles: Muscle[];
  unilateral: boolean;
  level: Level | null;
  aliases: string[];
};

type Row = typeof exercises.$inferSelect;

/** Every exercise with its muscles by role and its aliases. Muscles keep their saved order. */
function loadAll(db: DbOrTx, id?: string) {
  const rows = (
    id ? db.select().from(exercises).where(eq(exercises.id, id)) : db.select().from(exercises)
  ).all();
  const muscles = new Map<string, { primary: Muscle[]; secondary: Muscle[] }>();
  // rowid order is the order the muscles were saved in (the seed's order).
  for (const m of (id
    ? db.select().from(exerciseMuscles).where(eq(exerciseMuscles.exerciseId, id))
    : db.select().from(exerciseMuscles)
  )
    .orderBy(sql`rowid`)
    .all()) {
    const entry = muscles.get(m.exerciseId) ?? { primary: [], secondary: [] };
    entry[m.role].push(m.muscle as Muscle);
    muscles.set(m.exerciseId, entry);
  }
  const aliases = new Map<string, string[]>();
  for (const a of (id
    ? db.select().from(exerciseAliases).where(eq(exerciseAliases.exerciseId, id))
    : db.select().from(exerciseAliases)
  ).all()) {
    aliases.set(a.exerciseId, [...(aliases.get(a.exerciseId) ?? []), a.alias]);
  }
  return rows.map((r) => ({
    row: r,
    muscles: muscles.get(r.id) ?? { primary: [], secondary: [] },
    aliases: aliases.get(r.id) ?? [],
  }));
}

function listItem(r: Row, primary: Muscle[], matchedAlias: string | null): ExerciseListItem {
  return {
    id: r.id,
    nameEn: r.nameEn,
    namePl: r.namePl,
    pattern: r.pattern as Pattern | null,
    subcategory: r.subcategory as Subcategory | null,
    equipment: r.equipment as Equipment,
    primaryMuscles: primary,
    importance: r.importance,
    usesBodyweight: r.usesBodyweight,
    isCustom: r.isCustom,
    matchedAlias,
  };
}

const byImportanceThenName = (a: ExerciseListItem, b: ExerciseListItem) =>
  a.importance - b.importance || a.nameEn.localeCompare(b.nameEn, 'en');

/**
 * Exercises, optionally one pattern and one subcategory ('other' = none), optionally matching a
 * search in the English name, the Polish name or an alias (GYM-149). Order: with a search, names
 * that start with the text first; then importance (1 first); then the English name.
 */
export function listExercises(
  db: DbOrTx,
  f: { pattern?: Pattern; subcategory?: Subcategory | 'other'; search?: string },
): ExerciseListItem[] {
  const search = f.search ? foldName(f.search) : '';
  const out: (ExerciseListItem & { starts: boolean })[] = [];
  for (const { row, muscles, aliases } of loadAll(db)) {
    if (f.pattern && row.pattern !== f.pattern) continue;
    if (f.subcategory === 'other' && row.subcategory !== null) continue;
    if (f.subcategory && f.subcategory !== 'other' && row.subcategory !== f.subcategory) continue;
    let matchedAlias: string | null = null;
    let starts = false;
    if (search) {
      const names = [row.nameEn, row.namePl].filter((n): n is string => n !== null).map(foldName);
      if (names.some((n) => n.includes(search))) {
        starts = names.some((n) => n.startsWith(search));
      } else {
        const alias = aliases.find((a) => foldName(a).includes(search));
        if (alias === undefined) continue;
        matchedAlias = alias;
        starts = foldName(alias).startsWith(search);
      }
    }
    out.push({ ...listItem(row, muscles.primary, matchedAlias), starts });
  }
  return out
    .sort((a, b) => Number(b.starts) - Number(a.starts) || byImportanceThenName(a, b))
    .map(({ starts: _starts, ...item }) => item);
}

export function getExercise(db: DbOrTx, id: string): ExerciseDetail | null {
  const [found] = loadAll(db, id);
  if (!found) return null;
  const { row, muscles, aliases } = found;
  return {
    ...listItem(row, muscles.primary, null),
    trainingType: row.trainingType as TrainingType,
    secondaryMuscles: muscles.secondary,
    unilateral: row.unilateral,
    level: row.level as Level | null,
    aliases,
  };
}

export function countExercises(db: DbOrTx): number {
  return db.select({ n: count() }).from(exercises).get()!.n;
}

/** How many exercises each of the 5 patterns has (the "by pattern" list); cardio isn't one. */
export function countByPattern(db: DbOrTx): Record<Pattern, number> {
  const counts = Object.fromEntries(PATTERNS.map((p) => [p, 0])) as Record<Pattern, number>;
  for (const r of db
    .select({ pattern: exercises.pattern, n: count() })
    .from(exercises)
    .where(isNotNull(exercises.pattern))
    .groupBy(exercises.pattern)
    .all()) {
    if (r.pattern! in counts) counts[r.pattern as Pattern] = r.n;
  }
  return counts;
}

/** Every English name and alias: what the CSV import may refer to. */
export function allExerciseNames(db: DbOrTx): string[] {
  return [
    ...db.select({ n: exercises.nameEn }).from(exercises).all(),
    ...db.select({ n: exerciseAliases.alias }).from(exerciseAliases).all(),
  ].map((r) => r.n);
}

export type NewExercise = {
  nameEn: string;
  namePl?: string;
  trainingType: TrainingType;
  /** Ignored (saved as none) for Cardio. */
  pattern: Pattern | null;
  subcategory: Subcategory | null;
  equipment: Equipment;
  primaryMuscles: Muscle[];
  unilateral: boolean;
  usesBodyweight: boolean;
};

/** "An exercise with this name already exists" (spec section 5, Add exercise). */
export class DuplicateNameError extends Error {
  constructor(name: string) {
    super(`An exercise named "${name}" already exists`);
    this.name = 'DuplicateNameError';
  }
}

/**
 * Saves the trainer's own exercise (`is_custom = 1`, importance 1 so it lists first; GYM-149).
 * The English name is trimmed and must differ, ignoring case, from every English name and alias;
 * the check is in JS (Polish letters fold too), the unique indexes are the backstop. Cardio has
 * no pattern. Muscles are saved as primary (Add exercise asks for those only).
 * Call it inside one `mutate` from the screen.
 */
export function addCustomExercise(db: DbOrTx, e: NewExercise): string {
  const nameEn = e.nameEn.trim();
  if (!nameEn) throw new Error('An exercise needs an English name');
  if (e.primaryMuscles.length === 0) throw new Error('An exercise needs a primary muscle');
  const cardio = e.trainingType === 'Cardio';
  const pattern = cardio ? null : e.pattern;
  const subcategory = cardio ? null : e.subcategory;
  if (!cardio && pattern === null) throw new Error('An exercise needs a pattern');
  if (!subcategoryFits(pattern, subcategory)) {
    throw new Error(`${subcategory} is not a subcategory of ${pattern}`);
  }
  const key = foldName(nameEn);
  if (allExerciseNames(db).some((n) => foldName(n) === key)) throw new DuplicateNameError(nameEn);

  const id = newId();
  const now = nowIso();
  try {
    db.insert(exercises)
      .values({
        id,
        nameEn,
        namePl: e.namePl?.trim() || null,
        trainingType: e.trainingType,
        pattern,
        subcategory,
        equipment: e.equipment,
        unilateral: e.unilateral,
        usesBodyweight: e.usesBodyweight,
        importance: 1,
        isCustom: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  } catch (err) {
    // The lower(name_en) index is the backstop: report it the same way as the JS check.
    if (String(err).includes('UNIQUE')) throw new DuplicateNameError(nameEn);
    throw err;
  }
  db.insert(exerciseMuscles)
    .values(e.primaryMuscles.map((muscle) => ({ exerciseId: id, muscle, role: 'primary' as const, updatedAt: now })))
    .run();
  return id;
}
