import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { mutate, useDb, useLive } from '../../../data/live';
import {
  discardSession,
  finishSession,
  getSession,
  listSessionExercises,
  type SessionExerciseItem,
  updateSessionDate,
} from '../../../data/sessions';
import { formatDayMonth, formatDayMonthYear, todayLocal } from '../../../domain/dates';
import { AppBar } from '../../../ui/AppBar';
import { Button } from '../../../ui/Button';
import { DateField } from '../../../ui/DateField';
import { Dialog } from '../../../ui/Dialog';
import { ListRow } from '../../../ui/ListRow';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { sizes } from '../../../ui/theme';

const setsText = (n: number) => (n === 1 ? '1 set' : `${n} sets`);

// In a finished session the ✓ and "finished" marks are left out (Sprint 2 plan, decision 4).
function subtitle(e: SessionExerciseItem, editing: boolean): string {
  const parts = [e.namePl, setsText(e.setCount), e.finishedAt && !editing ? 'finished' : null];
  return parts.filter(Boolean).join(' · ');
}

/**
 * Boards `log/session - empty` and `log/session - with exercises` (spec section 4, step 6):
 * the session's exercises, ways to add one, Reorder, "Finish session" and "Cancel session".
 * A finished session opens here from its summary in edit mode, board `history/session - editing`
 * (decision 4): "Edit session" with the date, no Finish or Cancel, and "Done".
 */
export default function SessionPage() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useLive((d) => getSession(d, id), [id]);
  const items = useLive((d) => listSessionExercises(d, id), [id]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const leaving = useRef(false); // a double tap must not finish or discard twice
  if (!session) return null; // e.g. just discarded, while going back

  const empty = items.length === 0;
  const editing = session.status === 'finished';

  const leave = (write: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    try {
      write();
    } catch (e) {
      leaving.current = false;
      throw e;
    }
    router.back();
  };

  const finish = () => leave(() => mutate(db, (tx) => finishSession(tx, id)));
  const discard = () => {
    setConfirmDiscard(false);
    leave(() => mutate(db, (tx) => discardSession(tx, id)));
  };

  const changeDate = (date: string) =>
    mutate(db, (tx) => updateSessionDate(tx, id, date, todayLocal(new Date())));

  return (
    <Screen
      header={
        editing ? (
          <AppBar
            title="Edit session"
            back={{ label: '‹ Summary', onPress: () => router.back() }}
          />
        ) : (
          <AppBar
            title={`${session.clientName} · ${formatDayMonth(session.date)}`}
            back={{ label: '‹ Back', onPress: () => router.back() }}
          />
        )
      }
      footer={
        editing ? (
          <Button label="Done" onPress={() => router.back()} />
        ) : (
          <>
            <Button label="Finish session" onPress={finish} disabled={empty} />
            <Button
              label="Cancel session"
              variant="secondary"
              onPress={() => setConfirmDiscard(true)}
            />
          </>
        )
      }
    >
      {editing ? (
        <View style={styles.date}>
          <DateField
            label="Date"
            value={session.date}
            display={formatDayMonthYear(session.date)}
            onChange={changeDate}
            toIsoDate={todayLocal}
          />
        </View>
      ) : null}
      <View testID="session-exercises">
        {items.map((e, i) => (
          <ListRow
            key={e.id}
            title={`${i + 1}  ${e.nameEn}${e.finishedAt && !editing ? '  ✓' : ''}`}
            subtitle={subtitle(e, editing)}
            accessibilityLabel={`${i + 1}, ${e.nameEn}, ${subtitle(e, editing)}`}
            onPress={() => router.push(`/session/${id}/exercise/${e.id}`)}
          />
        ))}
      </View>
      <View style={styles.choose}>
        {editing ? null : (
          <Text variant="small">
            {empty ? 'No exercises yet. Add the first one:' : 'Tap an exercise to open it again.'}
          </Text>
        )}
        <Button
          label={empty ? 'By pattern' : '+ By pattern'}
          variant="secondary"
          onPress={() => router.push(`/session/${id}/patterns`)}
        />
        <Button
          label={empty ? 'Full list' : '+ Full list'}
          variant="secondary"
          onPress={() => router.push(`/session/${id}/search`)}
        />
        <Button
          label={empty ? 'New exercise' : '+ New exercise'}
          variant="secondary"
          onPress={() => router.push(`/library/add?returnTo=session&sessionId=${id}`)}
        />
        {/* In edit mode Reorder stays with one exercise: removing it offers to delete the session. */}
        {items.length > 1 || (editing && !empty) ? (
          <Button
            label="Reorder"
            variant="secondary"
            onPress={() => router.push(`/session/${id}/reorder`)}
          />
        ) : null}
        {editing ? (
          <Text variant="small">Changes are saved at once. The session stays finished.</Text>
        ) : null}
      </View>
      <Dialog
        visible={confirmDiscard}
        title="Discard this session?"
        message="All exercises and sets in this session will be deleted."
        confirmLabel="Discard"
        onConfirm={discard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  choose: { padding: sizes.gutter, gap: 12 },
  date: { padding: sizes.gutter },
});
