/**
 * @jest-environment node
 */
import { prepareDatabase, type PrepareDeps } from '../db/prepare';

function fakeDeps(opts: {
  applied: number;
  target: number;
  snapshots?: string[];
  migrateError?: Error;
}): { deps: PrepareDeps; calls: string[]; snapshots: string[] } {
  const calls: string[] = [];
  const snapshots = [...(opts.snapshots ?? [])];
  const deps: PrepareDeps = {
    appliedVersion: () => opts.applied,
    targetVersion: () => opts.target,
    snapshotTo: (name) => {
      calls.push(`snapshot ${name}`);
      snapshots.push(name);
    },
    listSnapshots: () => [...snapshots],
    deleteSnapshot: (name) => {
      calls.push(`delete ${name}`);
      snapshots.splice(snapshots.indexOf(name), 1);
    },
    restoreFrom: (name) => {
      calls.push(`restore ${name}`);
    },
    migrate: async () => {
      calls.push('migrate');
      if (opts.migrateError) throw opts.migrateError;
    },
  };
  return { deps, calls, snapshots };
}

test('applied equals target: no snapshot, no migrate', async () => {
  const { deps, calls } = fakeDeps({ applied: 2, target: 2 });
  await expect(prepareDatabase(deps)).resolves.toEqual({ ok: true });
  expect(calls).toEqual([]);
});

test('fresh install (applied 0): migrates without a snapshot', async () => {
  const { deps, calls } = fakeDeps({ applied: 0, target: 1 });
  await expect(prepareDatabase(deps)).resolves.toEqual({ ok: true });
  expect(calls).toEqual(['migrate']);
});

test('applied 1, target 2: snapshots pre-migration-v2.db, then migrates', async () => {
  const { deps, calls } = fakeDeps({ applied: 1, target: 2 });
  await expect(prepareDatabase(deps)).resolves.toEqual({ ok: true });
  expect(calls).toEqual(['snapshot pre-migration-v2.db', 'migrate']);
});

test('keeps only the last 3 snapshots', async () => {
  const { deps, snapshots } = fakeDeps({
    applied: 10,
    target: 11,
    snapshots: ['pre-migration-v10.db', 'pre-migration-v9.db', 'pre-migration-v8.db'],
  });
  await prepareDatabase(deps);
  // Numeric order: v8 is the oldest, even though "v10" sorts first as text.
  expect([...snapshots].sort()).toEqual(
    ['pre-migration-v10.db', 'pre-migration-v11.db', 'pre-migration-v9.db'].sort(),
  );
});

test('keeps v1–v3, then deletes v1 when v4 is taken', async () => {
  const { deps, calls } = fakeDeps({
    applied: 3,
    target: 4,
    snapshots: ['pre-migration-v1.db', 'pre-migration-v2.db', 'pre-migration-v3.db'],
  });
  await prepareDatabase(deps);
  expect(calls).toContain('delete pre-migration-v1.db');
  expect(calls).not.toContain('delete pre-migration-v2.db');
});

test('a rejected migrate restores the snapshot and resolves ok:false with the message', async () => {
  const { deps, calls } = fakeDeps({
    applied: 3,
    target: 4,
    migrateError: new Error('migration v4 failed'),
  });
  await expect(prepareDatabase(deps)).resolves.toEqual({
    ok: false,
    error: 'migration v4 failed',
  });
  expect(calls).toEqual(['snapshot pre-migration-v4.db', 'migrate', 'restore pre-migration-v4.db']);
});

test('fresh install: a rejected migrate resolves ok:false and does not call restoreFrom', async () => {
  const { deps, calls } = fakeDeps({ applied: 0, target: 1, migrateError: new Error('boom') });
  await expect(prepareDatabase(deps)).resolves.toEqual({ ok: false, error: 'boom' });
  expect(calls).toEqual(['migrate']);
});
