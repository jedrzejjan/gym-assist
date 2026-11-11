import { fireEvent, screen } from '@testing-library/react-native';
import { eq } from 'drizzle-orm';

import CreateProfile from '../../app/create-profile';
import { getSelf } from '../../data/clients';
import { measurements } from '../../data/schema';
import { clients } from '../../data/schema';
import { getSetting, WELCOME_DONE } from '../../data/settings';
import { renderWithDb } from '../renderWithDb';
import { mockParams, mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

test('a double tap on Save creates Me only once', async () => {
  const { db } = await renderWithDb(<CreateProfile />);
  await fireEvent.changeText(screen.getByLabelText('First name *'), 'Jędrzej');
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '82');
  await fireEvent.press(save());
  await fireEvent.press(save());
  expect(db.select().from(clients).all()).toHaveLength(1);
});

const save = () => screen.getByRole('button', { name: 'Save and continue' });

test('Save stays disabled until first name and a valid body weight are filled in', async () => {
  await renderWithDb(<CreateProfile />);
  expect(save()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('First name *'), 'Jędrzej');
  expect(save()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), 'abc');
  expect(save()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '82,5');
  expect(save()).toBeEnabled();
});

test('saving from Welcome creates Me with the weight, answers Welcome and goes Home', async () => {
  const { db } = await renderWithDb(<CreateProfile />);
  await fireEvent.changeText(screen.getByLabelText('First name *'), 'Jędrzej');
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '82,5');
  await fireEvent.press(save());
  const me = getSelf(db)!;
  expect(me.firstName).toBe('Jędrzej');
  const weights = db.select().from(measurements).where(eq(measurements.clientId, me.id)).all();
  expect(weights.map((w) => w.value)).toEqual([82.5]);
  expect(getSetting(db, WELCOME_DONE)).toBe('1');
  expect(mockRouter.replace).toHaveBeenCalledWith('/');
});

test('saving from Clients ("Add my profile") goes back to the list', async () => {
  mockParams.current = { from: 'clients' };
  await renderWithDb(<CreateProfile />);
  await fireEvent.changeText(screen.getByLabelText('First name *'), 'Jędrzej');
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '82');
  await fireEvent.press(save());
  expect(mockRouter.back).toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
