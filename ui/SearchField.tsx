import { StyleSheet, TextInput } from 'react-native';

import { colors, fonts, sizes } from './theme';

type Props = { label: string; value: string; onChangeText: (text: string) => void };

/** A search box (kit/search field): the label is the placeholder and the accessible name. */
export function SearchField({ label, value, onChangeText }: Props) {
  return (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor={colors.muted}
      value={value}
      onChangeText={onChangeText}
      autoCorrect={false}
      returnKeyType="search"
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: sizes.minTap,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: sizes.radius,
    paddingHorizontal: 20,
    fontFamily: fonts.regular,
    fontSize: sizes.body,
    color: colors.navy,
  },
});
