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
} from '../../../data/sessions';
import { formatDayMonth } from '../../../domain/dates';
import { AppBar } from '../../../ui/AppBar';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/Dialog';
import { ListRow } from '../../../ui/ListRow';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { sizes } from '../../../ui/theme';

const setsText = (n: number) => (n === 1 ? '1 set' : `${n} sets`);

function subtitle(e: SessionExerciseItem): string {
  const parts = [e.namePl, setsText(e.setCount), e.finishedAt ? 'finished' : null];
  return parts.filter(Boolean).join(' · ');
}

/**
 * Boards `log/session - empty` and `log/session - with exercises` (spec section 4, step 6):
 * the session's exercises, ways to add one, Reorder, "Finish session" and "Cancel session".
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

  return (
    <Screen
      header={
        <AppBar
          title={`${session.clientName} · ${formatDayMonth(session.date)}`}
          back={{ label: '‹ Back', onPress: () => router.back() }}
        />
      }
      footer={
        <>
          <Button label="Finish session" onPress={finish} disabled={empty} />
          <Button
            label="Cancel session"
            variant="secondary"
            onPress={() => setConfirmDiscard(true)}
          />
        </>
      }
    >
      <View testID="session-exercises">
        {items.map((e, i) => (
          <ListRow
            key={e.id}
            title={`${i + 1}  ${e.nameEn}${e.finishedAt ? '  ✓' : ''}`}
            subtitle={subtitle(e)}
            onPress={() => router.push(`/session/${id}/exercise/${e.id}`)}
          />
        ))}
      </View>
      <View style={styles.choose}>
        <Text variant="small">
          {empty ? 'No exercises yet. Add the first one:' : 'Tap an exercise to open it again.'}
        </Text>
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
        {items.length > 1 ? (
          <Button
            label="Reorder"
            variant="secondary"
            onPress={() => router.push(`/session/${id}/reorder`)}
          />
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
});
