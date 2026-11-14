// Finish, cancel, reorder, the one-draft dialogs and the Home "Session in progress" bar (GYM-21),
// on a real Expo Router stack.
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import HistoryTab from '../../app/clients/[id]/history';
import ClientScreen from '../../app/clients/[id]/index';
import Clients from '../../app/clients/index';
import Home from '../../app/index';
import SessionExercise from '../../app/session/[id]/exercise/[seId]';
import SessionPage from '../../app/session/[id]/index';
import Reorder from '../../app/session/[id]/reorder';
import StartSession from '../../app/session/start';
import { createClient } from '../../data/clients';
import { listExercises, seedExercises } from '../../data/exercises';
import { DbProvider } from '../../data/live';
import { SEED_EXERCISES } from '../../data/seed/exercises';
import {
  addExerciseToSession,
  addSet,
  finishExercise,
  getDraft,
  getSession,
  getSessionExercise,
  listSessionExercises,
  startSession,
} from '../../data/sessions';
import { setSetting, WELCOME_DONE } from '../../data/settings';
import { createTestDb } from '../../data/testing/testDb';
import type { Db } from '../../data/types';

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

/** Anna's draft on 10 Nov: Back squat (finished, 2 sets), Bench press (3 sets), Deadlift. */
function annasDraft(s: ReturnType<typeof setup>) {
  const sid = startSession(s.db, s.anna, '2026-11-10');
  const squat = addExerciseToSession(s.db, sid, s.ex('Back squat'));
  const bench = addExerciseToSession(s.db, sid, s.ex('Bench press'));
  const dead = addExerciseToSession(s.db, sid, s.ex('Deadlift'));
  addSet(s.db, squat, { weightKg: 80, reps: 5 });
  addSet(s.db, squat, { weightKg: 80, reps: 5 });
  finishExercise(s.db, squat);
  for (let i = 0; i < 3; i++) addSet(s.db, bench, { weightKg: 60, reps: 8 });
  return { sid, squat, bench, dead };
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
      'clients/index': Clients,
      'clients/[id]/index': ClientScreen,
      'clients/[id]/history': HistoryTab,
      'session/start': StartSession,
      'session/[id]/index': SessionPage,
      'session/[id]/reorder': Reorder,
      'session/[id]/exercise/[seId]': SessionExercise,
    },
    { initialUrl },
  );
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const names = (db: Db, sid: string) => listSessionExercises(db, sid).map((e) => e.nameEn);

describe('Home "Session in progress" bar', () => {
  test('no draft, no bar', async () => {
    const s = setup();
    await renderApp(s.db, '/');
    expect(screen.queryByText(/Session in progress/)).toBeNull();
  });

  test('opens the exercise that is still open; back goes to the session page', async () => {
    const s = setup();
    const { sid, bench } = annasDraft(s);
    await renderApp(s.db, '/');
    expect(screen.getByText('Session in progress: Anna Kowalska')).toBeTruthy();
    await press('Session in progress: Anna Kowalska, resume');
    expect(screen).toHavePathname(`/session/${sid}/exercise/${bench}`);
    await act(() => router.back());
    expect(screen).toHavePathname(`/session/${sid}`);
  });

  test('"Finish session" after resuming from the bar returns to Home, with no bar', async () => {
    const s = setup();
    const { sid } = annasDraft(s);
    await renderApp(s.db, '/');
    await press('Session in progress: Anna Kowalska, resume');
    await act(() => router.back()); // from the open exercise to the session page
    await press('Finish session');
    expect(getSession(s.db, sid)!.status).toBe('finished');
    expect(screen).toHavePathname('/');
    expect(screen.queryByText(/Session in progress/)).toBeNull();
  });

  test('opens the session page when every exercise is finished', async () => {
    const s = setup();
    const { sid, bench, dead } = annasDraft(s);
    finishExercise(s.db, bench);
    finishExercise(s.db, dead);
    await renderApp(s.db, '/');
    await press('Session in progress: Anna Kowalska, resume');
    expect(screen).toHavePathname(`/session/${sid}`);
  });
});

