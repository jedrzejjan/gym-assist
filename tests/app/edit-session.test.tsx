/**
 * Editing a finished session (GYM-102, Sprint 2 plan decision 4), through the real router:
 * History → summary → Edit → the session, reorder and exercise pages in edit mode.
 */
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import HistoryTab from '../../app/clients/[id]/history';
import Home from '../../app/index';
import SessionExercise from '../../app/session/[id]/exercise/[seId]';
import SessionPage from '../../app/session/[id]/index';
import Reorder from '../../app/session/[id]/reorder';
import SessionSummary from '../../app/session/[id]/summary';
import { createClient } from '../../data/clients';
import { listExercises, seedExercises } from '../../data/exercises';
import { listHistory } from '../../data/history';
import { DbProvider } from '../../data/live';
import { SEED_EXERCISES } from '../../data/seed/exercises';
import {
  addExerciseToSession,
  addSet,
  finishSession,
  getDraft,
  getSession,
  listSessionExercises,
  listSets,
  startSession,
} from '../../data/sessions';
import { setSetting, WELCOME_DONE } from '../../data/settings';
import { createTestDb } from '../../data/testing/testDb';
import type { Db } from '../../data/types';
import { fixToday } from '../fixedToday';

// The native date picker, replaced by a button that picks 10 Nov 2026.
jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = require('react');
  const { Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ({ onChange }: { onChange: (e: { type: string }, d: Date) => void }) =>
      createElement(Pressable, {
        accessibilityRole: 'button',
        accessibilityLabel: 'Pick 10 Nov 2026',
        onPress: () => onChange({ type: 'set' }, new Date(2026, 10, 10, 12)),
      }),
  };
});

function setup() {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  setSetting(db, WELCOME_DONE, '1');
  const anna = createClient(db, {
    firstName: 'Anna',
    lastName: 'Kowalska',
    weightKg: 63.5,
    weightDate: '2026-10-01',
  });
  const jan = createClient(db, { firstName: 'Jan', weightKg: 80, weightDate: '2026-10-01' });
  const ex = (name: string) =>
    listExercises(db, { search: name }).find((e) => e.nameEn === name)!.id;
  return { db, anna, jan, ex };
}

type Plan = [string, [number | null, number | null][]][];

function log(db: Db, clientId: string, date: string, plan: Plan): string {
  const sid = startSession(db, clientId, date);
  for (const [exerciseId, values] of plan) {
    const se = addExerciseToSession(db, sid, exerciseId);
    for (const [weightKg, reps] of values) addSet(db, se, { weightKg, reps });
  }
  finishSession(db, sid);
  return sid;
}

/** Anna on 5 Nov: Back squat 80×5, 85×3 and Overhand pull-up BW+10×6. */
function fiveNov(s: ReturnType<typeof setup>) {
  return log(s.db, s.anna, '2026-11-05', [
    [
      s.ex('Back squat'),
      [
        [80, 5],
        [85, 3],
      ],
    ],
    [s.ex('Overhand pull-up'), [[10, 6]]],
  ]);
}

