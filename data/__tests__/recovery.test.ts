/**
 * @jest-environment node
 */
import { createClient } from '../clients';
import { listExercises, seedExercises } from '../exercises';
import { trainedFor } from '../recovery';
import { SEED_EXERCISES } from '../seed/exercises';
import { addExerciseToSession, addSet, finishSession, startSession } from '../sessions';
import { createTestDb } from '../testing/testDb';

function setup() {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const anna = createClient(db, { firstName: 'Anna', weightKg: 63.5, weightDate: '2026-10-01' });
  const jan = createClient(db, { firstName: 'Jan', weightKg: 80, weightDate: '2026-10-01' });
  const ex = (name: string) =>
    listExercises(db, { search: name }).find((e) => e.nameEn === name)!.id;
  return { db, anna, jan, ex };
}

test('trainedFor gives each exercise with a set in a finished session, with pattern and muscles', () => {
  const s = setup();
  const sid = startSession(s.db, s.anna, '2026-11-09');
  addSet(s.db, addExerciseToSession(s.db, sid, s.ex('Back squat')), { weightKg: 80, reps: 5 });
  addSet(s.db, addExerciseToSession(s.db, sid, s.ex('Med ball slam')), { weightKg: 6, reps: 10 });
  finishSession(s.db, sid);
  const rows = trainedFor(s.db, s.anna);
  expect(rows).toHaveLength(2);
  expect(rows).toContainEqual({
    date: '2026-11-09',
    pattern: 'KD',
    muscles: expect.arrayContaining(['quadriceps', 'glutes']),
  });
  expect(rows).toContainEqual({
    date: '2026-11-09',
    pattern: 'none',
    muscles: expect.arrayContaining(['core', 'shoulders']),
  });
});

test('a draft and an exercise with no sets do not count', () => {
  const s = setup();
  const done = startSession(s.db, s.anna, '2026-11-05');
  addSet(s.db, addExerciseToSession(s.db, done, s.ex('Deadlift')), { weightKg: 100, reps: 5 });
  addExerciseToSession(s.db, done, s.ex('Bench press')); // no sets
  finishSession(s.db, done);
  const draft = startSession(s.db, s.anna, '2026-11-12');
  addSet(s.db, addExerciseToSession(s.db, draft, s.ex('Overhead press')), {
    weightKg: 40,
    reps: 8,
  });
  // the draft, the empty exercise and Jan (no sessions) give nothing
  expect(trainedFor(s.db, s.anna).map((r) => r.pattern)).toEqual(['HD']);
  expect(trainedFor(s.db, s.jan)).toEqual([]);
});
