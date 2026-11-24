import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { listExercises } from '../../data/exercises';
import { useLive } from '../../data/live';
import { libraryRowText, type Pattern, patternName, PATTERNS } from '../../domain/catalogue';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { ListRow } from '../../ui/ListRow';
import { Screen } from '../../ui/Screen';
import { SearchField } from '../../ui/SearchField';
import { Text } from '../../ui/Text';
import { sizes } from '../../ui/theme';

type Filter = Pattern | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...PATTERNS.map((p) => ({ value: p as Filter, label: patternName(p) })),
];

/**
 * Board `library / list` (GYM-149): All plus the 5 patterns, a search over English and Polish
 * names and aliases, the most common exercises first. 831 rows, so a virtualized list: only the
 * rows on screen are rendered.
 */
export default function Library() {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const exercises = useLive(
    (db) => listExercises(db, { pattern: filter === 'all' ? undefined : filter, search }),
    [filter, search],
  );

  return (
    <Screen
      scroll={false}
      header={
        <AppBar title="Exercise library" back={{ label: '‹ Home', onPress: () => router.back() }} />
      }
      footer={<Button label="+ Add exercise" onPress={() => router.push('/library/add')} />}
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
      <FlatList
        data={exercises}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        renderItem={({ item: e }) => (
          <ListRow
            title={e.nameEn}
            subtitle={libraryRowText(e)}
            onPress={() => router.push(`/library/${e.id}`)}
          />
        )}
        ListEmptyComponent={
          search.trim() !== '' ? (
            <View style={styles.empty}>
              <Text>{`No exercises match "${search.trim()}".`}</Text>
              <Text variant="small">
                Check the spelling, or try another name, in English or Polish.
              </Text>
            </View>
          ) : undefined
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { padding: sizes.gutter, gap: 12 },
  empty: { padding: sizes.gutter, gap: 8 },
});
