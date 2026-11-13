// Shared expo-router mock for screen tests. Use with:
//   jest.mock('expo-router', () => require('../routerMock').routerMock);
import { Text } from 'react-native';

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismissAll: jest.fn(),
  dismissTo: jest.fn(),
  canDismiss: jest.fn(() => false),
};
export const mockParams: { current: Record<string, string> } = { current: {} };

export const routerMock = {
  router: mockRouter,
  useLocalSearchParams: () => mockParams.current,
  Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
  Stack: () => null,
};

beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  mockRouter.dismissAll.mockClear();
  mockRouter.dismissTo.mockClear();
  mockParams.current = {};
});
