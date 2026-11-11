import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { countClients } from '../data/clients';
import { countExercises } from '../data/exercises';
import { useLive } from '../data/live';
import { getSetting, WELCOME_DONE } from '../data/settings';
import { AppBar } from '../ui/AppBar';
import { Screen } from '../ui/Screen';
import { Tile } from '../ui/Tile';
import { sizes } from '../ui/theme';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Home (board `home`): Clients, Settings, Exercise library, in that order (spec section 5). */
export default function Home() {
  const home = useLive(
    (db) => ({
      welcomeDone: getSetting(db, WELCOME_DONE) === '1',
      clients: countClients(db),
      exercises: countExercises(db),
    }),
    [],
  );

  // Welcome shows until the trainer has made a choice.
  if (!home.welcomeDone) return <Redirect href="/welcome" />;

  return (
    <Screen header={<AppBar title="Gym Assist" />}>
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
          {/* The library screens arrive with GYM-17. */}
          <Tile
            title="Exercise library"
            subtitle={plural(home.exercises, 'exercise', 'exercises')}
            disabled
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { padding: sizes.gutter, gap: sizes.gutter },
  row: { flexDirection: 'row', gap: 8 },
});
