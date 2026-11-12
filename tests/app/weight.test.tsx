import { fireEvent, screen } from '@testing-library/react-native';

import AddWeightScreen from '../../app/clients/[id]/weight/add';
import EditWeightScreen from '../../app/clients/[id]/weight/[mid]';
import WeightHistory from '../../app/clients/[id]/weight/index';
import { createClient } from '../../data/clients';
import { addWeight, listWeights } from '../../data/measurements';
import { createTestDb } from '../../data/testing/testDb';
import { fixToday } from '../fixedToday';
import { renderWithDb } from '../renderWithDb';
import { mockParams, mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);
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

function annaDb() {
  const db = createTestDb();
  const id = createClient(db, { firstName: 'Anna', weightKg: 65.8, weightDate: '2026-09-15' });
  addWeight(db, id, '2026-10-27', 64.2, { replace: false });
  addWeight(db, id, '2026-11-10', 63.5, { replace: false });
  return { db, id };
}

test('the history shows the latest weight on top, then earlier entries newest first', async () => {
  const { db, id } = annaDb();
  mockParams.current = { id };
  await renderWithDb(<WeightHistory />, db);
  expect(screen.getByText('Latest')).toBeTruthy();
  expect(screen.getByText('Earlier entries · tap to edit')).toBeTruthy();
  const dates = screen.getAllByText(/^\d+ \w{3} 2026$/).map((t) => t.props.children);
  expect(dates).toEqual(['10 Nov 2026', '27 Oct 2026', '15 Sep 2026']);
  await fireEvent.press(screen.getByText('Add weight'));
  expect(mockRouter.push).toHaveBeenCalledWith(`/clients/${id}/weight/add`);
});

test('adding a weight on a new date saves it and goes back; the date defaults to today', async () => {
  fixToday(2026, 11, 12);
  const { db, id } = annaDb();
  mockParams.current = { id };
  await renderWithDb(<AddWeightScreen />, db);
  expect(screen.getByText('Today, 12 Nov 2026')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '63,1');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(listWeights(db, id)[0]).toMatchObject({ date: '2026-11-12', valueKg: 63.1 });
  expect(mockRouter.back).toHaveBeenCalled();
});

test('adding on a date that has a weight asks to replace it', async () => {
  fixToday(2026, 11, 10);
  const { db, id } = annaDb();
  mockParams.current = { id };
  await renderWithDb(<AddWeightScreen />, db);
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '63');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Replace the weight for this date?')).toBeTruthy();
  expect(screen.getByText('10 Nov 2026 already has 63.5 kg.')).toBeTruthy();
  expect(listWeights(db, id)[0].valueKg).toBe(63.5); // nothing changed yet
  await fireEvent.press(screen.getByRole('button', { name: 'Replace' }));
  expect(listWeights(db, id)[0].valueKg).toBe(63);
  expect(listWeights(db, id)).toHaveLength(3);
  expect(mockRouter.back).toHaveBeenCalled();
});

test('deleting an entry asks first, showing its weight and date', async () => {
  const { db, id } = annaDb();
  const oct = listWeights(db, id).find((w) => w.date === '2026-10-27')!;
  mockParams.current = { id, mid: oct.id };
  await renderWithDb(<EditWeightScreen />, db);
  await fireEvent.press(screen.getByRole('button', { name: 'Delete entry' }));
  expect(screen.getByText('Delete this weight entry?')).toBeTruthy();
  expect(screen.getByText('64.2 kg · 27 Oct 2026')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  expect(listWeights(db, id).map((w) => w.date)).toEqual(['2026-11-10', '2026-09-15']);
  expect(mockRouter.back).toHaveBeenCalled();
});

test('editing an entry saves the new value', async () => {
  const { db, id } = annaDb();
  const oct = listWeights(db, id).find((w) => w.date === '2026-10-27')!;
  mockParams.current = { id, mid: oct.id };
  await renderWithDb(<EditWeightScreen />, db);
  expect(screen.getByLabelText('Body weight (kg) *').props.value).toBe('64.2');
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '64,0');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(listWeights(db, id).find((w) => w.id === oct.id)!.valueKg).toBe(64);
});

test('the last remaining entry can be edited but has no Delete', async () => {
  const db = createTestDb();
  const id = createClient(db, { firstName: 'Jan', weightKg: 80, weightDate: '2026-11-01' });
  mockParams.current = { id, mid: listWeights(db, id)[0].id };
  await renderWithDb(<EditWeightScreen />, db);
  expect(screen.queryByRole('button', { name: 'Delete entry' })).toBeNull();
  expect(screen.getByText('The last remaining entry can be edited but not deleted.')).toBeTruthy();
});

test('moving an entry onto a date that has a weight asks to replace that one', async () => {
  const { db, id } = annaDb();
  const oct = listWeights(db, id).find((w) => w.date === '2026-10-27')!;
  mockParams.current = { id, mid: oct.id };
  await renderWithDb(<EditWeightScreen />, db);
  await fireEvent.press(screen.getByRole('button', { name: 'Date, 27 Oct 2026' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Pick 10 Nov 2026' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Replace the weight for this date?')).toBeTruthy();
  expect(screen.getByText('10 Nov 2026 already has 63.5 kg.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Replace' }));
  expect(listWeights(db, id).map((w) => [w.date, w.valueKg])).toEqual([
    ['2026-11-10', 64.2],
    ['2026-09-15', 65.8],
  ]);
  expect(mockRouter.back).toHaveBeenCalled();
});
