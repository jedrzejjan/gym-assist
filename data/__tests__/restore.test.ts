/**
 * @jest-environment node
 */
import type { BackupFile } from '../../domain/backup';
import { exportAll } from '../backup';
import { archiveClient, createClient } from '../clients';
import { listExercises, seedExercises } from '../exercises';
import { mutate } from '../live';
import { addWeight } from '../measurements';
import { currentOneRepMax, setOneRepMax } from '../progress';
import { restoreAll } from '../restore';
import { SEED_EXERCISES } from '../seed/exercises';
import { addExerciseToSession, addSet, finishSession, startSession } from '../sessions';
import {
  BACKUP_FOLDER_NAME,
  BACKUP_FOLDER_URI,
  BACKUP_LAST_AT,
  getSetting,
  setSetting,
  WELCOME_DONE,
} from '../settings';
import { createTestDb } from '../testing/testDb';
import type { Db } from '../types';

const ex = (db: Db, name: string) =>
  listExercises(db, { search: name }).find((e) => e.nameEn === name)!.id;

/** A full database: Me, Anna (archived), Jan, weights, 3 finished sessions with 243 sets, a draft, two tied 1RMs. */
function fullDb() {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  setSetting(db, WELCOME_DONE, '1');
  setSetting(db, BACKUP_FOLDER_URI, 'content://tree/old-phone');
  const me = createClient(db, {
    firstName: 'Me',
    isSelf: true,
    weightKg: 82,
    weightDate: '2026-10-01',
  });
  const anna = createClient(db, { firstName: 'Anna', weightKg: 63.5, weightDate: '2026-10-01' });
  const jan = createClient(db, { firstName: 'Jan', weightKg: 80, weightDate: '2026-10-01' });
  addWeight(db, me, '2026-11-01', 81.5, { replace: false });
  for (const [client, date] of [
    [me, '2026-11-03'],
    [anna, '2026-11-05'],
    [me, '2026-11-09'],
  ] as const) {
    const sid = startSession(db, client, date);
    const squat = addExerciseToSession(db, sid, ex(db, 'Back squat'));
    const pull = addExerciseToSession(db, sid, ex(db, 'Overhand pull-up'));
    for (let i = 0; i < 80; i++) addSet(db, squat, { weightKg: 80 + (i % 5), reps: 5 });
    addSet(db, pull, { weightKg: null, reps: 8 });
    finishSession(db, sid);
  }
  archiveClient(db, anna);
  const draft = startSession(db, jan, '2026-11-12');
  addSet(db, addExerciseToSession(db, draft, ex(db, 'Deadlift')), { weightKg: 100, reps: 5 });
  const spy = jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-11-08T10:00:00.000Z');
  try {
    setOneRepMax(db, me, ex(db, 'Back squat'), 100, 'manual');
    setOneRepMax(db, me, ex(db, 'Back squat'), 101.75, 'estimated'); // same millisecond: this one wins
  } finally {
    spy.mockRestore();
  }
  return { db, me };
}

/** Another phone: a fresh install with its own folder chosen, and some other data. */
function otherPhone() {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  setSetting(db, BACKUP_FOLDER_URI, 'content://tree/this-phone');
  setSetting(db, BACKUP_FOLDER_NAME, 'This phone');
  setSetting(db, BACKUP_LAST_AT, '2026-11-13T08:00:00.000Z');
  createClient(db, { firstName: 'Ewa', weightKg: 60, weightDate: '2026-11-01' });
  return db;
}

const withoutBackupSettings = (rows: unknown[]) =>
  (rows as { key: string }[]).filter((r) => !r.key.startsWith('backup.'));

test('export then restore gives identical tables, and counts clients, finished sessions and the date', () => {
  const { db: source } = fullDb();
  const file = exportAll(source);
  const target = otherPhone();
  const result = mutate(target, (tx) => restoreAll(tx, file), { export: false });

  expect(result).toEqual({ clients: 3, sessions: 3, date: todayLocalOf(file.exportedAt) });
  const after = exportAll(target);
  for (const name of Object.keys(file.tables)) {
    if (name === 'app_settings') continue;
    expect({ name, rows: after.tables[name] }).toEqual({ name, rows: file.tables[name] });
  }
  expect(after.tables.sets).toHaveLength(244); // 3 × (80 + 1) finished, + 1 in the draft
  expect(withoutBackupSettings(after.tables.app_settings)).toEqual(
    withoutBackupSettings(file.tables.app_settings),
  );
});

test("restore keeps this phone's backup folder", () => {
  const { db: source } = fullDb();
  const target = otherPhone();
  mutate(target, (tx) => restoreAll(tx, exportAll(source)), { export: false });
  expect(getSetting(target, BACKUP_FOLDER_URI)).toBe('content://tree/this-phone');
  expect(getSetting(target, BACKUP_FOLDER_NAME)).toBe('This phone');
  expect(getSetting(target, BACKUP_LAST_AT)).toBe('2026-11-13T08:00:00.000Z');
  expect(getSetting(target, WELCOME_DONE)).toBe('1');
});

test('two 1RMs saved in the same millisecond: the same one is current after backup and restore', () => {
  const { db: source, me } = fullDb();
  const squat = ex(source, 'Back squat');
  expect(currentOneRepMax(source, me, squat)!.valueKg).toBe(101.75);
  const target = otherPhone();
  mutate(target, (tx) => restoreAll(tx, exportAll(source)), { export: false });
  expect(currentOneRepMax(target, me, squat)!.valueKg).toBe(101.75);
});

test('a row that breaks a constraint rolls the whole restore back', () => {
  const { db: source } = fullDb();
  const file: BackupFile = JSON.parse(JSON.stringify(exportAll(source)));
  (file.tables.sets as { sessionExerciseId: string }[]).at(-1)!.sessionExerciseId = 'missing';
  const target = otherPhone();
  const before = exportAll(target).tables;
  expect(() => mutate(target, (tx) => restoreAll(tx, file), { export: false })).toThrow();
  expect(exportAll(target).tables).toEqual(before);
});

test('restoring into an empty database works too', () => {
  const { db: source } = fullDb();
  const target = createTestDb();
  const result = mutate(target, (tx) => restoreAll(tx, exportAll(source)), { export: false });
  expect(result.clients).toBe(3);
});

function todayLocalOf(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
