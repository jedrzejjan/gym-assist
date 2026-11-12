import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getClient } from '../../data/clients';
import { mutate, useDb, useLive } from '../../data/live';
import { DraftExistsError, getDraft, startSession } from '../../data/sessions';
import { fullName } from '../../domain/clients';
import { formatDateOrToday, todayLocal } from '../../domain/dates';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { DateField } from '../../ui/DateField';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { sizes } from '../../ui/theme';

/** Board `log/start - date` (spec section 4, step 2): today by default, can be changed. */
export default function StartSession() {
  const db = useDb();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const client = useLive((d) => getClient(d, clientId), [clientId]);
  const [date, setDate] = useState(() => todayLocal(new Date()));
  const [blockedBy, setBlockedBy] = useState<string | null>(null);
  const starting = useRef(false); // a double tap must not start two sessions

  const start = () => {
    if (starting.current) return;
    starting.current = true;
    let sessionId: string;
    try {
      sessionId = mutate(db, (tx) => startSession(tx, clientId, date));
    } catch (e) {
      starting.current = false;
      // The draft dialogs arrive with GYM-21; until then, say why nothing happened.
      if (e instanceof DraftExistsError) {
        setBlockedBy(getDraft(db)?.clientName ?? '');
        return;
      }
      throw e;
    }
    // Replace, so "back" from the session goes to the client, not to this date step.
    router.replace(`/session/${sessionId}`);
  };

  const backLabel = client ? `‹ ${fullName(client.firstName, client.lastName)}` : '‹ Back';
  return (
    <Screen
      header={
        <AppBar title="Start session" back={{ label: backLabel, onPress: () => router.back() }} />
      }
      footer={<Button label="Start" onPress={start} />}
    >
      <View style={styles.form}>
        <DateField
          label="Date"
          value={date}
          display={formatDateOrToday(date, todayLocal(new Date()))}
          onChange={setDate}
          toIsoDate={todayLocal}
        />
        {blockedBy !== null ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite">
            {`Another session is in progress (${blockedBy}). Finish or cancel it first.`}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { padding: sizes.gutter, gap: sizes.gutter },
});
