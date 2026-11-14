import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatDayMonthYear } from '../../domain/dates';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { sizes } from '../../ui/theme';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Board `settings/restore - done` (spec section 5, Restore). */
export default function RestoreDone() {
  const { date, clients, sessions } = useLocalSearchParams<{
    date: string;
    clients: string;
    sessions: string;
  }>();
  const summary = `${count(Number(clients), 'client', 'clients')}, ${count(Number(sessions), 'session', 'sessions')}`;

  const goToClients = () => {
    // Leave Settings behind: the data under them changed.
    router.dismissAll();
    router.push('/clients');
  };

  return (
    <Screen
      header={
        <AppBar title="Restore" back={{ label: '‹ Settings', onPress: () => router.back() }} />
      }
      footer={<Button label="Go to clients" onPress={goToClients} />}
    >
      <View style={styles.body}>
        <Text variant="title">Restore done</Text>
        <Text>{`All data now comes from the backup of ${formatDayMonthYear(date)}: ${summary}.`}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: sizes.gutter, gap: 12 },
});
