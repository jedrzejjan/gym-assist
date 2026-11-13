import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getSelf } from '../../data/clients';
import { listExercises } from '../../data/exercises';
import { pickTextFile } from '../../data/files';
import { DatesTakenError, importHistory } from '../../data/import';
import { mutate, useDb, useLive } from '../../data/live';
import { fullName } from '../../domain/clients';
import { parseCsv } from '../../domain/csv';
import { formatDayMonthYear, todayLocal } from '../../domain/dates';
import { validateImport } from '../../domain/importRows';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { colors, fonts, sizes } from '../../ui/theme';

type State =
  | { kind: 'start' }
  | { kind: 'done'; count: number }
  | { kind: 'error'; message: string; unknownNames: string[]; hint: string };

const sessionsText = (n: number) => (n === 1 ? '1 session' : `${n} sessions`);

/**
 * Boards `settings/import - done` and `settings/import - error` (spec section 6, Import;
 * Sprint 2 plan decision 9): the old tool's sessions.csv goes into "Me", all or nothing.
 */
export default function ImportScreen() {
  const db = useDb();
  const me = useLive((d) => getSelf(d), []);
  const [state, setState] = useState<State>({ kind: 'start' });
  const busy = useRef(false); // a double tap must not open two pickers or import twice

  const meName = me ? fullName(me.firstName, me.lastName) : 'Me';

  const chooseFile = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const file = await pickTextFile();
      if (!file) return; // cancelled
      const names = new Set(listExercises(db, {}).map((e) => e.nameEn));
      const check = validateImport(parseCsv(file.text), names, todayLocal(new Date()));
      if (!check.ok) {
        setState({
          kind: 'error',
          message: check.message,
          unknownNames: check.unknownNames,
          hint:
            check.unknownNames.length > 0
              ? 'Fix the names in the CSV file and import again.'
              : 'Fix that row in the CSV file and import again.',
        });
        return;
      }
      try {
        // One mutate: all or nothing, and the automatic export follows (GYM-26).
        const { sessions } = mutate(db, (tx) => importHistory(tx, check.rows));
        setState({ kind: 'done', count: sessions });
      } catch (e) {
        if (!(e instanceof DatesTakenError)) throw e;
        setState({
          kind: 'error',
          message: `${meName} already has sessions on ${e.dates.map(formatDayMonthYear).join(', ')}.`,
          unknownNames: [],
          hint: 'Remove those dates from the CSV file, so no session is imported twice.',
        });
      }
    } finally {
      busy.current = false;
    }
  };

  const header = (
    <AppBar title="Import history" back={{ label: '‹ Settings', onPress: () => router.back() }} />
  );

  if (state.kind === 'done') {
    return (
      <Screen header={header} footer={<Button label="Done" onPress={() => router.back()} />}>
        <View style={styles.body}>
          <Text variant="title">Import complete</Text>
          <Text>{`${sessionsText(state.count)} imported into ${meName}.`}</Text>
          <Text variant="small">{`You can see them in ${meName} › History.`}</Text>
        </View>
      </Screen>
    );
  }

  if (state.kind === 'error') {
    return (
      <Screen header={header} footer={<Button label="Choose another file" onPress={chooseFile} />}>
        <View style={styles.body}>
          <Text variant="title">Nothing was imported</Text>
          <Text>{state.message}</Text>
          {state.unknownNames.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Unknown exercise names</Text>
              <Text>{state.unknownNames.map((n) => `• ${n}`).join('\n')}</Text>
            </View>
          ) : null}
          <Text variant="small">{state.hint}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={header} footer={<Button label="Choose file" onPress={chooseFile} />}>
      <View style={styles.body}>
        <Text>{`Choose sessions.csv from the old Gym Assist tool. Every session goes to ${meName}.`}</Text>
        <Text variant="small">
          Exercises must already be in the library. If any row has a problem, nothing is imported.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: sizes.gutter, gap: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: sizes.tileRadius,
    padding: sizes.gutter,
    gap: 8,
  },
  cardTitle: { fontFamily: fonts.semibold, color: colors.navy },
});
