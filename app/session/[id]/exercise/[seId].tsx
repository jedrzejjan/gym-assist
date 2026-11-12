import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useLive } from '../../../../data/live';
import { getSession, getSessionExercise, lastTimeSets } from '../../../../data/sessions';
import { formatLastTime } from '../../../../domain/sets';
import { AppBar } from '../../../../ui/AppBar';
import { Screen } from '../../../../ui/Screen';
import { Text } from '../../../../ui/Text';
import { colors, fonts, sizes } from '../../../../ui/theme';

/**
 * Boards `log/exercise - first time` and `- last time` (spec section 4, step 3): the names and
 * what this client did last time. Adding sets arrives with GYM-20.
 */
export default function SessionExercise() {
  const { id, seId } = useLocalSearchParams<{ id: string; seId: string }>();
  const session = useLive((db) => getSession(db, id), [id]);
  const item = useLive((db) => getSessionExercise(db, seId), [seId]);
  const last = useLive(
    (db) => (session && item ? lastTimeSets(db, session.clientId, item.exerciseId) : null),
    [session?.clientId, item?.exerciseId],
  );
  if (!session || !item) return null;

  return (
    <Screen
      header={
        <AppBar title="Exercise" back={{ label: '‹ Session', onPress: () => router.back() }} />
      }
    >
      <View style={styles.head}>
        <Text style={styles.name}>{item.nameEn}</Text>
        {item.namePl ? <Text variant="small">{item.namePl}</Text> : null}
        <Text style={styles.last}>{formatLastTime(last, item.usesBodyweight)}</Text>
      </View>
      <Text variant="small" style={styles.empty}>
        No sets yet.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { padding: sizes.gutter, gap: 4 },
  name: { fontFamily: fonts.semibold, fontSize: sizes.title, color: colors.navy },
  last: {
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    color: colors.slate,
    fontSize: sizes.small,
  },
  empty: { paddingHorizontal: sizes.gutter },
});
