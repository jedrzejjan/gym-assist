/**
 * @jest-environment node
 */
import { createClient } from '../clients';
import { listExercises, seedExercises } from '../exercises';
import {
  addExerciseToSession,
  DraftExistsError,
  getDraft,
  getSession,
  lastTimeSets,
  listSessionExercises,
  startSession,
} from '../sessions';
import { SEED_EXERCISES } from '../seed/exercises';
import { logSession } from '../testing/logSession';
import { createTestDb } from '../testing/testDb';

function setup() {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const anna = createClient(db, {
    firstName: 'Anna',
    lastName: 'Kowalska',
    weightKg: 63.5,
    weightDate: '2026-10-01',
  });
  const jan = createClient(db, { firstName: 'Jan', weightKg: 80, weightDate: '2026-10-01' });
  const id = (name: string) =>
    listExercises(db, { search: name }).find((e) => e.nameEn === name)!.id;
  return { db, anna, jan, squat: id('Back squat'), bench: id('Bench press') };
}

test('startSession makes a draft for the client on that date', () => {
  const { db, anna } = setup();
  const sid = startSession(db, anna, '2026-11-10');
  expect(getSession(db, sid)).toMatchObject({
    clientId: anna,
    clientName: 'Anna Kowalska',
    date: '2026-11-10',
    status: 'draft',
  });
  expect(getDraft(db)).toEqual({
    sessionId: sid,
    clientId: anna,
    clientName: 'Anna Kowalska',
    exerciseCount: 0,
  });
});

test('only one draft in the whole app: starting another throws DraftExistsError', () => {
  const { db, anna, jan } = setup();
  startSession(db, anna, '2026-11-10');
  expect(() => startSession(db, jan, '2026-11-10')).toThrow(DraftExistsError);
  expect(() => startSession(db, anna, '2026-11-11')).toThrow(DraftExistsError);
});

test('addExerciseToSession appends at the end of the list', () => {
  const { db, anna, squat, bench } = setup();
  const sid = startSession(db, anna, '2026-11-10');
  const a = addExerciseToSession(db, sid, squat);
  const b = addExerciseToSession(db, sid, bench);
  expect(listSessionExercises(db, sid).map((e) => [e.id, e.nameEn, e.position])).toEqual([
    [a, 'Back squat', 1],
    [b, 'Bench press', 2],
  ]);
  expect(getDraft(db)!.exerciseCount).toBe(2);
});

test('lastTimeSets: no history is null', () => {
  const { db, anna, squat } = setup();
  expect(lastTimeSets(db, anna, squat)).toBeNull();
});

test('lastTimeSets takes the latest finished session by date, sets in order', () => {
  const { db, anna, bench } = setup();
  logSession(db, { clientId: anna, date: '2026-10-27', exerciseId: bench, sets: [[55, 10]] });
  // Logged later, but back-dated to before 27 Oct: it is not "last time".
  logSession(db, {
    clientId: anna,
    date: '2026-10-20',
    exerciseId: bench,
    sets: [[50, 12]],
    finishedAt: '2026-11-05T12:00:00.000Z',
  });
  logSession(db, {
    clientId: anna,
    date: '2026-11-05',
    exerciseId: bench,
    sets: [
      [60, 8],
      [60, 8],
      [62.5, 6],
    ],
  });
  expect(lastTimeSets(db, anna, bench)).toEqual([
    { weightKg: 60, reps: 8 },
    { weightKg: 60, reps: 8 },
    { weightKg: 62.5, reps: 6 },
  ]);
});

test('lastTimeSets: on the same date, the later finished session wins', () => {
  const { db, anna, bench } = setup();
  logSession(db, {
    clientId: anna,
    date: '2026-11-05',
    exerciseId: bench,
    sets: [[70, 3]],
    finishedAt: '2026-11-05T18:00:00.000Z',
  });
  logSession(db, {
    clientId: anna,
    date: '2026-11-05',
    exerciseId: bench,
    sets: [[60, 8]],
    finishedAt: '2026-11-05T09:00:00.000Z',
  });
  expect(lastTimeSets(db, anna, bench)).toEqual([{ weightKg: 70, reps: 3 }]);
});

test('lastTimeSets ignores drafts and other clients', () => {
  const { db, anna, jan, bench } = setup();
  logSession(db, { clientId: anna, date: '2026-10-27', exerciseId: bench, sets: [[55, 10]] });
  logSession(db, { clientId: jan, date: '2026-11-08', exerciseId: bench, sets: [[100, 5]] });
  logSession(db, {
    clientId: anna,
    date: '2026-11-10',
    exerciseId: bench,
    sets: [[65, 5]],
    status: 'draft',
  });
  expect(lastTimeSets(db, anna, bench)).toEqual([{ weightKg: 55, reps: 10 }]);
});

test('lastTimeSets: a latest session with the exercise but no sets gives []', () => {
  const { db, anna, bench } = setup();
  logSession(db, { clientId: anna, date: '2026-10-27', exerciseId: bench, sets: [[55, 10]] });
  logSession(db, { clientId: anna, date: '2026-11-05', exerciseId: bench, sets: [] });
  expect(lastTimeSets(db, anna, bench)).toEqual([]);
});

test('lastTimeSets keeps blank values', () => {
  const { db, anna, bench } = setup();
  logSession(db, {
    clientId: anna,
    date: '2026-10-27',
    exerciseId: bench,
    sets: [
      [null, 10],
      [60, null],
    ],
  });
  expect(lastTimeSets(db, anna, bench)).toEqual([
    { weightKg: null, reps: 10 },
    { weightKg: 60, reps: null },
  ]);
});
