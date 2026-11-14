import { fireEvent, screen } from '@testing-library/react-native';

import AddClient from '../../app/clients/add';
import { clients, measurements } from '../../data/schema';
import { renderWithDb } from '../renderWithDb';
import { mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

test('a double tap on Save client creates the client only once', async () => {
  const { db } = await renderWithDb(<AddClient />);
  await fireEvent.changeText(screen.getByLabelText('First name *'), 'Anna');
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '63');
  await fireEvent.press(save());
  await fireEvent.press(save());
  expect(db.select().from(clients).all()).toHaveLength(1);
});

test('a blank first name, or a height of 0 or text, keeps Save client disabled', async () => {
  await renderWithDb(<AddClient />);
  await fireEvent.changeText(screen.getByLabelText('First name *'), '   ');
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '63');
  expect(save()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('First name *'), 'Anna');
  await fireEvent.changeText(screen.getByLabelText('Height (cm)'), '0');
  expect(save()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Height (cm)'), 'abc');
  expect(save()).toBeDisabled();
});

const save = () => screen.getByRole('button', { name: 'Save client' });

test('Save client needs a first name and a valid body weight', async () => {
  await renderWithDb(<AddClient />);
  expect(save()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('First name *'), 'Anna');
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '-3');
  expect(save()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '63,5');
  expect(save()).toBeEnabled();
});

test('saving stores every field and goes back', async () => {
  const { db } = await renderWithDb(<AddClient />);
  await fireEvent.changeText(screen.getByLabelText('First name *'), 'Anna');
  await fireEvent.changeText(screen.getByLabelText('Last name'), 'Kowalska');
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '63,5');
  await fireEvent.press(screen.getByText('Female'));
  await fireEvent.changeText(screen.getByLabelText('Height (cm)'), '168');
  await fireEvent.press(save());
  expect(db.select().from(clients).get()).toMatchObject({
    firstName: 'Anna',
    lastName: 'Kowalska',
    gender: 'female',
    heightCm: 168,
    isSelf: false,
  });
  expect(db.select().from(measurements).get()!.value).toBe(63.5);
  expect(mockRouter.back).toHaveBeenCalled();
});

test('the four gender options from the design are offered', async () => {
  await renderWithDb(<AddClient />);
  for (const g of ['Female', 'Male', 'Other', 'Prefer not to say']) {
    expect(screen.getByText(g)).toBeTruthy();
  }
});
