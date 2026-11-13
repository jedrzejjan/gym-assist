/**
 * @jest-environment node
 */
import { count } from 'drizzle-orm';

import { createClient } from '../clients';
import { listExercises, seedExercises } from '../exercises';
import { deleteSession, listHistory, sessionSummary } from '../history';
import { SEED_EXERCISES } from '../seed/exercises';
import { sessionExercises, sets } from '../schema';
import {
  addExerciseToSession,
  addSet,
  finishSession,
  getSession,
  listSessionExercises,
  moveExercise,
  startSession,
} from '../sessions';
import { createTestDb } from '../testing/testDb';
import type { Db } from '../types';

function setup() {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const anna = createClient(db, { firstName: 'Anna', weightKg: 63.5, weightDate: '2026-10-01' });
  const jan = createClient(db, { firstName: 'Jan', weightKg: 80, weightDate: '2026-10-01' });
  const ex = (name: string) =>
    listExercises(db, { search: name }).find((e) => e.nameEn === name)!.id;
  return { db, anna, jan, ex };
}

type Plan = [exerciseId: string, sets: [number | null, number | null][]][];

/** Logs a session through the real repository functions; finishes it unless `draft`. */
function log(db: Db, clientId: string, date: string, plan: Plan, draft = false): string {
  const sid = startSession(db, clientId, date);
  for (const [exerciseId, values] of plan) {
    const se = addExerciseToSession(db, sid, exerciseId);
    for (const [weightKg, reps] of values) addSet(db, se, { weightKg, reps });
  }
  if (!draft) finishSession(db, sid);
  return sid;
}

const rows = (db: Db, table: typeof sets | typeof sessionExercises) =>
  db.select({ n: count() }).from(table).get()!.n;

test('listHistory shows finished sessions newest first with exercise and set counts', () => {
  const s = setup();
  const older = log(s.db, s.anna, '2026-10-31', [[s.ex('Back squat'), [[80, 5]]]]);
  const newer = log(s.db, s.anna, '2026-11-05', [
    [
      s.ex('Back squat'),
      [
        [80, 5],
        [85, 3],
      ],
    ],
    [s.ex('Bench press'), [[50, 8]]],
    [s.ex('Deadlift'), []],
  ]);
  log(s.db, s.jan, '2026-11-06', [[s.ex('Deadlift'), [[100, 5]]]]); // another client
  log(s.db, s.anna, '2026-11-07', [[s.ex('Bench press'), [[50, 8]]]], true); // a draft

  expect(listHistory(s.db, s.anna)).toEqual([
    { sessionId: newer, date: '2026-11-05', exerciseCount: 3, setCount: 3 },
    { sessionId: older, date: '2026-10-31', exerciseCount: 1, setCount: 1 },
  ]);
  expect(listHistory(s.db, 'nobody')).toEqual([]);
});

test('two sessions on the same day: the one finished later comes first', () => {
  const s = setup();
  const first = log(s.db, s.anna, '2026-11-05', [[s.ex('Back squat'), [[80, 5]]]]);
  const second = log(s.db, s.anna, '2026-11-05', [[s.ex('Bench press'), [[50, 8]]]]);
  expect(listHistory(s.db, s.anna).map((r) => r.sessionId)).toEqual([second, first]);
});

test('sessionSummary orders exercises by position and sets by set_no', () => {
  const s = setup();
  const sid = log(s.db, s.anna, '2026-11-05', [
    [
      s.ex('Back squat'),
      [
        [80, 5],
        [85, 3],
      ],
    ],
    [
      s.ex('Overhand pull-up'),
      [
        [10, 6],
        [null, 8],
      ],
    ],
  ]);
  // move the pull-up first, as the trainer could in Reorder
  const pullUp = getSessionExerciseId(s.db, sid, 1);
  moveExercise(s.db, pullUp, 'up');

  expect(sessionSummary(s.db, sid)).toEqual({
    date: '2026-11-05',
    clientId: s.anna,
    status: 'finished',
    exercises: [
      {
        id: expect.any(String),
        nameEn: 'Overhand pull-up',
        namePl: 'Podciąganie nachwytem',
        usesBodyweight: true,
        sets: [
          { weightKg: 10, reps: 6 },
          { weightKg: null, reps: 8 },
        ],
      },
      {
        id: expect.any(String),
        nameEn: 'Back squat',
        namePl: 'Przysiad ze sztangą',
        usesBodyweight: false,
        sets: [
          { weightKg: 80, reps: 5 },
          { weightKg: 85, reps: 3 },
        ],
      },
    ],
  });
  expect(sessionSummary(s.db, 'missing')).toBeNull();
});

test('deleteSession removes the session, its exercises and sets, and refuses a draft', () => {
  const s = setup();
  const kept = log(s.db, s.anna, '2026-10-31', [[s.ex('Back squat'), [[80, 5]]]]);
  const gone = log(s.db, s.anna, '2026-11-05', [
    [
      s.ex('Back squat'),
      [
        [80, 5],
        [85, 3],
      ],
    ],
    [s.ex('Bench press'), [[50, 8]]],
  ]);
  deleteSession(s.db, gone);
  expect(getSession(s.db, gone)).toBeNull();
  expect(getSession(s.db, kept)).not.toBeNull();
  expect(rows(s.db, sessionExercises)).toBe(1);
  expect(rows(s.db, sets)).toBe(1);

  const draft = log(s.db, s.anna, '2026-11-07', [[s.ex('Bench press'), [[50, 8]]]], true);
  expect(() => deleteSession(s.db, draft)).toThrow('Only a finished session');
  expect(getSession(s.db, draft)).not.toBeNull();
});

function getSessionExerciseId(db: Db, sessionId: string, index: number): string {
  return listSessionExercises(db, sessionId)[index].id;
}
