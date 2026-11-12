import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useLive } from '../../../data/live';
import { getSession, listSessionExercises } from '../../../data/sessions';
import { formatDayMonth } from '../../../domain/dates';
import { AppBar } from '../../../ui/AppBar';
import { Button } from '../../../ui/Button';
import { ListRow } from '../../../ui/ListRow';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { sizes } from '../../../ui/theme';

/**
 * Board `log/session - empty` (spec section 4, step 3): the session page, where the trainer
 * chooses exercises. Finish, cancel, reorder and remove arrive with GYM-21.
 */
export default function SessionPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useLive((db) => getSession(db, id), [id]);
  const items = useLive((db) => listSessionExercises(db, id), [id]);
  if (!session) return null;

  return (
    <Screen
      header={
        <AppBar
          title={`${session.clientName} · ${formatDayMonth(session.date)}`}
          back={{ label: '‹ Back', onPress: () => router.back() }}
        />
      }
    >
      {items.map((e) => (
        <ListRow
          key={e.id}
          title={e.nameEn}
          subtitle={e.namePl ?? undefined}
          onPress={() => router.push(`/session/${id}/exercise/${e.id}`)}
        />
      ))}
      <View style={styles.choose}>
        <Text variant="small">
          {items.length === 0 ? 'No exercises yet. Add the first one:' : 'Add an exercise:'}
        </Text>
        <Button
          label="By pattern"
          variant="secondary"
          onPress={() => router.push(`/session/${id}/patterns`)}
        />
        <Button
          label="Full list"
          variant="secondary"
          onPress={() => router.push(`/session/${id}/search`)}
        />
        <Button
          label="New exercise"
          variant="secondary"
          onPress={() => router.push(`/library/add?returnTo=session&sessionId=${id}`)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  choose: { padding: sizes.gutter, gap: 12 },
});
