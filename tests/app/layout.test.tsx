import { render, screen, waitFor } from '@testing-library/react-native';

import RootLayout from '../../app/_layout';

jest.mock('expo-router', () => require('../routerMock').routerMock);
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('@expo-google-fonts/poppins', () => ({
  useFonts: () => [true],
  Poppins_400Regular: 1,
  Poppins_600SemiBold: 2,
}));
jest.mock('../../data/db/open', () => ({
  openAppDatabase: jest.fn(() =>
    Promise.resolve({ db: null, result: { ok: false, error: 'migration v4 failed' } }),
  ),
}));

test('a failed migration shows the error screen instead of the app', async () => {
  await render(<RootLayout />);
  await waitFor(() => expect(screen.getByText('The update could not finish')).toBeTruthy());
  expect(screen.getByText('Error: migration v4 failed')).toBeTruthy();
  expect(screen.getByText('Close app')).toBeTruthy();
});
