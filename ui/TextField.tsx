import { StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { Text } from './Text';
import { colors, fonts, sizes } from './theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
};

/** A labelled text field. NumberField is this with a decimal keyboard. */
export function TextField({ label, value, onChangeText, keyboardType, placeholder }: Props) {
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder ?? '-'}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}

export function NumberField(props: Omit<Props, 'keyboardType'>) {
  return <TextField {...props} keyboardType="decimal-pad" />;
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  input: {
    minHeight: sizes.minTap,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: sizes.body,
    color: colors.navy,
  },
});