function renderApp(db: Db, initialUrl: string) {
  return renderRouter(
    {
      _layout: () => (
        <DbProvider db={db}>
          <Stack screenOptions={{ headerShown: false }} />
        </DbProvider>
      ),
      index: Home,
      'clients/[id]/history': HistoryTab,
      'session/[id]/summary': SessionSummary,
      'session/[id]/index': SessionPage,
      'session/[id]/reorder': Reorder,
      'session/[id]/exercise/[seId]': SessionExercise,
    },
    { initialUrl },
  );
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

/** History → summary → Edit. */
async function openEdit(db: Db, clientId: string, date: string) {
  await renderApp(db, `/clients/${clientId}/history`);
  await fireEvent.press(screen.getByText(date));
  await press('Edit');
}

test('the summary says it is read-only and offers Edit', async () => {
  const s = setup();
  const sid = fiveNov(s);
  await renderApp(s.db, `/session/${sid}/summary`);
  expect(screen.getByText('Read-only. Tap Edit to change this session.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
});

test('Edit on the summary opens "Edit session" with the date, numbered rows, "+ By pattern", "+ Full list" and "Done"', async () => {
  const s = setup();
  const sid = fiveNov(s);
  await openEdit(s.db, s.anna, '5 Nov 2026');
  expect(screen).toHavePathname(`/session/${sid}`);
  expect(screen.getByText('Edit session')).toBeTruthy();
  expect(screen.getByRole('button', { name: '‹ Summary' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Date, 5 Nov 2026' })).toBeTruthy();
  expect(screen.getByText('1  Back squat')).toBeTruthy(); // no ✓ in a finished session
  expect(screen.getByText('2  Overhand pull-up')).toBeTruthy();
  expect(screen.getByText('Przysiad ze sztangą · 2 sets')).toBeTruthy();
  for (const b of ['+ By pattern', '+ Full list', '+ New exercise', 'Reorder', 'Done']) {
    expect(screen.getByRole('button', { name: b })).toBeTruthy();
  }
  expect(screen.getByText('Changes are saved at once. The session stays finished.')).toBeTruthy();
});

test('no Finish session or Cancel session in a finished session', async () => {
  const s = setup();
  fiveNov(s);
  await openEdit(s.db, s.anna, '5 Nov 2026');
  expect(screen.queryByRole('button', { name: 'Finish session' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Cancel session' })).toBeNull();
});

test('Done goes back to the summary', async () => {
  const s = setup();
  const sid = fiveNov(s);
  await openEdit(s.db, s.anna, '5 Nov 2026');
  await press('Done');
  expect(screen).toHavePathname(`/session/${sid}/summary`);
});

test('changing the date updates the summary and the History list', async () => {
  fixToday(2026, 11, 12);
  const s = setup();
  const sid = fiveNov(s);
  log(s.db, s.anna, '2026-11-07', [[s.ex('Bench press'), [[50, 8]]]]);
  await openEdit(s.db, s.anna, '5 Nov 2026');
  await press('Date, 5 Nov 2026');
  await press('Pick 10 Nov 2026');
  expect(getSession(s.db, sid)!.date).toBe('2026-11-10');
  expect(getSession(s.db, sid)!.status).toBe('finished');
  expect(screen.getByRole('button', { name: 'Date, 10 Nov 2026' })).toBeTruthy();
  await press('Done');
  expect(screen.getByText('10 Nov 2026')).toBeTruthy(); // the summary title
  await act(() => router.back());
  expect(screen).toHavePathname(`/clients/${s.anna}/history`);
  expect(listHistory(s.db, s.anna).map((r) => r.date)).toEqual(['2026-11-10', '2026-11-07']);
  expect(screen.getByText('10 Nov 2026')).toBeTruthy();
  expect(screen.queryByText('5 Nov 2026')).toBeNull();
});

test('removing the last exercise asks "Delete this session?" and Delete returns to History', async () => {
  const s = setup();
  const sid = log(s.db, s.anna, '2026-11-05', [[s.ex('Bench press'), [[50, 8]]]]);
  await openEdit(s.db, s.anna, '5 Nov 2026');
  await press('Reorder');
  await press('Remove Bench press');
  expect(screen.getByText('Delete this session?')).toBeTruthy();
  expect(
    screen.getByText('Bench press is its only exercise. A finished session needs at least one.'),
  ).toBeTruthy();
  await press('Cancel');
  expect(getSession(s.db, sid)).not.toBeNull();
  await press('Remove Bench press');
  await press('Delete');
  expect(getSession(s.db, sid)).toBeNull();
  expect(screen).toHavePathname(`/clients/${s.anna}/history`);
  expect(screen.getByText('No sessions yet. Start one from the Profile tab.')).toBeTruthy();
});

test('with two exercises, Remove works as in a draft and the session stays', async () => {
  const s = setup();
  const sid = fiveNov(s);
  await openEdit(s.db, s.anna, '5 Nov 2026');
  await press('Reorder');
  await press('Remove Overhand pull-up');
  expect(screen.getByText('Remove this exercise and its sets?')).toBeTruthy();
  await press('Remove');
  expect(listSessionExercises(s.db, sid).map((e) => e.nameEn)).toEqual(['Back squat']);
  expect(getSession(s.db, sid)!.status).toBe('finished');
});

test('the exercise page of a finished session shows "Done" instead of "Finish exercise"', async () => {
  const s = setup();
  log(s.db, s.anna, '2026-11-01', [[s.ex('Back squat'), [[70, 5]]]]);
  const sid = fiveNov(s);
  log(s.db, s.anna, '2026-11-09', [[s.ex('Back squat'), [[90, 5]]]]);
  await openEdit(s.db, s.anna, '5 Nov 2026');
  await fireEvent.press(screen.getByText('1  Back squat'));
  const [squat] = listSessionExercises(s.db, sid);
  expect(screen).toHavePathname(`/session/${sid}/exercise/${squat.id}`);
  expect(screen.queryByRole('button', { name: 'Finish exercise' })).toBeNull();
  // "Last time" is the session before this one (1 Nov), not the later 9 Nov
  expect(screen.getByText('Last time: 70 kg × 5')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '87,5');
  await fireEvent.changeText(screen.getByLabelText('Reps'), '2');
  await press('Add set');
  expect(listSets(s.db, squat.id)).toHaveLength(3);
  await press('Done');
  expect(screen).toHavePathname(`/session/${sid}`);
  expect(screen.getByText('Przysiad ze sztangą · 3 sets')).toBeTruthy();
  expect(getSession(s.db, sid)!.status).toBe('finished');
});

test('editing a finished session while a draft exists works and leaves the draft bar alone', async () => {
  const s = setup();
  const sid = fiveNov(s);
  const draft = startSession(s.db, s.jan, '2026-11-12');
  addExerciseToSession(s.db, draft, s.ex('Deadlift'));
  await renderApp(s.db, '/');
  expect(screen.getByText('Session in progress: Jan')).toBeTruthy();
  await act(() => router.push(`/session/${sid}/summary`));
  await press('Edit');
  await press('Reorder');
  await press('Move Overhand pull-up up');
  expect(listSessionExercises(s.db, sid).map((e) => e.nameEn)).toEqual([
    'Overhand pull-up',
    'Back squat',
  ]);
  expect(getDraft(s.db)!.sessionId).toBe(draft);
  expect(getSession(s.db, sid)!.status).toBe('finished');
  await act(() => router.dismissAll());
  expect(screen).toHavePathname('/');
  expect(screen.getByText('Session in progress: Jan')).toBeTruthy();
});
