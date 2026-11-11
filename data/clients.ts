import { and, eq, isNull } from 'drizzle-orm';

import { clients, measurements } from './schema';
import { type DbOrTx, newId, nowIso } from './types';

export type Gender = 'female' | 'male' | 'other' | 'prefer_not_to_say';

export type NewClient = {
  firstName: string;
  lastName?: string;
  gender?: Gender;
  dateOfBirth?: string;
  heightCm?: number;
  isSelf?: boolean;
  /** Every client has a body weight (spec section 6): it is saved as the first measurement. */
  weightKg: number;
  weightDate: string;
};

export type ClientRow = typeof clients.$inferSelect;
export type ClientListItem = Pick<ClientRow, 'id' | 'firstName' | 'lastName' | 'isSelf'>;

const clean = (s: string | undefined | null) => {
  const t = s?.trim();
  return t ? t : null;
};

/** Inserts the client and its first weight. Call it inside one `mutate` from a screen. */
export function createClient(db: DbOrTx, c: NewClient): string {
  const firstName = clean(c.firstName);
  if (!firstName) throw new Error('A client needs a first name');
  if (!(c.weightKg > 0)) throw new Error('A client needs a body weight');
  const id = newId();
  const now = nowIso();
  db.insert(clients)
    .values({
      id,
      firstName,
      lastName: clean(c.lastName),
      gender: c.gender ?? null,
      dateOfBirth: c.dateOfBirth ?? null,
      heightCm: c.heightCm ?? null,
      isSelf: c.isSelf ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  db.insert(measurements)
    .values({
      id: newId(),
      clientId: id,
      date: c.weightDate,
      type: 'weight',
      value: c.weightKg,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

const byName = (a: ClientListItem, b: ClientListItem) =>
  a.firstName.localeCompare(b.firstName, 'pl') ||
  (a.lastName ?? '').localeCompare(b.lastName ?? '', 'pl');

/** Active clients: "Me" first, then by first name and last name. */
export function listClients(db: DbOrTx): ClientListItem[] {
  const rows = db
    .select({
      id: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      isSelf: clients.isSelf,
    })
    .from(clients)
    .where(isNull(clients.archivedAt))
    .all();
  return rows.sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || byName(a, b));
}

export function getSelf(db: DbOrTx): ClientRow | null {
  return (
    db
      .select()
      .from(clients)
      .where(and(eq(clients.isSelf, true), isNull(clients.archivedAt)))
      .get() ?? null
  );
}

export function countClients(db: DbOrTx): number {
  return db.select({ id: clients.id }).from(clients).where(isNull(clients.archivedAt)).all().length;
}
