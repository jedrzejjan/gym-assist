import { fireEvent, screen } from '@testing-library/react-native';

import ProgressTab from '../../app/clients/[id]/progress';
import SessionExercise from '../../app/session/[id]/exercise/[seId]';
import { createClient } from '../../data/clients';
import { listExercises, seedExercises } from '../../data/exercises';
import { onWrite } from '../../data/live';
import { addWeight } from '../../data/measurements';
import { currentOneRepMax, setOneRepMax } from '../../data/progress';
import { SEED_EXERCISES } from '../../data/seed/exercises';
import { addExerciseToSession, addSet, finishSession, startSession } from '../../data/sessions';
import { createTestDb } from '../../data/testing/testDb';
import type { Db } from '../../data/types';
import { fixToday } from '../fixedToday';
import { renderWithDb } from '../renderWithDb';
import { mockParams } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

function setup() {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const anna = createClient(db, {
    firstName: 'Anna',
    lastName: 'Kowalska',
    weightKg: 63.5,
    weightDate: '2026-10-01',
  });
  const ex = (name: string) =>
    listExercises(db, { search: name }).find((e) => e.nameEn === name)!.id;
  mockParams.current = { id: anna };
  return { db, anna, ex };
}

type Plan = [string, [number | null, number | null][]][];

function log(db: Db, clientId: string, date: string, plan: Plan) {
  const sid = startSession(db, clientId, date);
  for (const [exerciseId, values] of plan) {
    const se = addExerciseToSession(db, sid, exerciseId);
    for (const [weightKg, reps] of values) addSet(db, se, { weightKg, reps });
  }
  finishSession(db, sid);
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

test('Strength lists each exercise with "No 1RM yet" and its best set', async () => {
  const s = setup();
  log(s.db, s.anna, '2026-11-05', [
    [
      s.ex('Back squat'),
      [
        [80, 5],
        [92.5, 3],
      ],
    ],
  ]);
  await renderWithDb(<ProgressTab />, s.db);
  expect(screen.getByRole('tab', { name: 'Progress' })).toBeSelected();
  expect(screen.getByRole('radio', { name: 'Strength' })).toBeChecked();
  expect(screen.getByText('Back squat')).toBeTruthy();
  expect(screen.getByText('No 1RM yet')).toBeTruthy();
  expect(screen.getByText('Best set: 92.5 kg × 3')).toBeTruthy();
  expect(screen.getByText('Weight entry in % needs a 1RM for the exercise.')).toBeTruthy();
});

test('Estimate dialog reads "Back squat: 101.75 kg, from 92.5 kg × 3 on 5 Nov 2026." and Cancel stores nothing', async () => {
  const s = setup();
  log(s.db, s.anna, '2026-11-05', [[s.ex('Back squat'), [[92.5, 3]]]]);
  await renderWithDb(<ProgressTab />, s.db);
  await press('Estimate Back squat');
  expect(screen.getByText('Set the 1RM from history?')).toBeTruthy();
  expect(screen.getByText('Back squat: 101.75 kg, from 92.5 kg × 3 on 5 Nov 2026.')).toBeTruthy();
  await press('Cancel');
  expect(currentOneRepMax(s.db, s.anna, s.ex('Back squat'))).toBeNull();
  expect(screen.queryByText('Set the 1RM from history?')).toBeNull();
});

test('Estimate stores round(e1rm, 2) as estimated and the 1RM line reads "1RM 101.75 kg · estimated · 12 Nov 2026"', async () => {
  fixToday(2026, 11, 12);
  const s = setup();
  log(s.db, s.anna, '2026-11-05', [[s.ex('Back squat'), [[92.5, 3]]]]);
  log(s.db, s.anna, '2026-11-06', [[s.ex('Bench press'), [[50, 7]]]]); // 50 × (1 + 7/30) = 61.666…
  await renderWithDb(<ProgressTab />, s.db);
  await press('Estimate Back squat');
  await press('Set 1RM');
  expect(currentOneRepMax(s.db, s.anna, s.ex('Back squat'))).toMatchObject({
    valueKg: 101.75,
    source: 'estimated',
  });
  expect(screen.getByText('1RM 101.75 kg · estimated · 12 Nov 2026')).toBeTruthy();
  await press('Estimate Bench press');
  await press('Set 1RM');
  expect(currentOneRepMax(s.db, s.anna, s.ex('Bench press'))!.valueKg).toBe(61.67);
});

test('Set manually saves a typed 1RM; 0, blank and text keep Save disabled', async () => {
  fixToday(2026, 11, 12);
  const s = setup();
  log(s.db, s.anna, '2026-11-05', [[s.ex('Back squat'), [[80, 5]]]]);
  await renderWithDb(<ProgressTab />, s.db);
  await press('Set manually Back squat');
  expect(screen.getByText('Set 1RM manually')).toBeTruthy();
  expect(screen.getByText('Back squat · Anna Kowalska')).toBeTruthy();
  const field = screen.getByLabelText('1RM (kg)');
  for (const bad of ['', '0', 'abc', '-5']) {
    await fireEvent.changeText(field, bad);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  }
  await fireEvent.changeText(field, '105,5');
  await press('Save');
  expect(currentOneRepMax(s.db, s.anna, s.ex('Back squat'))).toMatchObject({
    valueKg: 105.5,
    source: 'manual',
  });
  expect(screen.getByText('1RM 105.5 kg · manual · 12 Nov 2026')).toBeTruthy();
});

test('no comparable set disables Estimate', async () => {
  const s = setup();
  log(s.db, s.anna, '2026-11-05', [[s.ex('Treadmill run'), [[null, null]]]]);
  await renderWithDb(<ProgressTab />, s.db);
  expect(screen.getByText('Best set: -')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Estimate Treadmill run' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Set manually Treadmill run' })).toBeEnabled();
});

