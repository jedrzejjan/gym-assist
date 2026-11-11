// Live data without a state library (spec section 5): screens read with useLive, and every
// write goes through mutate, which re-runs those reads. It works the same on the phone and in Jest.
import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import type { Db, Tx } from './types';

let version = 0;
const listeners = new Set<() => void>();

export function subscribeToDataChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getVersion = () => version;

/** Tell every useLive reader that data changed. mutate calls this after each write. */
export function notifyDataChanged(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/**
 * Run one user action's writes in a single transaction, then refresh the screens.
 * Call it once per action; repository functions take the `tx` and never call mutate themselves.
 */
export function mutate<T>(db: Db, write: (tx: Tx) => T): T {
  const result = db.transaction((tx) => {
    const value = write(tx);
    if (value instanceof Promise) {
      // Drizzle's synchronous transaction would commit before the awaited writes run.
      throw new Error('mutate needs a synchronous write');
    }
    return value;
  });
  notifyDataChanged();
  return result;
}

const DbContext = createContext<Db | null>(null);

export function DbProvider({ db, children }: { db: Db; children: ReactNode }) {
  return createElement(DbContext.Provider, { value: db }, children);
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb must be used inside DbProvider');
  return db;
}

/**
 * Read from the database and re-read after every write. The store's snapshot is the version
 * number, not the query result: a fresh result object on each call would re-render forever.
 */
export function useLive<T>(read: (db: Db) => T, deps: unknown[]): T {
  const db = useDb();
  const current = useSyncExternalStore(subscribeToDataChanges, getVersion, getVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's query inputs
  return useMemo(() => read(db), [db, current, ...deps]);
}
