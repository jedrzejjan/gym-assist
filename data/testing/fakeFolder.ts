import type { BackupFolder } from '../files';

export type FakeFolder = BackupFolder & {
  /** The files in the folder, by name. */
  files: Map<string, string>;
  /** Make the next writes fail, as a folder whose permission was revoked would. */
  failWrites: boolean;
  writes: number;
};

/** An in-memory backup folder for tests: data/files.ts is the only code that touches the disk. */
export function createFakeFolder(name = 'Gym Assist', initial: Record<string, string> = {}) {
  const folder: FakeFolder = {
    name,
    files: new Map(Object.entries(initial)),
    failWrites: false,
    writes: 0,
    async list() {
      return [...folder.files.keys()];
    },
    async write(file, text) {
      if (folder.failWrites) throw new Error('Permission denied');
      // As on the phone: delete, then create, so no old bytes survive a shorter write.
      folder.files.delete(file);
      folder.files.set(file, text);
      folder.writes += 1;
    },
    async read(file) {
      const text = folder.files.get(file);
      if (text === undefined) throw new Error(`No file ${file}`);
      return text;
    },
    async remove(file) {
      folder.files.delete(file);
    },
  };
  return folder;
}
