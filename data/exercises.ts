import { count } from 'drizzle-orm';

import { exercises } from './schema';
import type { DbOrTx } from './types';

// GYM-17 (Task 4) adds the seed, listing and search. Home needs only the count for now.
export function countExercises(db: DbOrTx): number {
  return db.select({ n: count() }).from(exercises).get()!.n;
}
