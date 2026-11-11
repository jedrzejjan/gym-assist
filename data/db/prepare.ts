// Start-up safety (spec section 5, "Pre-migration snapshot"): copy the database before
// migrating, keep the last 3 copies, and restore the copy if a migration fails.

export type PrepareDeps = {
  /** Migrations already applied (0 on a fresh install). */
  appliedVersion(): number;
  /** Migrations the app ships with. */
  targetVersion(): number;
  snapshotTo(name: string): void;
  listSnapshots(): string[];
  deleteSnapshot(name: string): void;
  restoreFrom(name: string): void;
  migrate(): Promise<void>;
};

export type PrepareResult = { ok: true } | { ok: false; error: string };

const KEEP_SNAPSHOTS = 3;
const SNAPSHOT_NAME = /^pre-migration-v(\d+)\.db$/;

export function snapshotName(version: number): string {
  return `pre-migration-v${version}.db`;
}

function pruneSnapshots(deps: PrepareDeps): void {
  const versions = deps
    .listSnapshots()
    .map((name) => ({ name, match: SNAPSHOT_NAME.exec(name) }))
    .filter((s): s is { name: string; match: RegExpExecArray } => s.match !== null)
    .map((s) => ({ name: s.name, version: Number(s.match[1]) }))
    .sort((a, b) => b.version - a.version); // newest first, by number not text
  for (const old of versions.slice(KEEP_SNAPSHOTS)) deps.deleteSnapshot(old.name);
}

export async function prepareDatabase(deps: PrepareDeps): Promise<PrepareResult> {
  const applied = deps.appliedVersion();
  const target = deps.targetVersion();
  if (applied >= target) return { ok: true };

  // A fresh install has no data to protect, so there is nothing to snapshot.
  const snapshot = applied > 0 ? snapshotName(target) : null;
  if (snapshot) {
    deps.snapshotTo(snapshot);
    pruneSnapshots(deps);
  }

  try {
    await deps.migrate();
    return { ok: true };
  } catch (e) {
    if (snapshot) deps.restoreFrom(snapshot);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
