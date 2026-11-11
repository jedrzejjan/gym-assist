import { fireEvent, screen } from '@testing-library/react-native';

import Welcome from '../../app/welcome';
import { getSetting, WELCOME_DONE } from '../../data/settings';
import { renderWithDb } from '../renderWithDb';
import { mockRouter } from '../routerMock';

jest.mock('expo-router', () => require('../routerMock').routerMock);

test('Welcome shows the question and both choices', async () => {
  await renderWithDb(<Welcome />);
  expect(screen.getByText('Do you want to track your own training too?')).toBeTruthy();
  expect(screen.getByText('Create my profile')).toBeTruthy();
  expect(screen.getByText('Skip for now')).toBeTruthy();
});

test('"Skip for now" remembers the choice and goes Home', async () => {
  const { db } = await renderWithDb(<Welcome />);
  await fireEvent.press(screen.getByText('Skip for now'));
  expect(getSetting(db, WELCOME_DONE)).toBe('1');
  expect(mockRouter.replace).toHaveBeenCalledWith('/');
});

test('"Create my profile" opens the profile form without answering Welcome yet', async () => {
  const { db } = await renderWithDb(<Welcome />);
  await fireEvent.press(screen.getByText('Create my profile'));
  expect(mockRouter.push).toHaveBeenCalledWith('/create-profile');
  expect(getSetting(db, WELCOME_DONE)).toBeNull();
});
