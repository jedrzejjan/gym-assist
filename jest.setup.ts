// expo-crypto is native; tests use Node's implementation of the same function.
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}));

// expo-file-system is native. Only data/files.ts imports it, and tests that need a folder mock
// data/files with an in-memory one (data/testing/fakeFolder.ts). This stub keeps the import
// (e.g. through app/_layout.tsx) from loading native code, and fails loudly if it is used.
jest.mock('expo-file-system', () => {
  const unavailable = () => {
    throw new Error('expo-file-system is not available in tests: mock data/files instead');
  };
  class Directory {
    static pickDirectoryAsync = unavailable;
    constructor() {
      unavailable();
    }
  }
  class File {
    constructor() {
      unavailable();
    }
  }
  return { Directory, File };
});
