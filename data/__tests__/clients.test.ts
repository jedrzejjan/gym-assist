/**
 * @jest-environment node
 */
import {
  archiveClient,
  CannotArchiveSelfError,
  countClients,
  createClient,
  getClient,
  getSelf,
  listClients,
  type NewClient,
  updateClient,
} from '../clients';
import { measurements, clients } from '../schema';
import { createTestDb } from '../testing/testDb';
import { eq, sql } from 'drizzle-orm';

const anna: NewClient = {
  firstName: 'Anna',
  lastName: 'Kowalska',
  weightKg: 64,
  weightDate: '2026-11-11',
};

test('createClient saves the first body weight as a weight measurement on weightDate', () => {
  const db = createTestDb();
  const id = createClient(db, { ...anna, weightKg: 82, weightDate: '2026-11-07' });
  const rows = db.select().from(measurements).where(eq(measurements.clientId, id)).all();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ type: 'weight', value: 82, date: '2026-11-07' });
});

test('createClient refuses a body weight or height that is 0, negative or not a number', () => {
  const db = createTestDb();
  for (const weightKg of [0, -1, Number.NaN]) {
    expect(() => createClient(db, { ...anna, weightKg })).toThrow();
  }
  for (const heightCm of [0, -170, Number.NaN]) {
    expect(() => createClient(db, { ...anna, heightCm })).toThrow();
  }
  expect(countClients(db)).toBe(0);
});

test('createClient refuses a missing or blank first name (no rows written)', () => {
  const db = createTestDb();
  expect(() => createClient(db, { ...anna, firstName: '' })).toThrow();
  expect(() => createClient(db, { ...anna, firstName: '   ' })).toThrow();
  expect(countClients(db)).toBe(0);
});

test('createClient trims names', () => {
  const db = createTestDb();
  const id = createClient(db, { ...anna, firstName: '  Anna ', lastName: ' Kowalska  ' });
  const row = db.select().from(clients).where(eq(clients.id, id)).get()!;
  expect(row.firstName).toBe('Anna');
  expect(row.lastName).toBe('Kowalska');
});

test('listClients puts Me first, then by first and last name, and hides archived clients', () => {
  const db = createTestDb();
  createClient(db, { ...anna, firstName: 'Zofia', lastName: null as unknown as string });
  const tomek = createClient(db, { ...anna, firstName: 'Tomasz', lastName: 'Nowak' });
  createClient(db, { ...anna, firstName: 'Anna', lastName: 'Kowalska' });
  createClient(db, { ...anna, firstName: 'Jan', isSelf: true });
  db.update(clients)
    .set({ archivedAt: '2026-11-11T10:00:00.000Z' })
    .where(eq(clients.id, tomek))
    .run();
  expect(listClients(db).map((c) => c.firstName)).toEqual(['Jan', 'Anna', 'Zofia']);
  expect(listClients(db)[0].isSelf).toBe(true);
});

test('listClients gives each client the date of their last finished session', () => {
  const db = createTestDb();
  const id = createClient(db, anna);
  const add = (sid: string, date: string, status: 'draft' | 'finished') =>
    db.run(
      sql`INSERT INTO sessions (id, client_id, date, status, started_at, updated_at)
          VALUES (${sid}, ${id}, ${date}, ${status}, 'x', 'x')`,
    );
  expect(listClients(db)[0].lastSessionDate).toBeNull();
  add('s1', '2026-11-01', 'finished');
  add('s2', '2026-11-07', 'finished');
  add('s3', '2026-11-10', 'draft'); // a draft is not a session yet
  expect(listClients(db)[0].lastSessionDate).toBe('2026-11-07');
});

test('createClient refuses a second Me', () => {
  const db = createTestDb();
  createClient(db, { ...anna, isSelf: true });
  expect(() => createClient(db, { ...anna, firstName: 'Jan', isSelf: true })).toThrow();
});

test('getSelf returns Me or null, and countClients counts active clients including Me', () => {
  const db = createTestDb();
  expect(getSelf(db)).toBeNull();
  createClient(db, { ...anna, isSelf: true });
  createClient(db, { ...anna, firstName: 'Jan' });
  expect(getSelf(db)?.firstName).toBe('Anna');
  expect(countClients(db)).toBe(2);
});

test('updateClient changes the profile and keeps the first name required', () => {
  const db = createTestDb();
  const id = createClient(db, anna);
  updateClient(db, id, { firstName: ' Ania ', lastName: '', gender: 'female', heightCm: 168 });
  expect(getClient(db, id)).toMatchObject({
    firstName: 'Ania',
    lastName: null,
    gender: 'female',
    heightCm: 168,
  });
  expect(() => updateClient(db, id, { firstName: '  ' })).toThrow();
  expect(() => updateClient(db, id, { heightCm: 0 })).toThrow();
});

test('archiving hides a client and keeps their weights; Me cannot be archived', () => {
  const db = createTestDb();
  const me = createClient(db, { ...anna, firstName: 'Jan', isSelf: true });
  const id = createClient(db, anna);
  archiveClient(db, id);
  expect(listClients(db).map((c) => c.id)).toEqual([me]);
  expect(db.select().from(measurements).where(eq(measurements.clientId, id)).all()).toHaveLength(1);
  expect(() => archiveClient(db, me)).toThrow(CannotArchiveSelfError);
  expect(getClient(db, 'missing')).toBeNull();
});
