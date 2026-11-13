import fs from 'node:fs';
import path from 'node:path';

import { fireEvent, screen } from '@testing-library/react-native';

import CreateProfile from '../../app/create-profile';
import ImportScreen from '../../app/settings/import';
import Settings from '../../app/settings/index';
import { createClient, getSelf } from '../../data/clients';
import { seedExercises } from '../../data/exercises';
import { pickTextFile } from '../../data/files';
import { listHistory } from '../../data/history';
import { SEED_EXERCISES } from '../../data/seed/exercises';
import { setSetting, WELCOME_DONE } from '../../data/settings';
import { createTestDb } from '../../data/testing/testDb';
import { fixToday } from '../fixedToday';
import { renderWithDb } from '../renderWithDb';
import { mockParams, mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);
jest.mock('../../data/files', () => ({
  pickFolder: jest.fn(),
  openFolder: jest.fn(),
  pickTextFile: jest.fn(),
}));
const pick = pickTextFile as jest.MockedFunction<typeof pickTextFile>;

const SAMPLE = fs.readFileSync(
  path.join(__dirname, '..', 'fixtures', 'sessions-sample.csv'),
  'utf8',
);
const HEADER = 'date,exercise_en,set_no,side,weight_kg,reps,height_cm,speed_kmh,minutes,note';

beforeEach(() => {
  pick.mockReset();
  fixToday(2026, 11, 12);
});

function setup({ withSelf = true } = {}) {
  const db = createTestDb();
  seedExercises(db, SEED_EXERCISES);
  setSetting(db, WELCOME_DONE, '1');
  if (withSelf) {
    createClient(db, { firstName: 'Me', isSelf: true, weightKg: 82, weightDate: '2026-10-01' });
  }
  return db;
}

const button = (name: string) => screen.getByRole('button', { name });

test('success shows "8 sessions imported into Me." and "You can see them in Me › History."', async () => {
  const db = setup();
  pick.mockResolvedValue({ name: 'sessions.csv', text: SAMPLE });
  await renderWithDb(<ImportScreen />, db);
  expect(screen.getByText('Import history')).toBeTruthy();
  await fireEvent.press(button('Choose file'));
  expect(await screen.findByText('Import complete')).toBeTruthy();
  expect(screen.getByText('8 sessions imported into Me.')).toBeTruthy();
  expect(screen.getByText('You can see them in Me › History.')).toBeTruthy();
  expect(listHistory(db, getSelf(db)!.id)).toHaveLength(8);
  await fireEvent.press(button('Done'));
  expect(mockRouter.back).toHaveBeenCalled();
});

test('one session reads "1 session imported into Me."', async () => {
  const db = setup();
  pick.mockResolvedValue({
    name: 'one.csv',
    text: `${HEADER}\n2026-11-01,Back squat,1,,80,5,,,,\n`,
  });
  await renderWithDb(<ImportScreen />, db);
  await fireEvent.press(button('Choose file'));
  expect(await screen.findByText('1 session imported into Me.')).toBeTruthy();
});

test('the profile’s current name is used', async () => {
  const db = setup({ withSelf: false });
  createClient(db, {
    firstName: 'Jan',
    lastName: 'Kowal',
    isSelf: true,
    weightKg: 82,
    weightDate: '2026-10-01',
  });
  pick.mockResolvedValue({
    name: 'one.csv',
    text: `${HEADER}\n2026-11-01,Back squat,1,,80,5,,,,\n`,
  });
  await renderWithDb(<ImportScreen />, db);
  await fireEvent.press(button('Choose file'));
  expect(await screen.findByText('1 session imported into Jan Kowal.')).toBeTruthy();
  expect(screen.getByText('You can see them in Jan Kowal › History.')).toBeTruthy();
});

test('error shows "Nothing was imported", the row and the bullet list of names, and "Choose another file"', async () => {
  const db = setup();
  pick.mockResolvedValue({
    name: 'bad.csv',
    text: [
      HEADER,
      '2026-11-01,Back squat,1,,80,5,,,,',
      '2026-11-01,Front squat,1,,60,5,,,,',
      '2026-11-02,Nordic curl,1,,,6,,,,',
    ].join('\n'),
  });
  await renderWithDb(<ImportScreen />, db);
  await fireEvent.press(button('Choose file'));
  expect(await screen.findByText('Nothing was imported')).toBeTruthy();
  expect(screen.getByText('Row 3 has an exercise that is not in the library:')).toBeTruthy();
  expect(screen.getByText('Unknown exercise names')).toBeTruthy();
  expect(screen.getByText('• Front squat\n• Nordic curl')).toBeTruthy();
  expect(screen.getByText('Fix the names in the CSV file and import again.')).toBeTruthy();
  expect(listHistory(db, getSelf(db)!.id)).toEqual([]);

  pick.mockResolvedValue({ name: 'good.csv', text: SAMPLE });
  await fireEvent.press(button('Choose another file'));
  expect(await screen.findByText('8 sessions imported into Me.')).toBeTruthy();
});

test('a bad value shows its row, and dates Me already has are listed', async () => {
  const db = setup();
  pick.mockResolvedValue({
    name: 'bad.csv',
    text: `${HEADER}\n2026-11-01,Back squat,1,,80,0,,,,\n`,
  });
  await renderWithDb(<ImportScreen />, db);
  await fireEvent.press(button('Choose file'));
  expect(await screen.findByText('Row 2: reps must be a whole number, 1 or more.')).toBeTruthy();

  pick.mockResolvedValue({ name: 'sample.csv', text: SAMPLE });
  await fireEvent.press(button('Choose another file'));
  await screen.findByText('Import complete');
  pick.mockResolvedValue({ name: 'sample.csv', text: SAMPLE }); // the same file again
  await renderWithDb(<ImportScreen />, db);
  await fireEvent.press(screen.getAllByRole('button', { name: 'Choose file' }).at(-1)!);
  expect(
    await screen.findByText(
      /^Me already has sessions on 20 Oct 2026, 30 Oct 2026, .* 12 Nov 2026\.$/,
    ),
  ).toBeTruthy();
  expect(listHistory(db, getSelf(db)!.id)).toHaveLength(8); // nothing doubled
});

test('cancelling the file picker changes nothing', async () => {
  const db = setup();
  pick.mockResolvedValue(null);
  await renderWithDb(<ImportScreen />, db);
  await fireEvent.press(button('Choose file'));
  expect(screen.getByRole('button', { name: 'Choose file' })).toBeTruthy();
  expect(screen.queryByText('Nothing was imported')).toBeNull();
});

test('Settings: with Me, Import history opens the import', async () => {
  await renderWithDb(<Settings />, setup());
  await fireEvent.press(screen.getByRole('button', { name: /^Import history \(CSV\)/ }));
  expect(mockRouter.push).toHaveBeenCalledWith('/settings/import');
});

test('without Me the import opens Create my profile, then continues', async () => {
  const db = setup({ withSelf: false });
  await renderWithDb(<Settings />, db);
  await fireEvent.press(screen.getByRole('button', { name: /^Import history \(CSV\)/ }));
  expect(mockRouter.push).toHaveBeenCalledWith('/create-profile?then=import');

  mockParams.current = { then: 'import' };
  await renderWithDb(<CreateProfile />, db);
  expect(screen.getByRole('button', { name: '‹ Settings' })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('First name *'), 'Jan');
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '82');
  await fireEvent.press(button('Save and continue'));
  expect(getSelf(db)).toMatchObject({ firstName: 'Jan' });
  expect(mockRouter.replace).toHaveBeenCalledWith('/settings/import');
});
