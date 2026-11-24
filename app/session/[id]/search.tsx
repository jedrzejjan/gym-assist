import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { listExercises } from '../../../data/exercises';
import { mutate, useDb, useLive } from '../../../data/live';
import { addExerciseToSession, sessionWriteOptions } from '../../../data/sessions';
import { chooseRowText } from '../../../domain/catalogue';
import { AppBar } from '../../../ui/AppBar';
import { ListRow } from '../../../ui/ListRow';
import { Screen } from '../../../ui/Screen';
import { SearchField } from '../../../ui/SearchField';
import { Text } from '../../../ui/Text';
import { sizes } from '../../../ui/theme';

/**
 * Boards `log / choose - search` and `- search no results` (GYM-149): English and Polish names and
 * other names (aliases, with an "also: …" note), best match first, then the most common.
 */
export default function SearchExercises() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [search, setSearch] = useState('');
  const exercises = useLive((d) => listExercises(d, { search }), [search]);
  const searching = search.trim() !== '';
  const choosing = useRef(false); // a double tap must not add the exercise twice

  const choose = (exerciseId: string) => {
    if (choosing.current) return;
    choosing.current = true;
    let seId: string;
    try {
      seId = mutate(
        db,
        (tx) => addExerciseToSession(tx, id, exerciseId),
        sessionWriteOptions(db, id),
      );
    } catch (e) {
      choosing.current = false; // let the trainer try again
      throw e;
    }
    // Leave the choose pages behind: back from the exercise returns to the session page.
    router.dismissTo(`/session/${id}`);
    router.push(`/session/${id}/exercise/${seId}`);
  };

  return (
    <Screen
      scroll={false}
      header={
        <AppBar title="All exercises" back={{ label: '‹ Session', onPress: () => router.back() }} />
      }
    >
      <View style={styles.controls}>
        <SearchField label="Search exercises" value={search} onChangeText={setSearch} />
        {searching && exercises.length > 0 ? (
          <Text variant="small" accessibilityLiveRegion="polite">
            {exercises.length === 1 ? '1 result' : `${exercises.length} results`}
          </Text>
        ) : null}
      </View>
      <FlatList
        data={exercises}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        renderItem={({ item: e }) => (
          <ListRow title={e.nameEn} subtitle={chooseRowText(e)} onPress={() => choose(e.id)} />
        )}
        ListEmptyComponent={
          searching ? (
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
  controls: { padding: sizes.gutter, gap: 8 },
  empty: { padding: sizes.gutter, gap: 8 },
});
