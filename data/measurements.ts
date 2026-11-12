// Body-weight history (spec section 5, Profile; section 6, measurements). In the MVP every
// measurement is a weight in kg; a client has at most one per date and always at least one.
import { and, count, desc, eq, ne } from 'drizzle-orm';

import { measurements } from './schema';
import { type DbOrTx, newId, nowIso } from './types';

const WEIGHT = 'weight';

export type WeightRow = { id: string; clientId: string; date: string; valueKg: number };

/** "The last remaining entry can be edited but not deleted": every client has a body weight. */
export class LastWeightError extends Error {
  constructor() {
    super('The last remaining weight entry can only be edited');
    this.name = 'LastWeightError';
  }
}

const columns = {
  id: measurements.id,
  clientId: measurements.clientId,
  date: measurements.date,
  valueKg: measurements.value,
};

function checkKg(kg: number) {
  if (!(kg > 0)) throw new Error('A body weight must be positive');
}

/** Newest date first. */
export function listWeights(db: DbOrTx, clientId: string): WeightRow[] {
  return db
    .select(columns)
    .from(measurements)
    .where(and(eq(measurements.clientId, clientId), eq(measurements.type, WEIGHT)))
    .orderBy(desc(measurements.date))
    .all();
}

export function latestWeight(db: DbOrTx, clientId: string): WeightRow | null {
  return listWeights(db, clientId)[0] ?? null;
}

export function getWeight(db: DbOrTx, id: string): WeightRow | null {
  return db.select(columns).from(measurements).where(eq(measurements.id, id)).get() ?? null;
}

function onDate(db: DbOrTx, clientId: string, date: string, exceptId?: string) {
  return db
    .select(columns)
    .from(measurements)
    .where(
      and(
        eq(measurements.clientId, clientId),
        eq(measurements.type, WEIGHT),
        eq(measurements.date, date),
        exceptId ? ne(measurements.id, exceptId) : undefined,
      ),
    )
    .get();
}

/**
 * Adds a weight. If the date already has one, returns 'conflict' and changes nothing, unless the
 * trainer chose "Replace" (`replace: true`), which overwrites that date's value.
 */
export function addWeight(
  db: DbOrTx,
  clientId: string,
  date: string,
  kg: number,
  opts: { replace: boolean },
): 'saved' | 'conflict' {
  checkKg(kg);
  const now = nowIso();
  const existing = onDate(db, clientId, date);
  if (existing) {
    if (!opts.replace) return 'conflict';
    db.update(measurements)
      .set({ value: kg, updatedAt: now })
      .where(eq(measurements.id, existing.id))
      .run();
    return 'saved';
  }
  db.insert(measurements)
    .values({
      id: newId(),
      clientId,
      date,
      type: WEIGHT,
      value: kg,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return 'saved';
}

/** Edits an entry. Moving it onto another entry's date is a 'conflict' unless `replace`. */
export function updateWeight(
  db: DbOrTx,
  id: string,
  v: { date: string; kg: number },
  opts: { replace: boolean },
): 'saved' | 'conflict' {
  checkKg(v.kg);
  const entry = getWeight(db, id);
  if (!entry) throw new Error('Weight entry not found');
  const other = onDate(db, entry.clientId, v.date, id);
  if (other) {
    if (!opts.replace) return 'conflict';
    db.delete(measurements).where(eq(measurements.id, other.id)).run();
  }
  db.update(measurements)
    .set({ date: v.date, value: v.kg, updatedAt: nowIso() })
    .where(eq(measurements.id, id))
    .run();
  return 'saved';
}

export function weightCount(db: DbOrTx, clientId: string): number {
  return db
    .select({ n: count() })
    .from(measurements)
    .where(and(eq(measurements.clientId, clientId), eq(measurements.type, WEIGHT)))
    .get()!.n;
}

export function deleteWeight(db: DbOrTx, id: string): void {
  const entry = getWeight(db, id);
  if (!entry) return;
  if (weightCount(db, entry.clientId) <= 1) throw new LastWeightError();
  db.delete(measurements).where(eq(measurements.id, id)).run();
}
