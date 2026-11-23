import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { listExercises } from '../../../../data/exercises';
import { mutate, useDb, useLive } from '../../../../data/live';
import { addExerciseToSession, sessionWriteOptions } from '../../../../data/sessions';
import {
  chooseRowText,
  type Pattern,
  patternName,
  SUBCATEGORIES,
  type Subcategory,
  subcategoryName,
} from '../../../../domain/catalogue';
import { AppBar } from '../../../../ui/AppBar';
import { Chips } from '../../../../ui/Chips';
import { ListRow } from '../../../../ui/ListRow';
import { Screen } from '../../../../ui/Screen';
import { SearchField } from '../../../../ui/SearchField';
import { Text } from '../../../../ui/Text';
import { sizes } from '../../../../ui/theme';

type Chip = Subcategory | 'other';

/**
 * Board `log / choose - pattern exercises` (GYM-149): the pattern's exercises, one subcategory at
 * a time (chips; the first is selected, "Other" holds those without one; Knee and Hip dominant
 * have none), the most common first. The search stays within the selected chip. Tap an exercise
 * to add it to the session.
 */
export default function PatternExercises() {
  const db = useDb();
  const { id, pattern } = useLocalSearchParams<{ id: string; pattern: Pattern }>();
  const subcategories = SUBCATEGORIES[pattern] ?? [];
  const chips: { value: Chip; label: string }[] =
    subcategories.length === 0
      ? []
      : [
          ...subcategories.map((s) => ({ value: s as Chip, label: subcategoryName(s) })),
          { value: 'other', label: subcategoryName(null) },
        ];
  const [chip, setChip] = useState<Chip | undefined>(chips[0]?.value);
  const [search, setSearch] = useState('');
  const exercises = useLive(
    (d) => listExercises(d, { pattern, subcategory: chip, search }),
    [pattern, chip, search],
  );
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
        <AppBar
          title={patternName(pattern)}
          back={{ label: '‹ Patterns', onPress: () => router.back() }}
        />
      }
    >
      <View style={styles.controls}>
        <SearchField
          label={`Search in ${patternName(pattern)}`}
          value={search}
          onChangeText={setSearch}
        />
        {chips.length > 0 ? (
          <Chips
            options={chips}
            value={chip ?? null}
            onChange={(v) => v && setChip(v)}
            clearable={false}
            scroll
          />
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
          <View style={styles.empty}>
            <Text variant="small">
              {search.trim() !== ''
                ? `No exercises match "${search.trim()}" here.`
                : 'No exercises here yet.'}
            </Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { padding: sizes.gutter, gap: 12 },
  empty: { padding: sizes.gutter },
});
