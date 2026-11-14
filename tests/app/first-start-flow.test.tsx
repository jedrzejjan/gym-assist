// A real Expo Router stack (no router mock), to test the navigation history itself.
import { router, Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import Clients from '../../app/clients/index';
import CreateProfile from '../../app/create-profile';
import Home from '../../app/index';
import Welcome from '../../app/welcome';
import { DbProvider } from '../../data/live';
import { setSetting, WELCOME_DONE } from '../../data/settings';
import { createTestDb } from '../../data/testing/testDb';
import type { Db } from '../../data/types';

function renderApp(db: Db, initialUrl = '/') {
  return renderRouter(
    {
      _layout: () => (
        <DbProvider db={db}>
          <Stack screenOptions={{ headerShown: false }} />
        </DbProvider>
      ),
      index: Home,
      welcome: Welcome,
      'create-profile': CreateProfile,
      'clients/index': Clients,
    },
    { initialUrl },
  );
}

test('after Welcome → Create my profile → Save, Home has no way back to Welcome', async () => {
  await renderApp(createTestDb());
  expect(screen).toHavePathname('/welcome');
  await fireEvent.press(screen.getByText('Create my profile'));
  expect(screen).toHavePathname('/create-profile');
  await fireEvent.changeText(screen.getByLabelText('First name *'), 'Jędrzej');
  await fireEvent.changeText(screen.getByLabelText('Body weight (kg) *'), '82');
  await fireEvent.press(screen.getByRole('button', { name: 'Save and continue' }));
  expect(screen).toHavePathname('/');
  expect(router.canGoBack()).toBe(false);
});

test('after "Skip for now", Home has no way back to Welcome', async () => {
  await renderApp(createTestDb());
  await fireEvent.press(screen.getByText('Skip for now'));
  expect(screen).toHavePathname('/');
  expect(router.canGoBack()).toBe(false);
});

test('Welcome sends an answered app straight to Home', async () => {
  const db = createTestDb();
  setSetting(db, WELCOME_DONE, '1');
  await renderApp(db, '/welcome');
  expect(screen).toHavePathname('/');
});
