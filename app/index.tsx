import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { backupStatus } from '../data/autoExport';
import { countClients } from '../data/clients';
import { countExercises } from '../data/exercises';
import { useDb, useLive } from '../data/live';
import { getDraft, resumePoint } from '../data/sessions';
import { getSetting, WELCOME_DONE } from '../data/settings';
import { AppBar } from '../ui/AppBar';
import { Banner } from '../ui/Banner';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { Tile } from '../ui/Tile';
import { useTapGuard } from '../ui/useTapGuard';
import { colors, fonts, sizes } from '../ui/theme';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Home (boards `home`, `home - session in progress` and `home - backup warning`): Clients,
 * Settings, Exercise library, in that order (spec section 5). A warning under the app bar says
 * when backups are off or the last one failed. While a draft exists, a bar at the bottom
 * resumes it (section 4).
 * Opening the app shows Home; it never jumps into the draft by itself.
 */
export default function Home() {
  const db = useDb();
  const guard = useTapGuard();
  const home = useLive(
    (db) => ({
      welcomeDone: getSetting(db, WELCOME_DONE) === '1',
      clients: countClients(db),
      exercises: countExercises(db),
      draft: getDraft(db),
      backup: backupStatus(db),
    }),
    [],
  );

  // Welcome shows until the trainer has made a choice.
  if (!home.welcomeDone) return <Redirect href="/welcome" />;

  // The open exercise if there is one, otherwise the session page; back returns to the page.
  const resume = (sessionId: string) => {
    const point = resumePoint(db, sessionId);
    router.push(`/session/${sessionId}`);
    if (point.screen === 'exercise') router.push(`/session/${sessionId}/exercise/${point.seId}`);
  };
  const draft = home.draft;
  // Board `home - backup warning` (spec section 5, Backup plan; decision 10: on Home).
  const warning =
    home.backup.folderName === null
      ? 'Backups are off: choose a folder'
      : home.backup.lastError !== null
        ? 'Last backup failed: check the folder'
        : null;

  return (
    <Screen
      header={
        <>
          <AppBar title="Gym Assist" />
          {warning ? (
            <Banner
              message={warning}
              actionLabel="FIX"
              actionAccessibilityLabel="Fix backups"
              onAction={() => router.push('/settings')}
            />
          ) : null}
        </>
      }
      footer={
        draft ? (
          <DraftBar
            clientName={draft.clientName}
            onPress={() => guard(() => resume(draft.sessionId))}
          />
        ) : undefined
      }
    >
      <View style={styles.grid}>
        <Tile
          wide
          title="Clients"
          subtitle={plural(home.clients, 'client', 'clients')}
          onPress={() => router.push('/clients')}
        />
        <View style={styles.row}>
          <Tile
            title="Settings"
            subtitle="Backup, import"
            onPress={() => router.push('/settings')}
          />
          <Tile
            title="Exercise library"
            subtitle={plural(home.exercises, 'exercise', 'exercises')}
            onPress={() => router.push('/library')}
          />
        </View>
      </View>
    </Screen>
  );
}

function DraftBar({ clientName, onPress }: { clientName: string; onPress: () => void }) {
  const text = `Session in progress: ${clientName}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text}, resume`}
      onPress={onPress}
      style={styles.bar}
    >
      <Text style={styles.barText}>{text}</Text>
      <Text style={styles.barAction}>RESUME</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: sizes.button,
    borderRadius: sizes.tileRadius,
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sizes.gutter,
    gap: 12,
  },
  barText: { flex: 1, color: colors.white, fontSize: sizes.small },
  barAction: { color: colors.white, fontFamily: fonts.semibold, fontSize: sizes.small },
  grid: { padding: sizes.gutter, gap: sizes.gutter },
  row: { flexDirection: 'row', gap: 8 },
});
