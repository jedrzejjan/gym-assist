// expo-crypto is native; tests use Node's implementation of the same function.
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}));
