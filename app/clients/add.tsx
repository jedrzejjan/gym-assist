import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createClient, type Gender } from '../../data/clients';
import { mutate, useDb } from '../../data/live';
import { formatDayMonthYear, todayLocal } from '../../domain/dates';
import { parseWeight } from '../../domain/sets';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { DateField } from '../../ui/DateField';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { NumberField, TextField } from '../../ui/TextField';
import { sizes } from '../../ui/theme';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/** Board `clients/add`: first name and body weight are required (spec section 5, Clients). */
export default function AddClient() {
  const db = useDb();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [height, setHeight] = useState('');
  const saving = useRef(false); // a double tap must not create the client twice

  const weightKg = parseWeight(weight);
  const heightCm = parseWeight(height);
  const valid =
    firstName.trim() !== '' &&
    typeof weightKg === 'number' &&
    weightKg > 0 &&
    heightCm !== 'invalid' &&
    heightCm !== 0;

  const save = () => {
    if (!valid || saving.current) return;
    saving.current = true;
    mutate(db, (tx) =>
      createClient(tx, {
        firstName,
        lastName,
        gender: gender ?? undefined,
        dateOfBirth: dateOfBirth ?? undefined,
        heightCm: typeof heightCm === 'number' ? heightCm : undefined,
        weightKg: weightKg as number,
        weightDate: todayLocal(new Date()),
      }),
    );
    router.back();
  };

  return (
    <Screen
      header={
        <AppBar title="New client" back={{ label: '‹ Clients', onPress: () => router.back() }} />
      }
      footer={<Button label="Save client" onPress={save} disabled={!valid} />}
    >
      <View style={styles.form}>
        <TextField label="First name *" value={firstName} onChangeText={setFirstName} />
        <TextField label="Last name" value={lastName} onChangeText={setLastName} />
        <NumberField label="Body weight (kg) *" value={weight} onChangeText={setWeight} />
        <Chips label="Gender" options={GENDERS} value={gender} onChange={setGender} />
        <View style={styles.row}>
          <DateField
            label="Date of birth"
            value={dateOfBirth}
            display={dateOfBirth ? formatDayMonthYear(dateOfBirth) : ''}
            onChange={setDateOfBirth}
            toIsoDate={todayLocal}
          />
          <View style={styles.half}>
            <NumberField label="Height (cm)" value={height} onChangeText={setHeight} />
          </View>
        </View>
        <Text variant="small">* required</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { padding: sizes.gutter, gap: sizes.gutter },
  row: { flexDirection: 'row', gap: sizes.gutter },
  half: { flex: 1 },
});
