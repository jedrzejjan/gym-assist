import { router, useLocalSearchParams } from 'expo-router';

import { countByPattern } from '../../../data/exercises';
import { useLive } from '../../../data/live';
import { displayName, PATTERNS } from '../../../domain/catalogue';
import { AppBar } from '../../../ui/AppBar';
import { ListRow } from '../../../ui/ListRow';
import { Screen } from '../../../ui/Screen';

const countText = (n: number) =>
  n === 0 ? 'No exercises yet' : n === 1 ? '1 exercise' : `${n} exercises`;

/** Board `log/choose - patterns`. A pattern with no exercises is shown but can't be opened. */
export default function Patterns() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const counts = useLive((db) => countByPattern(db), []);

  return (
    <Screen
      header={
        <AppBar
          title="Choose by pattern"
          back={{ label: '‹ Session', onPress: () => router.back() }}
        />
      }
    >
      {PATTERNS.map((p) => (
        <ListRow
          key={p}
          title={displayName(p)}
          subtitle={countText(counts[p])}
          disabled={counts[p] === 0}
          onPress={() => router.push(`/session/${id}/pattern/${encodeURIComponent(p)}`)}
        />
      ))}
    </Screen>
  );
}
