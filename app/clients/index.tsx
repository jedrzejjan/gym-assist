import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { listClients } from '../../data/clients';
import { useLive } from '../../data/live';
import { fullName } from '../../domain/clients';
import { formatDayMonthYear } from '../../domain/dates';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { ListRow } from '../../ui/ListRow';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { sizes } from '../../ui/theme';

/** Boards `clients/list - only me` and `clients/list - empty` (spec section 5, Clients). */
export default function Clients() {
  const clients = useLive((db) => listClients(db), []);
  const hasMe = clients.some((c) => c.isSelf);
  const others = clients.filter((c) => !c.isSelf).length;

  return (
    <Screen
      header={<AppBar title="Clients" back={{ label: '‹ Home', onPress: () => router.back() }} />}
      footer={<Button label="Add client" onPress={() => router.push('/clients/add')} />}
    >
      {hasMe ? null : (
        <ListRow
          title="+ Add my profile"
          subtitle="Track your own training too"
          onPress={() => router.push('/create-profile?from=clients')}
        />
      )}
      {clients.map((c) => (
        <ListRow
          key={c.id}
          title={fullName(c.firstName, c.lastName)}
          tag={c.isSelf ? 'me' : undefined}
          subtitle={
            c.lastSessionDate
              ? `Last session: ${formatDayMonthYear(c.lastSessionDate)}`
              : 'No sessions yet'
          }
          onPress={() => router.push(`/clients/${c.id}`)}
        />
      ))}
      {others === 0 ? (
        hasMe ? (
          <Text variant="small" style={styles.note}>
            No clients yet. Add your first client below.
          </Text>
        ) : (
          <View style={styles.empty}>
            <Text variant="title">No clients yet</Text>
            <Text variant="small">Add your first client to start logging sessions.</Text>
          </View>
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { padding: sizes.gutter },
  empty: { padding: sizes.gutter, paddingTop: 48, gap: 8, alignItems: 'center' },
});
