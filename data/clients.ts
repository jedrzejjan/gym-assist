import { and, count, eq, isNull, sql } from 'drizzle-orm';

import { clients, measurements, sessions } from './schema';
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
export type ClientListItem = Pick<ClientRow, 'id' | 'firstName' | 'lastName' | 'isSelf'> & {
  /** Date of the last finished session, or null. A draft does not count. */
  lastSessionDate: string | null;
};

const clean = (s: string | undefined | null) => {
  const t = s?.trim();
  return t ? t : null;
};

/** Inserts the client and its first weight. Call it inside one `mutate` from a screen. */
export function createClient(db: DbOrTx, c: NewClient): string {
  const firstName = clean(c.firstName);
  if (!firstName) throw new Error('A client needs a first name');
  if (!(c.weightKg > 0)) throw new Error('A client needs a body weight');
  if (c.heightCm !== undefined && !(c.heightCm > 0)) throw new Error('Height must be positive');
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
      // The outer column is spelled out: Drizzle writes ${clients.id} as a bare "id" here,
      // which inside the subquery would mean sessions.id.
      lastSessionDate: sql<string | null>`(
        SELECT max(${sessions.date}) FROM ${sessions}
        WHERE ${sessions.clientId} = "clients"."id" AND ${sessions.status} = 'finished'
      )`,
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

/**
 * Whether the database holds any client, archived ones included: then it has data worth backing
 * up (the automatic export, and the safety copy before a restore).
 */
export function hasAnyClient(db: DbOrTx): boolean {
  return db.select({ n: count() }).from(clients).get()!.n > 0;
}

export function countClients(db: DbOrTx): number {
  return db.select({ n: count() }).from(clients).where(isNull(clients.archivedAt)).get()!.n;
}

/** The editable profile fields. `null` clears an optional field; a missing key leaves it as is. */
export type ClientPatch = {
  firstName?: string;
  lastName?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  heightCm?: number | null;
};

/** "Me" can be renamed but not archived (spec section 5, Clients). */
export class CannotArchiveSelfError extends Error {
  constructor() {
    super('"Me" can be renamed but not archived');
    this.name = 'CannotArchiveSelfError';
  }
}

export function getClient(db: DbOrTx, id: string): ClientRow | null {
  return db.select().from(clients).where(eq(clients.id, id)).get() ?? null;
}

export function updateClient(db: DbOrTx, id: string, patch: ClientPatch): void {
  const set: Partial<typeof clients.$inferInsert> = { updatedAt: nowIso() };
  if (patch.firstName !== undefined) {
    const firstName = clean(patch.firstName);
    if (!firstName) throw new Error('A client needs a first name');
    set.firstName = firstName;
  }
  if (patch.lastName !== undefined) set.lastName = clean(patch.lastName);
  if (patch.gender !== undefined) set.gender = patch.gender;
  if (patch.dateOfBirth !== undefined) set.dateOfBirth = patch.dateOfBirth;
  if (patch.heightCm !== undefined) {
    if (patch.heightCm !== null && !(patch.heightCm > 0))
      throw new Error('Height must be positive');
    set.heightCm = patch.heightCm;
  }
  db.update(clients).set(set).where(eq(clients.id, id)).run();
}

/** Hides the client from the list and keeps all their history (spec section 6, Archiving). */
export function archiveClient(db: DbOrTx, id: string): void {
  const client = getClient(db, id);
  if (!client) return;
  if (client.isSelf) throw new CannotArchiveSelfError();
  db.update(clients)
    .set({ archivedAt: nowIso(), updatedAt: nowIso() })
    .where(eq(clients.id, id))
    .run();
}
