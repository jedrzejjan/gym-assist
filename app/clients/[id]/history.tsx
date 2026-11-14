import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';

import { getClient } from '../../../data/clients';
import { listHistory } from '../../../data/history';
import { useLive } from '../../../data/live';
import { fullName } from '../../../domain/clients';
import { formatDayMonthYear } from '../../../domain/dates';
import { countsText } from '../../../domain/history';
import { AppBar } from '../../../ui/AppBar';
import { type ClientTab, ClientTabs } from '../../../ui/ClientTabs';
import { ListRow } from '../../../ui/ListRow';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { sizes } from '../../../ui/theme';
import { useTapGuard } from '../../../ui/useTapGuard';

/**
 * Boards `history/list` and `history/list - empty`: the client's finished sessions, newest first.
 * Tapping a session opens its summary. "Start session" is on the Profile tab (GYM-133).
 */
export default function HistoryTab() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useLive((d) => getClient(d, id), [id]);
  const rows = useLive((d) => listHistory(d, id), [id]);
  const guard = useTapGuard(); // a double tap must not open a summary twice

  if (!client) return null;

  const goTab = (t: ClientTab) =>
    router.replace(t === 'profile' ? `/clients/${id}` : `/clients/${id}/${t}`);

  return (
    <Screen
      scroll={false}
      header={
        <>
          <AppBar
            title={fullName(client.firstName, client.lastName)}
            back={{ label: '‹ Clients', onPress: () => router.back() }}
          />
          <ClientTabs current="history" onSelect={goTab} />
        </>
      }
    >
      <FlatList
        data={rows}
        keyExtractor={(r) => r.sessionId}
        renderItem={({ item }) => (
          <ListRow
            title={formatDayMonthYear(item.date)}
            subtitle={countsText(item.exerciseCount, item.setCount)}
            onPress={() => guard(() => router.push(`/session/${item.sessionId}/summary`))}
          />
        )}
        ListEmptyComponent={
          <Text variant="small" style={styles.empty}>
            No sessions yet. Start one from the Profile tab.
          </Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { padding: sizes.gutter },
});
