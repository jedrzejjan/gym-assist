import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { countClients } from '../data/clients';
import { countExercises } from '../data/exercises';
import { useDb, useLive } from '../data/live';
import { getDraft, resumePoint } from '../data/sessions';
import { getSetting, WELCOME_DONE } from '../data/settings';
import { AppBar } from '../ui/AppBar';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { Tile } from '../ui/Tile';
import { useTapGuard } from '../ui/useTapGuard';
import { colors, fonts, sizes } from '../ui/theme';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Home (boards `home` and `home - session in progress`): Clients, Settings, Exercise library, in
 * that order (spec section 5). While a draft exists, a bar at the bottom resumes it (section 4).
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

  return (
    <Screen
      header={<AppBar title="Gym Assist" />}
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
          {/* Settings arrives in Sprint 2 (GYM-25, GYM-26): dimmed until then (PR #21, decision 6). */}
          <Tile title="Settings" subtitle="Backup, import" disabled />
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
