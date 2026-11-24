// The log-session start and choose-exercise flow on a real Expo Router stack (no router mock),
// so the tests also check where "back" goes.
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import HistoryTab from '../../app/clients/[id]/history';
import ClientScreen from '../../app/clients/[id]/index';
import AddExercise from '../../app/library/add';
import SessionExercise from '../../app/session/[id]/exercise/[seId]';
import SessionPage from '../../app/session/[id]/index';
import PatternExercises from '../../app/session/[id]/pattern/[pattern]';
import Patterns from '../../app/session/[id]/patterns';
import SearchExercises from '../../app/session/[id]/search';
import StartSession from '../../app/session/start';
import { createClient } from '../../data/clients';
import { DbProvider } from '../../data/live';
import { getDraft, listSessionExercises, startSession } from '../../data/sessions';
import { logSession } from '../../data/testing/logSession';
import type { Db } from '../../data/types';
import { fixToday } from '../fixedToday';
import { exerciseId as idOf, seededTestDb } from '../../data/testing/library';

function setup() {
  const db = seededTestDb();
  const anna = createClient(db, {
    firstName: 'Anna',
    lastName: 'Kowalska',
    weightKg: 63.5,
    weightDate: '2026-10-01',
  });
  const exerciseId = (name: string) => idOf(db, name);
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
      'clients/[id]/history': HistoryTab,
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

test('choose by pattern: 5 patterns with counts; Knee dominant → Back Squat opens the exercise', async () => {
  const { db, anna } = setup();
  const sid = startSession(db, anna, '2026-11-12');
  await renderApp(db, `/session/${sid}`);
  await press('By pattern');
  expect(screen.getByText('Choose by pattern')).toBeTruthy();
  for (const [name, count] of [
    ['Knee dominant', '160 exercises'],
    ['Hip dominant', '106 exercises'],
    ['Push', '251 exercises'],
    ['Pull', '203 exercises'],
    ['Core', '95 exercises'],
  ]) {
    expect(screen.getByRole('button', { name: `${name}, ${count}` })).toBeTruthy();
  }
  expect(screen.queryByText('Cardio')).toBeNull(); // search only
  await fireEvent.press(screen.getByText('Knee dominant'));
  expect(screen.queryByRole('radio')).toBeNull(); // no subcategories for KD
  await fireEvent.press(screen.getByText('Back Squat'));
  const [se] = listSessionExercises(db, sid);
  expect(se.nameEn).toBe('Back Squat');
  expect(screen).toHavePathname(`/session/${sid}/exercise/${se.id}`);
  expect(screen.getByText('Back Squat')).toBeTruthy();
  expect(screen.getByText('Przysiad ze sztangą')).toBeTruthy();
  expect(screen.getByText('First time')).toBeTruthy();
  expect(screen.getByText('No sets yet.')).toBeTruthy();
  // Back from the exercise goes to the session page, which now lists it.
  await act(() => router.back());
  expect(screen).toHavePathname(`/session/${sid}`);
  expect(screen.getByText('1  Back Squat')).toBeTruthy();
});

test('Pull opens on the Vertical chip; Horizontal and Other switch the list; search stays in the chip', async () => {
  const { db, anna } = setup();
  const sid = startSession(db, anna, '2026-11-12');
  await renderApp(db, `/session/${sid}/patterns`);
  await fireEvent.press(screen.getByText('Pull'));
  expect(screen.getByText('Pull')).toBeTruthy(); // the page title
  expect(screen.getByRole('radio', { name: 'Vertical' })).toBeChecked();
  expect(screen.getByText('Chin-Up')).toBeTruthy();
  expect(screen.getByText('Podciąganie podchwytem · Bodyweight · Lats')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Horizontal' }));
  expect(screen.queryByText('Chin-Up')).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'Vertical' }));
  await fireEvent.changeText(screen.getByLabelText('Search in Pull'), 'chin');
  expect(screen.getByText('Chin-Up')).toBeTruthy();
  expect(screen.queryByText('Lat Pulldown')).toBeNull();
  await fireEvent.press(screen.getByText('Chin-Up'));
  expect(listSessionExercises(db, sid).map((e) => e.nameEn)).toEqual(['Chin-Up']);
});

test('Core has its own chips', async () => {
  const { db, anna } = setup();
  const sid = startSession(db, anna, '2026-11-12');
  await renderApp(db, `/session/${sid}/patterns`);
  await fireEvent.press(screen.getByText('Core'));
  for (const name of ['Anti-extension', 'Anti-rotation', 'Carry', 'Other']) {
    expect(screen.getByRole('radio', { name })).toBeTruthy();
  }
  expect(screen.getByRole('radio', { name: 'Anti-extension' })).toBeChecked();
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
  await fireEvent.press(screen.getByText('Bench Press'));
  expect(screen.getByText('Last time: 60 kg × 8, 60 kg × 8, 62.5 kg × 6')).toBeTruthy();
});

test('search counts results, finds other names with an "also" note, and says when nothing matches', async () => {
  const { db, anna } = setup();
  const sid = startSession(db, anna, '2026-11-12');
  await renderApp(db, `/session/${sid}/search`);
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'military');
  expect(screen.getByText('6 results')).toBeTruthy();
  expect(
    screen.getByText('Wyciskanie sztangi nad głowę · Barbell · Shoulders · also: military press'),
  ).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'xyz');
  expect(screen.getByText('No exercises match "xyz".')).toBeTruthy();
  expect(
    screen.getByText('Check the spelling, or try another name, in English or Polish.'),
  ).toBeTruthy();
});

test('"New exercise" opens Add exercise; saving adds it to the session and opens it', async () => {
  const { db, anna } = setup();
  const sid = startSession(db, anna, '2026-11-12');
  await renderApp(db, `/session/${sid}`);
  await press('New exercise');
  expect(screen).toHavePathname('/library/add');
  expect(screen.getByRole('button', { name: '‹ Session' })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('English name *'), 'My ring dips');
  const choose = async (label: string, option: string) => {
    const name = new RegExp(`^${label.replace('*', '\\*')}, `);
    await fireEvent.press(screen.getByRole('button', { name }));
    await fireEvent.press(screen.getByRole('radio', { name: option }));
  };
  await choose('Training type *', 'Strength');
  await choose('Pattern *', 'Push');
  await choose('Equipment *', 'Bodyweight');
  await fireEvent.press(screen.getByRole('button', { name: /^Primary muscles \*, / }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Chest' }));
  await press('Done (1)');
  await press('Save exercise');
  const [se] = listSessionExercises(db, sid);
  expect(se.nameEn).toBe('My ring dips');
  expect(screen).toHavePathname(`/session/${sid}/exercise/${se.id}`);
  expect(screen.getByText('First time')).toBeTruthy();
  await act(() => router.back());
  expect(screen).toHavePathname(`/session/${sid}`);
});
