import { act, fireEvent, screen } from '@testing-library/react-native';

import HistoryTab from '../../app/clients/[id]/history';
import ClientScreen from '../../app/clients/[id]/index';
import SessionSummary from '../../app/session/[id]/summary';
import { createClient } from '../../data/clients';
import { listExercises, seedExercises } from '../../data/exercises';
import { SEED_EXERCISES } from '../../data/seed/exercises';
import {
  addExerciseToSession,
  addSet,
  finishSession,
  getSession,
  startSession,
} from '../../data/sessions';
import { createTestDb } from '../../data/testing/testDb';
import type { Db } from '../../data/types';
import { renderWithDb } from '../renderWithDb';
import { mockParams, mockRouter } from '../routerMock';

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
  return { db, anna, ex };
}

type Plan = [string, [number | null, number | null][]][];

function log(db: Db, clientId: string, date: string, plan: Plan, finish = true): string {
  const sid = startSession(db, clientId, date);
  for (const [exerciseId, values] of plan) {
    const se = addExerciseToSession(db, sid, exerciseId);
    for (const [weightKg, reps] of values) addSet(db, se, { weightKg, reps });
  }
  if (finish) finishSession(db, sid);
  return sid;
}

/** Anna on 5 Nov: Back squat 80×5, 85×3 and Overhand pull-up BW+10×6, BW×8. */
function fiveNov(s: ReturnType<typeof setup>) {
  return log(s.db, s.anna, '2026-11-05', [
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
}

const button = (name: string) => screen.getByRole('button', { name });

describe('History tab', () => {
  test('lists finished sessions newest first, as "5 Nov 2026" with "2 exercises · 4 sets"', async () => {
    const s = setup();
    log(s.db, s.anna, '2026-10-31', [[s.ex('Bench press'), [[50, 8]]]]);
    fiveNov(s);
    mockParams.current = { id: s.anna };
    await renderWithDb(<HistoryTab />, s.db);
    expect(screen.getByText('Anna Kowalska')).toBeTruthy();
    const titles = screen.getAllByText(/^\d+ \w+ 2026$/).map((t) => t.props.children);
    expect(titles).toEqual(['5 Nov 2026', '31 Oct 2026']);
    expect(screen.getByText('2 exercises · 4 sets')).toBeTruthy();
    expect(screen.getByText('1 exercise · 1 set')).toBeTruthy();
  });

  test('a draft is not listed', async () => {
    const s = setup();
    log(s.db, s.anna, '2026-11-07', [[s.ex('Bench press'), [[50, 8]]]], false);
    mockParams.current = { id: s.anna };
    await renderWithDb(<HistoryTab />, s.db);
    expect(screen.queryByText('7 Nov 2026')).toBeNull();
  });

  test('empty history says "No sessions yet. Start one from the Profile tab."', async () => {
    const s = setup();
    mockParams.current = { id: s.anna };
    await renderWithDb(<HistoryTab />, s.db);
    expect(screen.getByText('No sessions yet. Start one from the Profile tab.')).toBeTruthy();
  });

  test('History has no "Start session": it is on the Profile tab (GYM-133)', async () => {
    const s = setup();
    mockParams.current = { id: s.anna };
    await renderWithDb(<HistoryTab />, s.db);
    expect(screen.queryByRole('button', { name: 'Start session' })).toBeNull();
  });

  test('tapping a session opens its summary', async () => {
    const s = setup();
    const sid = fiveNov(s);
    mockParams.current = { id: s.anna };
    await renderWithDb(<HistoryTab />, s.db);
    await fireEvent.press(screen.getByText('5 Nov 2026'));
    expect(mockRouter.push).toHaveBeenCalledWith(`/session/${sid}/summary`);
  });
});

describe('client tabs', () => {
  test('History is the selected tab, and Profile replaces it', async () => {
    const s = setup();
    mockParams.current = { id: s.anna };
    await renderWithDb(<HistoryTab />, s.db);
    expect(screen.getByRole('tab', { name: 'History' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Profile' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/clients/${s.anna}`);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  test('on the profile, History replaces it; tapping the selected tab does nothing', async () => {
    const s = setup();
    mockParams.current = { id: s.anna };
    await renderWithDb(<ClientScreen />, s.db);
    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('tab', { name: 'History' }));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/clients/${s.anna}/history`);
  });
});

describe('session summary', () => {
  test('is read-only and shows each exercise with its sets, "BW + 10 kg × 6 · BW × 8"', async () => {
    const s = setup();
    mockParams.current = { id: fiveNov(s) };
    await renderWithDb(<SessionSummary />, s.db);
    expect(screen.getByText('5 Nov 2026')).toBeTruthy();
    expect(button('‹ History')).toBeTruthy();
    for (const text of [
      'Back squat',
      'Przysiad ze sztangą',
      '80 kg × 5 · 85 kg × 3',
      'Overhand pull-up',
      'Podciąganie nachwytem',
      'BW + 10 kg × 6 · BW × 8',
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  test('a blank value shows as "-"', async () => {
    const s = setup();
    mockParams.current = {
      id: log(s.db, s.anna, '2026-11-05', [[s.ex('Back squat'), [[null, 5]]]]),
    };
    await renderWithDb(<SessionSummary />, s.db);
    expect(screen.getByText('- × 5')).toBeTruthy();
  });

  test('"Delete session" asks "Delete this session? This cannot be undone." and returns to History', async () => {
    const s = setup();
    const sid = fiveNov(s);
    mockParams.current = { id: sid };
    await renderWithDb(<SessionSummary />, s.db);
    await fireEvent.press(button('Delete session'));
    expect(screen.getByText('Delete this session? This cannot be undone.')).toBeTruthy();
    expect(screen.getByText('5 Nov 2026 · 2 exercises · 4 sets')).toBeTruthy();
    await fireEvent.press(button('Delete'));
    expect(getSession(s.db, sid)).toBeNull();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  test('Cancel in the delete dialog keeps the session', async () => {
    const s = setup();
    const sid = fiveNov(s);
    mockParams.current = { id: sid };
    await renderWithDb(<SessionSummary />, s.db);
    await fireEvent.press(button('Delete session'));
    await fireEvent.press(button('Cancel'));
    expect(getSession(s.db, sid)).not.toBeNull();
    expect(screen.queryByText('Delete this session? This cannot be undone.')).toBeNull();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  test('a double tap on Delete deletes once and goes back once', async () => {
    const s = setup();
    mockParams.current = { id: fiveNov(s) };
    await renderWithDb(<SessionSummary />, s.db);
    await fireEvent.press(button('Delete session'));
    const del = button('Delete');
    await act(() => {
      fireEvent.press(del);
      fireEvent.press(del);
    });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});