test('a bodyweight 1RM reads "1RM 81 kg total (BW + 17.5) · manual · …"', async () => {
  fixToday(2026, 11, 12);
  const s = setup(); // latest body weight 63.5
  log(s.db, s.anna, '2026-11-05', [[s.ex('Overhand pull-up'), [[10, 6]]]]);
  await renderWithDb(<ProgressTab />, s.db);
  expect(screen.getByText('Best set: BW + 10 kg × 6')).toBeTruthy();
  await press('Set manually Overhand pull-up');
  await fireEvent.changeText(screen.getByLabelText('1RM (kg)'), '81');
  await press('Save');
  expect(screen.getByText('1RM 81 kg total (BW + 17.5) · manual · 12 Nov 2026')).toBeTruthy();
});

test('Body shows the latest weight, "−2.3 kg since 15 Sep" and the entries newest first', async () => {
  const s = setup();
  addWeight(s.db, s.anna, '2026-09-15', 65.8, { replace: false });
  addWeight(s.db, s.anna, '2026-11-10', 63.5, { replace: false });
  await renderWithDb(<ProgressTab />, s.db);
  await fireEvent.press(screen.getByRole('radio', { name: 'Body' }));
  expect(screen.getByText('Body weight')).toBeTruthy();
  expect(screen.getByText('−2.3 kg since 15 Sep')).toBeTruthy();
  const dates = screen.getAllByText(/^\d+ \w{3} 2026$/).map((t) => t.props.children);
  expect(dates).toEqual(['10 Nov 2026', '1 Oct 2026', '15 Sep 2026']);
  expect(screen.getByText('More measurements (waist, biceps…) come later.')).toBeTruthy();
  expect(screen.queryByText('No 1RM yet')).toBeNull();
});

test('a single weight entry shows no change line', async () => {
  const s = setup();
  await renderWithDb(<ProgressTab />, s.db);
  await fireEvent.press(screen.getByRole('radio', { name: 'Body' }));
  expect(screen.queryByText(/since/)).toBeNull();
});

test('after a stored 1RM, the exercise page enables %', async () => {
  const s = setup();
  const sid = startSession(s.db, s.anna, '2026-11-12');
  const seId = addExerciseToSession(s.db, sid, s.ex('Back squat'));
  mockParams.current = { id: sid, seId };
  const { unmount } = await renderWithDb(<SessionExercise />, s.db);
  expect(screen.getByRole('radio', { name: '%' })).toBeDisabled();
  await unmount();
  setOneRepMax(s.db, s.anna, s.ex('Back squat'), 100, 'manual');
  await renderWithDb(<SessionExercise />, s.db);
  expect(screen.getByRole('radio', { name: '%' })).toBeEnabled();
});

describe('Estimate all 1RMs (GYM-134)', () => {
  function twoToSet() {
    const s = setup();
    log(s.db, s.anna, '2026-11-05', [
      [s.ex('Back squat'), [[92.5, 3]]],
      [s.ex('Bench press'), [[50, 8]]],
      [s.ex('Deadlift'), [[100, 5]]],
    ]);
    setOneRepMax(s.db, s.anna, s.ex('Deadlift'), 150, 'manual');
    return s;
  }

  test('asks first, with the counts; Cancel stores nothing', async () => {
    const s = twoToSet();
    await renderWithDb(<ProgressTab />, s.db);
    await press('Estimate all 1RMs');
    expect(screen.getByText('Estimate all 1RMs?')).toBeTruthy();
    expect(
      screen.getByText("Set 2 new 1RMs from each exercise's best set. 1RMs set by hand stay."),
    ).toBeTruthy();
    await press('Cancel');
    expect(currentOneRepMax(s.db, s.anna, s.ex('Back squat'))).toBeNull();
    expect(screen.queryByText('Estimate all 1RMs?')).toBeNull();
  });

  test('Estimate all stores them in one write and keeps the manual 1RM', async () => {
    fixToday(2026, 11, 12);
    const s = twoToSet();
    await renderWithDb(<ProgressTab />, s.db);
    const writes: boolean[] = [];
    const stop = onWrite((e) => writes.push(e.export));
    await press('Estimate all 1RMs');
    await press('Estimate all');
    stop();
    expect(writes).toEqual([true]); // one write, exported once
    expect(currentOneRepMax(s.db, s.anna, s.ex('Back squat'))!.valueKg).toBe(101.75);
    expect(currentOneRepMax(s.db, s.anna, s.ex('Bench press'))!.valueKg).toBe(63.33);
    expect(currentOneRepMax(s.db, s.anna, s.ex('Deadlift'))).toMatchObject({
      valueKg: 150,
      source: 'manual',
    });
    expect(screen.getByText('1RM 101.75 kg · estimated · 12 Nov 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Estimate all 1RMs' })).toBeDisabled();
  });

  test('is disabled when nothing would change', async () => {
    const s = setup();
    log(s.db, s.anna, '2026-11-05', [[s.ex('Treadmill run'), [[null, null]]]]);
    await renderWithDb(<ProgressTab />, s.db);
    expect(screen.getByRole('button', { name: 'Estimate all 1RMs' })).toBeDisabled();
  });

  test('is not shown with no finished sessions, nor on Body', async () => {
    const s = setup();
    await renderWithDb(<ProgressTab />, s.db);
    expect(screen.queryByRole('button', { name: 'Estimate all 1RMs' })).toBeNull();
    log(s.db, s.anna, '2026-11-05', [[s.ex('Back squat'), [[92.5, 3]]]]);
    await fireEvent.press(screen.getByRole('radio', { name: 'Body' }));
    expect(screen.queryByRole('button', { name: 'Estimate all 1RMs' })).toBeNull();
  });
});
