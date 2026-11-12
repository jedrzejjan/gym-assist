import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLive } from '../../../../data/live';
import { listWeights } from '../../../../data/measurements';
import { formatDayMonthYear } from '../../../../domain/dates';
import { AppBar } from '../../../../ui/AppBar';
import { Button } from '../../../../ui/Button';
import { ListRow } from '../../../../ui/ListRow';
import { Screen } from '../../../../ui/Screen';
import { Text } from '../../../../ui/Text';
import { colors, fonts, sizes } from '../../../../ui/theme';

/** Board `weight/history`: the latest weight on top, then earlier entries; tap one to edit it. */
export default function WeightHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const weights = useLive((db) => listWeights(db, id), [id]);
  const [latest, ...earlier] = weights;
  const edit = (mid: string) => router.push(`/clients/${id}/weight/${mid}`);

  return (
    <Screen
      header={
        <AppBar title="Body weight" back={{ label: '‹ Profile', onPress: () => router.back() }} />
      }
      footer={
        <Button label="Add weight" onPress={() => router.push(`/clients/${id}/weight/add`)} />
      }
    >
      {latest ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Latest, ${latest.valueKg} kg, ${formatDayMonthYear(latest.date)}`}
          onPress={() => edit(latest.id)}
          style={styles.latest}
        >
          <Text variant="label">Latest</Text>
          <Text style={styles.latestKg}>{`${latest.valueKg} kg`}</Text>
          <Text variant="small">{formatDayMonthYear(latest.date)}</Text>
        </Pressable>
      ) : null}
      <Text variant="label" style={styles.heading}>
        Earlier entries · tap to edit
      </Text>
      {earlier.length === 0 ? (
        <Text variant="small" style={styles.heading}>
          No earlier entries.
        </Text>
      ) : (
        <View>
          {earlier.map((w) => (
            <ListRow
              key={w.id}
              title={`${w.valueKg} kg`}
              subtitle={formatDayMonthYear(w.date)}
              onPress={() => edit(w.id)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  latest: {
    margin: sizes.gutter,
    padding: sizes.gutter,
    backgroundColor: colors.white,
    borderRadius: sizes.tileRadius,
    gap: 2,
  },
  latestKg: { fontFamily: fonts.semibold, fontSize: 28, color: colors.navy },
  heading: { paddingHorizontal: sizes.gutter, paddingBottom: 8 },
});
