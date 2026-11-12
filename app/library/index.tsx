import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listExercises } from '../../data/exercises';
import { useLive } from '../../data/live';
import { displayName, exerciseSubtitle, type Pattern, PATTERNS } from '../../domain/catalogue';
import { AppBar } from '../../ui/AppBar';
import { Chips } from '../../ui/Chips';
import { ListRow } from '../../ui/ListRow';
import { Screen } from '../../ui/Screen';
import { SearchField } from '../../ui/SearchField';
import { Text } from '../../ui/Text';
import { sizes } from '../../ui/theme';

type Filter = Pattern | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...PATTERNS.map((p) => ({ value: p as Filter, label: displayName(p) })),
];

/** Board `library/list`: browse by pattern, or search English and Polish names (spec section 5). */
export default function Library() {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const exercises = useLive(
    (db) => listExercises(db, { pattern: filter === 'all' ? undefined : filter, search }),
    [filter, search],
  );

  return (
    <Screen
      header={
        <AppBar title="Exercise library" back={{ label: '‹ Home', onPress: () => router.back() }} />
      }
    >
      <View style={styles.controls}>
        <SearchField label="Search exercises" value={search} onChangeText={setSearch} />
        <Chips
          options={FILTERS}
          value={filter}
          onChange={(v) => setFilter(v ?? 'all')}
          clearable={false}
          scroll
        />
      </View>
      {exercises.map((e) => (
        <ListRow
          key={e.id}
          title={e.nameEn}
          subtitle={exerciseSubtitle(e)}
          onPress={() => router.push(`/library/${e.id}`)}
        />
      ))}
      {exercises.length === 0 && search.trim() !== '' ? (
        <View style={styles.empty}>
          <Text>{`No exercises match "${search.trim()}".`}</Text>
          <Text variant="small">Check the spelling, or search in English or Polish.</Text>
        </View>
      ) : null}
      {exercises.length === 0 && search.trim() === '' && filter !== 'all' ? (
        <View style={styles.empty}>
          <Text variant="small">No exercises for this pattern yet.</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { padding: sizes.gutter, gap: 12 },
  empty: { padding: sizes.gutter, gap: 8 },
});
