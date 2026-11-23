import { foldName } from '../../domain/library';
import { syncLibrary } from '../library';
import { exerciseAliases, exercises } from '../schema';
import { SEED_EXERCISES } from '../seed/exercises';
import type { DbOrTx } from '../types';

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
