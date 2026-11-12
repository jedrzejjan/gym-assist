// The log-session start and choose-exercise flow on a real Expo Router stack (no router mock),
// so the tests also check where "back" goes.
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import ClientScreen from '../../app/clients/[id]/index';
import AddExercise from '../../app/library/add';
import SessionExercise from '../../app/session/[id]/exercise/[seId]';
import SessionPage from '../../app/session/[id]/index';
import PatternExercises from '../../app/session/[id]/pattern/[pattern]';
import Patterns from '../../app/session/[id]/patterns';
import SearchExercises from '../../app/session/[id]/search';
import StartSession from '../../app/session/start';
import { createClient } from '../../data/clients';
import { listExercises, seedExercises } from '../../data/exercises';
import { DbProvider } from '../../data/live';
import { SEED_EXERCISES } from '../../data/seed/exercises';
import { getDraft, listSessionExercises, startSession } from '../../data/sessions';
import { logSession } from '../../data/testing/logSession';
import { createTestDb } from '../../data/testing/testDb';
import type { Db } from '../../data/types';
import { fixToday } from '../fixedToday';

function setup() {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  const anna = createClient(db, {
    firstName: 'Anna',
    lastName: 'Kowalska',
    weightKg: 63.5,
    weightDate: '2026-10-01',
  });
  const exerciseId = (name: string) =>
    listExercises(db, { search: name }).find((e) => e.nameEn === name)!.id;
  return { db, anna, exerciseId };
}

function renderApp(db: Db, initialUrl: string) {
  return renderRouter(
    {
      _layout: () => (
        <DbProvider db={db}>
          <Stack screenOptions={{ headerShown: false }} />
        </DbProvider>
      ),
      'clients/[id]/index': ClientScreen,
      'session/start': StartSession,
      'session/[id]/index': SessionPage,
      'session/[id]/patterns': Patterns,
      'session/[id]/pattern/[pattern]': PatternExercises,
      'session/[id]/search': SearchExercises,
      'session/[id]/exercise/[seId]': SessionExercise,
      'library/add': AddExercise,
    },
    { initialUrl },
  );
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

test('"Start session" opens the date step (today by default), then the empty session page', async () => {
  fixToday(2026, 11, 12);
  const { db, anna } = setup();
  await renderApp(db, `/clients/${anna}`);
  await press('Start session');
  expect(screen).toHavePathname('/session/start');
  expect(screen.getByText('Today, 12 Nov 2026')).toBeTruthy();
  await press('Start');
  const draft = getDraft(db)!;
  expect(draft.clientId).toBe(anna);
  expect(screen).toHavePathname(`/session/${draft.sessionId}`);
  expect(screen.getByText('Anna Kowalska · 12 Nov')).toBeTruthy();
  expect(screen.getByText('No exercises yet. Add the first one:')).toBeTruthy();
  // The date step is not in the history: back goes to the client.
  await act(() => router.back());
  expect(screen).toHavePathname(`/clients/${anna}`);
});

test('starting while another session is a draft says so and starts nothing', async () => {
  const { db, anna } = setup();
  const jan = createClient(db, { firstName: 'Jan', weightKg: 80, weightDate: '2026-10-01' });
  const draft = startSession(db, jan, '2026-11-12');
  await renderApp(db, `/session/start?clientId=${anna}`);
  await press('Start');
  expect(
    screen.getByText('Another session is in progress (Jan). Finish or cancel it first.'),
  ).toBeTruthy();
  expect(getDraft(db)!.sessionId).toBe(draft);
  expect(screen).toHavePathname('/session/start');
});

test('choose by pattern: Knee Dominant → Back squat opens the exercise, "First time"', async () => {
  const { db, anna } = setup();
  const sid = startSession(db, anna, '2026-11-12');
  await renderApp(db, `/session/${sid}`);
  await press('By pattern');
  expect(screen.getByText('Choose by pattern')).toBeTruthy();
  expect(screen.getAllByText('No exercises yet')).toHaveLength(2); // Anti flexion, Carries
  await fireEvent.press(screen.getByText('Knee Dominant'));
  await fireEvent.press(screen.getByText('Back squat'));
  const [se] = listSessionExercises(db, sid);
  expect(se.nameEn).toBe('Back squat');
  expect(screen).toHavePathname(`/session/${sid}/exercise/${se.id}`);
  expect(screen.getByText('Back squat')).toBeTruthy();
  expect(screen.getByText('Przysiad ze sztangą')).toBeTruthy();
  expect(screen.getByText('First time')).toBeTruthy();
  expect(screen.getByText('No sets yet.')).toBeTruthy();
  // Back from the exercise goes to the session page, which now lists it.
  await act(() => router.back());
  expect(screen).toHavePathname(`/session/${sid}`);
  expect(screen.getByText('1  Back squat')).toBeTruthy();
});

test('a pattern name with a space opens its exercises; an empty pattern is disabled', async () => {
  const { db, anna } = setup();
  const sid = startSession(db, anna, '2026-11-12');
  await renderApp(db, `/session/${sid}/patterns`);
  expect(screen.getByRole('button', { name: /Carries/ })).toBeDisabled();
  await fireEvent.press(screen.getByText('Pull vertical'));
  expect(screen.getByText('Pull vertical')).toBeTruthy(); // the page title
  await fireEvent.press(screen.getByText('Overhand pull-up'));
  expect(listSessionExercises(db, sid).map((e) => e.nameEn)).toEqual(['Overhand pull-up']);
});

test('Start is disabled when the client is unknown', async () => {
  const { db } = setup();
  await renderApp(db, '/session/start?clientId=nobody');
  expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
});

test('the exercise shows last time from the client’s latest finished session', async () => {
  const { db, anna, exerciseId } = setup();
  logSession(db, {
    clientId: anna,
    date: '2026-11-05',
    exerciseId: exerciseId('Bench press'),
    sets: [
      [60, 8],
      [60, 8],
      [62.5, 6],
    ],
  });
  const sid = startSession(db, anna, '2026-11-12');
  await renderApp(db, `/session/${sid}`);
  await press('Full list');
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'bench');
  await fireEvent.press(screen.getByText('Bench press'));
  expect(screen.getByText('Last time: 60 kg × 8, 60 kg × 8, 62.5 kg × 6')).toBeTruthy();
});

