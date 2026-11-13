import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { backupStatus, writeBackup } from '../../data/autoExport';
import { openFolder, pickFolder } from '../../data/files';
import { mutate, useDb, useLive } from '../../data/live';
import {
  BACKUP_FOLDER_NAME,
  BACKUP_FOLDER_URI,
  BACKUP_LAST_ERROR,
  deleteSetting,
  getSetting,
  setSetting,
} from '../../data/settings';
import type { Db } from '../../data/types';
import { backupFileName } from '../../domain/backup';
import { formatDayMonthYear, todayLocal } from '../../domain/dates';
import { AppBar } from '../../ui/AppBar';
import { ListRow } from '../../ui/ListRow';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { sizes } from '../../ui/theme';

const pad = (n: number) => String(n).padStart(2, '0');

/** "today 18:42", or "9 Nov 2026 18:42", in the phone's local time. */
function when(iso: string): string {
  const d = new Date(iso);
  const day = todayLocal(d);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return day === todayLocal(new Date()) ? `today ${time}` : `${formatDayMonthYear(day)} ${time}`;
}

/**
 * Asks for a folder and saves it. Choosing a folder writes no file (export: false). An old
 * failure belonged to the old folder, so it is cleared (PR #41 review).
 */
async function chooseFolder(db: Db): Promise<string | null> {
  const picked = await pickFolder();
  if (!picked) return null;
  mutate(
    db,
    (tx) => {
      setSetting(tx, BACKUP_FOLDER_URI, picked.uri);
      setSetting(tx, BACKUP_FOLDER_NAME, picked.name);
      deleteSetting(tx, BACKUP_LAST_ERROR);
    },
    { export: false },
  );
  return picked.uri;
}

/**
 * Board `settings/main` (spec section 5, Settings; Sprint 2 plan, decision 7): the backup
 * folder, "Export data (JSON)" into it, and the CSV import and restore, which arrive with
 * GYM-25 and GYM-103.
 */
export default function Settings() {
  const db = useDb();
  const status = useLive((d) => backupStatus(d), []);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false); // a double tap must not open two pickers or write twice

  const folderLine =
    status.folderName === null
      ? 'Not chosen · tap to choose'
      : status.lastError !== null
        ? 'Last backup failed: check the folder'
        : `${status.folderName} · ${status.lastAt ? when(status.lastAt) : 'no backup yet'}`;

  const run = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await action();
    } finally {
      busy.current = false;
    }
  };

  const changeFolder = () =>
    run(async () => {
      if (await chooseFolder(db)) setMessage(null);
    });

  // Writes today's file into the folder, asking for one first if none is chosen. No share
  // sheet: that would need a new library (decision 7).
  const exportNow = () =>
    run(async () => {
      const uri = getSetting(db, BACKUP_FOLDER_URI) ?? (await chooseFolder(db));
      if (!uri) return;
      const today = todayLocal(new Date());
      setMessage(null);
      try {
        await writeBackup(db, openFolder(uri), today);
        setMessage(`Saved ${backupFileName(today)}`);
      } catch (e) {
        setMessage(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    });

  return (
    <Screen
      header={<AppBar title="Settings" back={{ label: '‹ Home', onPress: () => router.back() }} />}
    >
      <ListRow
        title="Backup folder"
        subtitle={folderLine}
        accessibilityLabel={`Backup folder, ${folderLine}`}
        onPress={changeFolder}
      />
      <ListRow
        title="Export data (JSON)"
        subtitle="Save a full copy now"
        accessibilityLabel="Export data (JSON), save a full copy now"
        onPress={exportNow}
      />
      <ListRow
        title="Import history (CSV)"
        subtitle={'One-time import into "Me"'}
        accessibilityLabel={'Import history (CSV), one-time import into "Me"'}
        disabled
      />
      <ListRow
        title="Restore from backup"
        subtitle="Replaces all data in the app"
        accessibilityLabel="Restore from backup, replaces all data in the app"
        disabled
      />
      {message ? (
        <Text
          variant="small"
          style={styles.message}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {message}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: { padding: sizes.gutter },
});
