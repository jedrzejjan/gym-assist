import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { deleteSession, sessionSummary } from '../../../data/history';
import { mutate, useDb, useLive } from '../../../data/live';
import { formatDayMonthYear } from '../../../domain/dates';
import { countsText } from '../../../domain/history';
import { formatSet } from '../../../domain/sets';
import { AppBar } from '../../../ui/AppBar';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/Dialog';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { colors, fonts, sizes } from '../../../ui/theme';

/**
 * Board `history/session`: a finished session, read-only, with "Delete session". The board's
 * "Edit" button and its hint arrive with GYM-102 (Edit a finished session).
 */
export default function SessionSummary() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const summary = useLive((d) => sessionSummary(d, id), [id]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleting = useRef(false); // a double tap must not delete or go back twice
  if (!summary) return null; // e.g. just deleted, while going back

  const date = formatDayMonthYear(summary.date);
  const setCount = summary.exercises.reduce((n, e) => n + e.sets.length, 0);

  const remove = () => {
    if (deleting.current) return;
    deleting.current = true;
    setConfirmDelete(false);
    mutate(db, (tx) => deleteSession(tx, id));
    router.back();
  };

  return (
    <Screen
      header={<AppBar title={date} back={{ label: '‹ History', onPress: () => router.back() }} />}
      footer={
        <Button label="Delete session" variant="secondary" onPress={() => setConfirmDelete(true)} />
      }
    >
      <View style={styles.list}>
        {summary.exercises.map((e, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.name}>{e.nameEn}</Text>
            {e.namePl ? <Text variant="small">{e.namePl}</Text> : null}
            <Text style={styles.sets}>
              {e.sets.length > 0
                ? e.sets.map((s) => formatSet(s, e.usesBodyweight)).join(' · ')
                : '-'}
            </Text>
          </View>
        ))}
      </View>
      <Dialog
        visible={confirmDelete}
        title="Delete this session? This cannot be undone."
        message={`${date} · ${countsText(summary.exercises.length, setCount)}`}
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: sizes.gutter, gap: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: sizes.tileRadius,
    padding: sizes.gutter,
    gap: 2,
  },
  name: { fontFamily: fonts.semibold, fontSize: sizes.body, color: colors.navy },
  sets: { marginTop: 8, color: colors.slate },
});
