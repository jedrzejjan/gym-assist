import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getClient } from '../../../data/clients';
import { useLive } from '../../../data/live';
import { trainedFor } from '../../../data/recovery';
import { displayName, muscleName } from '../../../domain/catalogue';
import { fullName } from '../../../domain/clients';
import { todayLocal } from '../../../domain/dates';
import { daysAgo, type RecoveryRow, recoveryTable } from '../../../domain/recovery';
import { AppBar } from '../../../ui/AppBar';
import { Chips } from '../../../ui/Chips';
import { type ClientTab, ClientTabs } from '../../../ui/ClientTabs';
import { ListRow } from '../../../ui/ListRow';
import { Screen } from '../../../ui/Screen';
import { sizes } from '../../../ui/theme';

type Shown = 'patterns' | 'muscles';

const VIEWS = [
  { value: 'patterns' as const, label: 'Patterns' },
  { value: 'muscles' as const, label: 'Muscles' },
];

/** "due · 6 days ago", "… · today", or "never logged" (Sprint 2 plan, decision 5). */
function subtitle(r: RecoveryRow<string>): string {
  return r.days === null ? r.status : `${r.status} · ${daysAgo(r.days)}`;
}

/**
 * Boards `recovery/list` and `recovery/list - never logged`: a status per movement pattern, or
 * per muscle, from the client's finished sessions (spec section 5, recovery.ts).
 */
export default function RecoveryTab() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useLive((d) => getClient(d, id), [id]);
  const trained = useLive((d) => trainedFor(d, id), [id]);
  const [view, setView] = useState<Shown>('patterns');
  if (!client) return null;

  const goTab = (t: ClientTab) =>
    router.replace(t === 'profile' ? `/clients/${id}` : `/clients/${id}/${t}`);

  const table = recoveryTable(trained, todayLocal(new Date()));
  const items: { title: string; sub: string; key: string }[] =
    view === 'patterns'
      ? table.patterns.map((r) => ({ title: displayName(r.key), sub: subtitle(r), key: r.key }))
      : table.muscles.map((r) => ({ title: muscleName(r.key).en, sub: subtitle(r), key: r.key }));

  return (
    <Screen
      header={
        <>
          <AppBar
            title={fullName(client.firstName, client.lastName)}
            back={{ label: '‹ Clients', onPress: () => router.back() }}
          />
          <ClientTabs current="recovery" onSelect={goTab} />
        </>
      }
    >
      <View style={styles.chips}>
        <Chips options={VIEWS} value={view} onChange={(v) => v && setView(v)} clearable={false} />
      </View>
      {/* At most 12 rows: a plain list, so every row is always rendered. */}
      {items.map((item) => (
        <ListRow
          key={item.key}
          title={item.title}
          subtitle={item.sub}
          accessibilityLabel={`${item.title}, ${item.sub}`}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: sizes.gutter, paddingTop: sizes.gutter },
});