test('search shows the number of results, and the empty state when nothing matches', async () => {
  const { db, anna } = setup();
  const sid = startSession(db, anna, '2026-11-12');
  await renderApp(db, `/session/${sid}/search`);
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'squ');
  expect(screen.getByText('2 results')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'xyz');
  expect(screen.getByText('No exercises match "xyz".')).toBeTruthy();
  expect(screen.getByText('Check the spelling, or search in English or Polish.')).toBeTruthy();
});

test('"New exercise" opens Add exercise; saving adds it to the session and opens it', async () => {
  const { db, anna } = setup();
  const sid = startSession(db, anna, '2026-11-12');
  await renderApp(db, `/session/${sid}`);
  await press('New exercise');
  expect(screen).toHavePathname('/library/add');
  expect(screen.getByRole('button', { name: '‹ Session' })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('English name *'), 'Ring dips');
  const pick = (group: string, option: string) =>
    fireEvent.press(
      within(screen.getByTestId(`chips:${group}`)).getByRole('radio', { name: option }),
    );
  await pick('Category *', 'Push');
  await pick('Training type *', 'Strength');
  await pick('Pattern *', 'Push vertical');
  await press('Save exercise');
  const [se] = listSessionExercises(db, sid);
  expect(se.nameEn).toBe('Ring dips');
  expect(screen).toHavePathname(`/session/${sid}/exercise/${se.id}`);
  expect(screen.getByText('First time')).toBeTruthy();
  await act(() => router.back());
  expect(screen).toHavePathname(`/session/${sid}`);
});
