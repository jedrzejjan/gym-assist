import { act, fireEvent, screen } from '@testing-library/react-native';

import EditProfile from '../../app/clients/[id]/edit';
import ClientScreen from '../../app/clients/[id]/index';
import Clients from '../../app/clients/index';
import { createClient, getClient, listClients } from '../../data/clients';
import { addWeight } from '../../data/measurements';
import { createTestDb } from '../../data/testing/testDb';
import { fixToday } from '../fixedToday';
import { renderWithDb } from '../renderWithDb';
import { mockParams, mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

function annaDb() {
  const db = createTestDb();
  const id = createClient(db, {
    firstName: 'Anna',
    lastName: 'Kowalska',
    gender: 'female',
    dateOfBirth: '1992-03-15',
    heightCm: 168,
    weightKg: 64.2,
    weightDate: '2026-10-27',
  });
  addWeight(db, id, '2026-11-10', 63.5, { replace: false });
  mockParams.current = { id };
  return { db, id };
}

test('the profile shows gender, age with date of birth, height and the latest weight', async () => {
  fixToday(2026, 11, 11);
  const { db } = annaDb();
  await renderWithDb(<ClientScreen />, db);
  expect(screen.getByText('Anna Kowalska')).toBeTruthy();
  expect(screen.getByText('Female')).toBeTruthy();
  expect(screen.getByText('34 years (15 Mar 1992)')).toBeTruthy();
  expect(screen.getByText('168 cm')).toBeTruthy();
  expect(screen.getByText('63.5 kg · 10 Nov 2026')).toBeTruthy();
});

test('the profile has no "Start session": it is on the History tab', async () => {
  const { db } = annaDb();
  await renderWithDb(<ClientScreen />, db);
  expect(screen.queryByRole('button', { name: 'Start session' })).toBeNull();
  expect(screen.getByRole('tab', { name: 'Profile' })).toBeSelected();
});

test('empty optional fields show "-"', async () => {
  const db = createTestDb();
  const id = createClient(db, { firstName: 'Jan', weightKg: 80, weightDate: '2026-11-01' });
  mockParams.current = { id };
  await renderWithDb(<ClientScreen />, db);
  expect(screen.getAllByText('-')).toHaveLength(3); // gender, age, height
});

test('"Weight history ›" opens the body-weight history and "Edit profile" opens the form', async () => {
  const { db, id } = annaDb();
  await renderWithDb(<ClientScreen />, db);
  await fireEvent.press(screen.getByText('Weight history ›'));
  expect(mockRouter.push).toHaveBeenCalledWith(`/clients/${id}/weight`);
  await fireEvent.press(screen.getByText('Edit profile'));
  expect(mockRouter.push).toHaveBeenCalledWith(`/clients/${id}/edit`);
});

test('Archive asks first, then hides the client and goes back', async () => {
  const { db, id } = annaDb();
  await renderWithDb(<ClientScreen />, db);
  await fireEvent.press(screen.getByText('Archive client'));
  expect(screen.getByText('Archive Anna Kowalska?')).toBeTruthy();
  expect(screen.getByText('The client is hidden from the list. All history is kept.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Archive' }));
  expect(getClient(db, id)!.archivedAt).not.toBeNull();
  expect(listClients(db)).toHaveLength(0);
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test('a double tap on Archive goes back only once', async () => {
  const { db } = annaDb();
  await renderWithDb(<ClientScreen />, db);
  await fireEvent.press(screen.getByText('Archive client'));
  const confirm = screen.getByRole('button', { name: 'Archive' });
  await act(() => {
    fireEvent.press(confirm);
    fireEvent.press(confirm);
  });
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test('Cancel in the archive dialog keeps the client', async () => {
  const { db, id } = annaDb();
  await renderWithDb(<ClientScreen />, db);
  await fireEvent.press(screen.getByText('Archive client'));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(getClient(db, id)!.archivedAt).toBeNull();
  expect(screen.queryByText('Archive Anna Kowalska?')).toBeNull();
});

test('"Me" has no Archive button and says it can only be renamed', async () => {
  const db = createTestDb();
  const id = createClient(db, {
    firstName: 'Jędrzej',
    isSelf: true,
    weightKg: 82,
    weightDate: '2026-11-07',
  });
  mockParams.current = { id };
  await renderWithDb(<ClientScreen />, db);
  expect(screen.queryByText('Archive client')).toBeNull();
  expect(screen.getByText('"Me" can be renamed but not archived.')).toBeTruthy();
});

test('Edit profile is filled in, saves the changes and goes back', async () => {
  const { db, id } = annaDb();
  await renderWithDb(<EditProfile />, db);
  expect(screen.getByLabelText('First name *').props.value).toBe('Anna');
  expect(screen.getByLabelText('Height (cm)').props.value).toBe('168');
  await fireEvent.changeText(screen.getByLabelText('First name *'), 'Ania');
  await fireEvent.changeText(screen.getByLabelText('Height (cm)'), '');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(getClient(db, id)).toMatchObject({ firstName: 'Ania', heightCm: null });
  expect(mockRouter.back).toHaveBeenCalled();
});

test('Edit profile keeps the first name required', async () => {
  const { db } = annaDb();
  await renderWithDb(<EditProfile />, db);
  await fireEvent.changeText(screen.getByLabelText('First name *'), '  ');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('tapping a client in the list opens their screen', async () => {
  const { db, id } = annaDb();
  await renderWithDb(<Clients />, db);
  await fireEvent.press(screen.getByText('Anna Kowalska'));
  expect(mockRouter.push).toHaveBeenCalledWith(`/clients/${id}`);
});
