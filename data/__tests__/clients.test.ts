/**
 * @jest-environment node
 */
import { createClient, countClients, getSelf, listClients, type NewClient } from '../clients';
import { measurements, clients } from '../schema';
import { createTestDb } from '../testing/testDb';
import { eq } from 'drizzle-orm';

const anna: NewClient = { firstName: 'Anna', lastName: 'Kowalska', weightKg: 64, weightDate: '2026-11-11' };

test('createClient saves the first body weight as a weight measurement on weightDate', () => {
  const db = createTestDb();
  const id = createClient(db, { ...anna, weightKg: 82, weightDate: '2026-11-07' });
  const rows = db.select().from(measurements).where(eq(measurements.clientId, id)).all();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ type: 'weight', value: 82, date: '2026-11-07' });
});

test('createClient refuses a missing or blank first name', () => {
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
  db.update(clients).set({ archivedAt: '2026-11-11T10:00:00.000Z' }).where(eq(clients.id, tomek)).run();
  expect(listClients(db).map((c) => c.firstName)).toEqual(['Jan', 'Anna', 'Zofia']);
  expect(listClients(db)[0].isSelf).toBe(true);
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
