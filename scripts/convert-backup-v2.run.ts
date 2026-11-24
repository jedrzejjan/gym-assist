// Runs the one-time converter (GYM-145) on a real backup file. Not a test: Jest only runs it when
// asked, because Jest already compiles TypeScript and stands in for the native modules.
//
//   $env:BACKUP_IN = 'local-data\gym-assist-backup-2026-11-24.json'
//   npx jest --testMatch "**/scripts/convert-backup-v2.run.ts"
//
// It writes gym-assist-converted-v2.json next to the input (a name the app's backup pruning
// never matches), checks it with readBackup and a trial restoreAll, and prints the report.
// The owner's backup is personal data: keep both files in local-data/, never commit them.
import fs from 'node:fs';
import path from 'node:path';

import { BACKUP_TABLES, SCHEMA_VERSION } from '../data/backup';
import { restoreAll } from '../data/restore';
import { createTestDb } from '../data/testing/testDb';
import { readBackup } from '../domain/backup';
import { convertBackupV2 } from './convertBackupV2';

const input = process.env.BACKUP_IN;

(input ? test : test.skip)('convert the backup in BACKUP_IN', () => {
  const output = path.join(path.dirname(input!), 'gym-assist-converted-v2.json');
  const { file, report } = convertBackupV2(fs.readFileSync(input!, 'utf8'));
  const text = JSON.stringify(file);

  const check = readBackup(
    text,
    SCHEMA_VERSION,
    BACKUP_TABLES.map((t) => t.name),
  );
  if (!check.ok) throw new Error(`The converted file is refused: ${check.message}`);
  const restored = restoreAll(createTestDb(), check.file);

  fs.writeFileSync(output, text);
  console.log(JSON.stringify({ output, ...report, trialRestore: restored }, null, 2));
});
