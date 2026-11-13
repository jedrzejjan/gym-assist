// The backup folder on the phone (GYM-26, Sprint 2 plan decision 7). The only file in the app
// that imports expo-file-system; tests replace it with data/testing/fakeFolder.ts.
import { Directory, File } from 'expo-file-system';

/** A folder the app can write backups into. */
export interface BackupFolder {
  name: string;
  list(): Promise<string[]>;
  /** Replaces a file with the same name: it is deleted, then created again. */
  write(name: string, text: string): Promise<void>;
  read(name: string): Promise<string>;
  remove(name: string): Promise<void>;
}

/**
 * Android's folder picker. It keeps a persistable permission, so the folder still works after
 * a restart (checked on the phone in Task 10). null when the trainer cancels.
 */
export async function pickFolder(): Promise<{ uri: string; name: string } | null> {
  try {
    const dir = await Directory.pickDirectoryAsync();
    return dir ? { uri: dir.uri, name: dir.name } : null;
  } catch {
    return null; // cancelled
  }
}

export function openFolder(uri: string): BackupFolder {
  const dir = new Directory(uri);
  const find = (name: string) =>
    dir.list().find((f): f is File => f instanceof File && f.name === name) ?? null;
  return {
    name: dir.name,
    async list() {
      return dir
        .list()
        .filter((f): f is File => f instanceof File)
        .map((f) => f.name);
    },
    async write(name, text) {
      // Android's document providers don't always truncate a file opened for writing, so a
      // shorter backup could keep old bytes at the end. Delete, then create (decision 7).
      find(name)?.delete();
      await dir.createFile(name, 'application/json').write(text);
    },
    async read(name) {
      const file = find(name);
      if (!file) throw new Error(`${name} is not in the backup folder`);
      return file.text();
    },
    async remove(name) {
      find(name)?.delete();
    },
  };
}
