import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ClientRow, Gender } from '../data/clients';
import { formatDayMonthYear, todayLocal } from '../domain/dates';
import { parseWeight } from '../domain/sets';
import { Chips } from './Chips';
import { DateField } from './DateField';
import { Text } from './Text';
import { NumberField, TextField } from './TextField';
import { sizes } from './theme';

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export function genderLabel(g: string | null): string | null {
  return GENDERS.find((x) => x.value === g)?.label ?? null;
}

type Initial = Pick<ClientRow, 'firstName' | 'lastName' | 'gender' | 'dateOfBirth' | 'heightCm'>;

/** Form state shared by Add client and Edit profile. */
export function useClientForm(initial?: Initial | null) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [gender, setGender] = useState<Gender | null>((initial?.gender as Gender | null) ?? null);
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(initial?.dateOfBirth ?? null);
  const [height, setHeight] = useState(initial?.heightCm != null ? String(initial.heightCm) : '');

  const heightCm = parseWeight(height);
  const valid = firstName.trim() !== '' && heightCm !== 'invalid' && heightCm !== 0;

  return {
    fields: {
      firstName,
      setFirstName,
      lastName,
      setLastName,
      gender,
      setGender,
      dateOfBirth,
      setDateOfBirth,
      height,
      setHeight,
    },
    valid,
    values: {
      firstName,
      lastName: lastName.trim() === '' ? null : lastName,
      gender,
      dateOfBirth,
      heightCm: typeof heightCm === 'number' ? heightCm : null,
    },
  };
}

type Props = {
  form: ReturnType<typeof useClientForm>;
  /** Add client asks for a body weight here; Edit profile changes it in the weight history. */
  weight?: { value: string; onChange: (v: string) => void };
};

/** Board `clients/add`. Edit profile reuses it without the weight field (it has no board). */
export function ClientForm({ form, weight }: Props) {
  const f = form.fields;
  return (
    <View style={styles.form}>
      <TextField label="First name *" value={f.firstName} onChangeText={f.setFirstName} />
      <TextField label="Last name" value={f.lastName} onChangeText={f.setLastName} />
      {weight ? (
        <NumberField
          label="Body weight (kg) *"
          value={weight.value}
          onChangeText={weight.onChange}
        />
      ) : null}
      <Chips label="Gender" options={GENDERS} value={f.gender} onChange={f.setGender} />
      <View style={styles.row}>
        <DateField
          label="Date of birth"
          value={f.dateOfBirth}
          display={f.dateOfBirth ? formatDayMonthYear(f.dateOfBirth) : ''}
          onChange={f.setDateOfBirth}
          toIsoDate={todayLocal}
        />
        <View style={styles.half}>
          <NumberField label="Height (cm)" value={f.height} onChangeText={f.setHeight} />
        </View>
      </View>
      <Text variant="small">* required</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: sizes.gutter, gap: sizes.gutter },
  row: { flexDirection: 'row', gap: sizes.gutter },
  half: { flex: 1 },
});
