/**
 * @jest-environment node
 */
import { createClient } from '../clients';
import { listExercises, seedExercises } from '../exercises';
import { oneRepMaxes } from '../schema';
import {
  addExerciseToSession,
  addSet,
  currentOneRepMax,
  deleteSet,
  exerciseScreenData,
  finishExercise,
  getSessionExercise,
  listSets,
  reopenExercise,
  updateSet,
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

describe('sets', () => {
  function withExercise() {
    const s = setup();
    const sid = startSession(s.db, s.anna, '2026-11-10');
    const seId = addExerciseToSession(s.db, sid, s.bench);
    return { ...s, sid, seId };
  }
  const numbers = (db: Parameters<typeof listSets>[0], seId: string) =>
    listSets(db, seId).map((x) => x.setNo);

  test('numbers continue after a delete: 1, 3, 4 → 5', () => {
    const { db, seId } = withExercise();
    const ids = [1, 2, 3, 4].map(() => addSet(db, seId, { weightKg: 60, reps: 8 }));
    deleteSet(db, ids[1]);
    addSet(db, seId, { weightKg: 62.5, reps: 6 });
    expect(numbers(db, seId)).toEqual([1, 3, 4, 5]);
  });

  test('blank weight and reps are saved as NULL', () => {
    const { db, seId } = withExercise();
    addSet(db, seId, { weightKg: null, reps: null });
    expect(listSets(db, seId)[0]).toMatchObject({ setNo: 1, weightKg: null, reps: null });
  });

  test('updateSet changes the values and keeps the number', () => {
    const { db, seId } = withExercise();
    const id = addSet(db, seId, { weightKg: 60, reps: 8 });
    updateSet(db, id, { weightKg: 60, reps: 10 });
    expect(listSets(db, seId)).toMatchObject([{ id, setNo: 1, weightKg: 60, reps: 10 }]);
  });

  test('invalid values are refused', () => {
    const { db, seId } = withExercise();
    expect(() => addSet(db, seId, { weightKg: -5, reps: 8 })).toThrow();
    expect(() => addSet(db, seId, { weightKg: 60, reps: 0 })).toThrow();
    expect(() => addSet(db, seId, { weightKg: 60, reps: 8.5 })).toThrow();
  });

  test('finishing an exercise, and a new set reopens it', () => {
    const { db, seId } = withExercise();
    finishExercise(db, seId);
    expect(getSessionExercise(db, seId)!.finishedAt).not.toBeNull();
    addSet(db, seId, { weightKg: 60, reps: 8 });
    expect(getSessionExercise(db, seId)!.finishedAt).toBeNull();
    finishExercise(db, seId);
    reopenExercise(db, seId);
    expect(getSessionExercise(db, seId)!.finishedAt).toBeNull();
  });

  test('currentOneRepMax is the newest row by created_at', () => {
    const { db, anna, bench } = withExercise();
    expect(currentOneRepMax(db, anna, bench)).toBeNull();
    const row = (id: string, valueKg: number, createdAt: string, source: 'manual' | 'estimated') =>
      db
        .insert(oneRepMaxes)
        .values({
          id,
          clientId: anna,
          exerciseId: bench,
          valueKg,
          source,
          createdAt,
          updatedAt: createdAt,
        })
        .run();
    row('a', 55, '2026-09-01T10:00:00.000Z', 'estimated');
    row('b', 60, '2026-10-20T10:00:00.000Z', 'manual');
    expect(currentOneRepMax(db, anna, bench)).toEqual({
      valueKg: 60,
      source: 'manual',
      createdAt: '2026-10-20T10:00:00.000Z',
    });
  });

  test('exerciseScreenData gathers sets, 1RM, body weight on the session date and last time', () => {
    const { db, anna, bench, seId } = withExercise();
    addSet(db, seId, { weightKg: 60, reps: 8 });
    const d = exerciseScreenData(db, seId)!;
    expect(d.exercise).toMatchObject({ id: bench, nameEn: 'Bench press', usesBodyweight: false });
    expect(d.sets.map((x) => [x.setNo, x.weightKg, x.reps])).toEqual([[1, 60, 8]]);
    expect(d.oneRepMax).toBeNull();
    expect(d.bodyWeight).toEqual({ valueKg: 63.5, date: '2026-10-01' });
    expect(d.lastTime).toBeNull();
    expect(d.clientId).toBe(anna);
    expect(d.finished).toBe(false);
  });
});