describe('one draft at a time: "Start session" while a draft exists', () => {
  test('asks, with the draft, and offers Resume, Finish it and Discard it', async () => {
    const s = setup();
    annasDraft(s);
    await renderApp(s.db, `/clients/${s.jan}`);
    await press('Start session');
    expect(screen.getByText('A session is already in progress')).toBeTruthy();
    expect(screen.getByText('Anna Kowalska · 10 Nov · 3 exercises')).toBeTruthy();
    for (const b of ['Resume', 'Finish it', 'Discard it']) {
      expect(screen.getByRole('button', { name: b })).toBeTruthy();
    }
  });

  test('an empty draft offers only Resume and Discard it', async () => {
    const s = setup();
    startSession(s.db, s.anna, '2026-11-10');
    await renderApp(s.db, `/clients/${s.jan}`);
    await press('Start session');
    expect(screen.getByText('Anna Kowalska · 10 Nov · empty')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Finish it' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
  });

  test('Resume opens the draft where the trainer left off', async () => {
    const s = setup();
    const { sid, bench } = annasDraft(s);
    await renderApp(s.db, `/clients/${s.jan}`);
    await press('Start session');
    await press('Resume');
    expect(screen).toHavePathname(`/session/${sid}/exercise/${bench}`);
  });

  test('Finish it saves the draft, then continues to the date step', async () => {
    const s = setup();
    const { sid } = annasDraft(s);
    await renderApp(s.db, `/clients/${s.jan}`);
    await press('Start session');
    await press('Finish it');
    expect(getSession(s.db, sid)!.status).toBe('finished');
    expect(screen).toHavePathname('/session/start');
  });

  test('Discard it asks "Discard this session?", then continues to the date step', async () => {
    const s = setup();
    const { sid } = annasDraft(s);
    await renderApp(s.db, `/clients/${s.jan}`);
    await press('Start session');
    await press('Discard it');
    expect(screen.getByText('Discard this session?')).toBeTruthy();
    expect(getSession(s.db, sid)).not.toBeNull(); // nothing deleted yet
    await press('Discard');
    expect(getSession(s.db, sid)).toBeNull();
    expect(screen).toHavePathname('/session/start');
  });

  test('a draft for the same client asks too', async () => {
    const s = setup();
    annasDraft(s);
    await renderApp(s.db, `/clients/${s.anna}`);
    await press('Start session');
    expect(screen.getByText('A session is already in progress')).toBeTruthy();
  });

  test('after Resume from the dialog, back from the exercise lands on the session page', async () => {
    const s = setup();
    const { sid } = annasDraft(s);
    await renderApp(s.db, `/clients/${s.jan}`);
    await press('Start session');
    await press('Resume');
    await act(() => router.back());
    expect(screen).toHavePathname(`/session/${sid}`);
  });

  test('a double tap on "Finish it" finishes once and opens the date step once', async () => {
    const s = setup();
    const { sid } = annasDraft(s);
    await renderApp(s.db, `/clients/${s.jan}`);
    await press('Start session');
    const finishIt = screen.getByRole('button', { name: 'Finish it' });
    await act(() => {
      fireEvent.press(finishIt);
      fireEvent.press(finishIt);
    });
    expect(getSession(s.db, sid)!.status).toBe('finished');
    expect(screen).toHavePathname('/session/start');
    await act(() => router.back());
    expect(screen).toHavePathname(`/clients/${s.jan}`);
  });

  test('without a draft, "Start session" goes straight to the date step', async () => {
    const s = setup();
    await renderApp(s.db, `/clients/${s.jan}`);
    await press('Start session');
    expect(screen).toHavePathname('/session/start');
  });
});

describe('client tabs', () => {
  test('tabs replace each other: back from History returns to Clients', async () => {
    const s = setup();
    await renderApp(s.db, '/clients');
    await fireEvent.press(screen.getByText('Jan'));
    expect(screen).toHavePathname(`/clients/${s.jan}`);
    await fireEvent.press(screen.getByRole('tab', { name: 'History' }));
    expect(screen).toHavePathname(`/clients/${s.jan}/history`);
    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    expect(screen).toHavePathname(`/clients/${s.jan}`);
    await act(() => router.back());
    expect(screen).toHavePathname('/clients');
  });

  test('a session finished after Start session returns to Profile and is listed on History', async () => {
    const s = setup();
    const { sid } = annasDraft(s);
    await renderApp(s.db, `/clients/${s.anna}`);
    await act(() => router.push(`/session/${sid}`));
    await press('Finish session');
    expect(screen).toHavePathname(`/clients/${s.anna}`);
    await fireEvent.press(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByText('10 Nov 2026')).toBeTruthy();
    expect(screen.getByText('3 exercises · 5 sets')).toBeTruthy();
  });
});

describe('the session page', () => {
  test('"Finish session" is disabled until the session has an exercise', async () => {
    const s = setup();
    const sid = startSession(s.db, s.anna, '2026-11-10');
    await renderApp(s.db, `/session/${sid}`);
    expect(screen.getByRole('button', { name: 'Finish session' })).toBeDisabled();
  });

  test('lists exercises with numbers, set counts and finished marks', async () => {
    const s = setup();
    const { sid } = annasDraft(s);
    await renderApp(s.db, `/session/${sid}`);
    expect(screen.getByText('Przysiad ze sztangą · 2 sets · finished')).toBeTruthy();
    expect(screen.getByText('Wyciskanie sztangi na ławce płaskiej · 3 sets')).toBeTruthy();
    expect(screen.getByText('Tap an exercise to open it again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ By pattern' })).toBeTruthy();
  });

  test('"Finish session" saves it as finished and leaves the session', async () => {
    const s = setup();
    const { sid } = annasDraft(s);
    await renderApp(s.db, `/clients/${s.anna}`);
    await act(() => router.push(`/session/${sid}`));
    await press('Finish session');
    expect(getSession(s.db, sid)!.status).toBe('finished');
    expect(getDraft(s.db)).toBeNull();
    expect(screen).toHavePathname(`/clients/${s.anna}`);
  });

  test('"Cancel session" asks "Discard this session?" and deletes it on Discard', async () => {
    const s = setup();
    const { sid } = annasDraft(s);
    await renderApp(s.db, `/clients/${s.anna}`);
    await act(() => router.push(`/session/${sid}`));
    await press('Cancel session');
    expect(
      screen.getByText('All exercises and sets in this session will be deleted.'),
    ).toBeTruthy();
    await press('Cancel');
    expect(getSession(s.db, sid)).not.toBeNull();
    await press('Cancel session');
    await press('Discard');
    expect(getSession(s.db, sid)).toBeNull();
    expect(screen).toHavePathname(`/clients/${s.anna}`);
  });

  test('a finished exercise opens again: its sets show and a new set reopens it', async () => {
    const s = setup();
    const { sid, squat } = annasDraft(s);
    await renderApp(s.db, `/session/${sid}`);
    await fireEvent.press(screen.getByText(/Back squat/));
    expect(screen).toHavePathname(`/session/${sid}/exercise/${squat}`);
    expect(screen.getAllByText('80 kg × 5')).toHaveLength(2);
    await fireEvent.changeText(screen.getByLabelText('Weight (kg)'), '85');
    await fireEvent.changeText(screen.getByLabelText('Reps'), '3');
    await press('Add set');
    expect(getSessionExercise(s.db, squat)!.finishedAt).toBeNull();
  });
});

