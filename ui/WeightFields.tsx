import { StyleSheet, View } from 'react-native';

import { formatDateOrToday, todayLocal } from '../domain/dates';
import { DateField } from './DateField';
import { NumberField } from './TextField';
import { sizes } from './theme';

type Props = {
  date: string;
  onDate: (d: string) => void;
  kg: string;
  onKg: (v: string) => void;
};

/** Date and weight fields of boards `weight/add` and `weight/edit`. */
export function WeightFields({ date, onDate, kg, onKg }: Props) {
  return (
    <View style={styles.form}>
      <DateField
        label="Date"
        value={date}
        display={formatDateOrToday(date, todayLocal(new Date()))}
        onChange={onDate}
        toIsoDate={todayLocal}
      />
      <NumberField label="Body weight (kg) *" value={kg} onChangeText={onKg} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: sizes.gutter, gap: sizes.gutter },
});
