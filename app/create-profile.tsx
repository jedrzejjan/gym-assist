import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createClient } from '../data/clients';
import { mutate, useDb } from '../data/live';
import { setSetting, WELCOME_DONE } from '../data/settings';
import { todayLocal } from '../domain/dates';
import { parseWeight } from '../domain/sets';
import { AppBar } from '../ui/AppBar';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { NumberField, TextField } from '../ui/TextField';
import { sizes } from '../ui/theme';

/**
 * Board `app/create my profile`: creates "Me" with a first name and body weight. Reached from
 * Welcome, from "Add my profile" on Clients (`?from=clients`), where it returns to the list, or
 * from Settings › Import history (`?then=import`), where it goes on to the import (decision 9).
 */
export default function CreateProfile() {
  const db = useDb();
  const { from, then } = useLocalSearchParams<{ from?: string; then?: string }>();
  const fromClients = from === 'clients';
  // From Settings › Import history without a "Me": create it, then go on to the import.
  const thenImport = then === 'import';
  const [firstName, setFirstName] = useState('');
  const [weight, setWeight] = useState('');
  const saving = useRef(false); // a double tap must not create "Me" twice

  const weightKg = parseWeight(weight);
  const valid = firstName.trim() !== '' && typeof weightKg === 'number' && weightKg > 0;

  const save = () => {
    if (!valid || saving.current) return;
    saving.current = true;
    try {
      mutate(db, (tx) => {
        createClient(tx, {
          firstName,
          isSelf: true,
          weightKg: weightKg as number,
          weightDate: todayLocal(new Date()),
        });
        setSetting(tx, WELCOME_DONE, '1');
      });
    } catch (e) {
      saving.current = false; // let the trainer try again
      throw e;
    }
    if (thenImport) {
      router.replace('/settings/import');
    } else if (fromClients) {
      router.back();
    } else {
      // Clear Welcome from the history, so Back on Home doesn't show it again.
      if (router.canDismiss()) router.dismissAll();
      router.replace('/');
    }
  };

  return (
    <Screen
      header={
        <AppBar
          title="My profile"
          back={{
            label: thenImport ? '‹ Settings' : fromClients ? '‹ Clients' : '‹ Welcome',
            onPress: () => router.back(),
          }}
        />
      }
      footer={<Button label="Save and continue" onPress={save} disabled={!valid} />}
    >
      <View style={styles.form}>
        <TextField label="First name *" value={firstName} onChangeText={setFirstName} />
        <NumberField label="Body weight (kg) *" value={weight} onChangeText={setWeight} />
        <Text variant="small">
          Last name, gender, date of birth and height can be added later in Profile.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { padding: sizes.gutter, gap: sizes.gutter },
});