describe('reorder', () => {
  test('▲ ▼ move exercises; the ends do nothing; Done goes back', async () => {
    const s = setup();
    const { sid } = annasDraft(s);
    await renderApp(s.db, `/session/${sid}`);
    await press('Reorder');
    expect(screen.getByText('Reorder exercises')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Move Back squat up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Deadlift down' })).toBeDisabled();
    await press('Move Deadlift up');
    expect(names(s.db, sid)).toEqual(['Back squat', 'Deadlift', 'Bench press']);
    await press('Move Back squat down');
    expect(names(s.db, sid)).toEqual(['Deadlift', 'Back squat', 'Bench press']);
    await press('Done');
    expect(screen).toHavePathname(`/session/${sid}`);
  });

  test('✕ asks "Remove this exercise and its sets?" and removes it on Remove', async () => {
    const s = setup();
    const { sid } = annasDraft(s);
    await renderApp(s.db, `/session/${sid}/reorder`);
    await press('Remove Bench press');
    const dialog = screen;
    expect(dialog.getByText('Remove this exercise and its sets?')).toBeTruthy();
    expect(dialog.getByText('Bench press · 3 sets')).toBeTruthy();
    await press('Remove');
    expect(names(s.db, sid)).toEqual(['Back squat', 'Deadlift']);
  });
});
