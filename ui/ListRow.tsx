import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, fonts, sizes } from './theme';

type Props = {
  title: string;
  subtitle?: string;
  /** A small mark next to the title, e.g. "me". */
  tag?: string;
  onPress?: () => void;
};

export function ListRow({ title, subtitle, tag, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={styles.row}
    >
      <View style={styles.titleLine}>
        <Text style={styles.title}>{title}</Text>
        {tag ? <Text style={styles.tag}>{tag}</Text> : null}
      </View>
      {subtitle ? <Text variant="small">{subtitle}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    backgroundColor: colors.white,
    paddingHorizontal: sizes.gutter,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.semibold, fontSize: sizes.body, color: colors.navy },
  tag: {
    fontSize: sizes.small,
    color: colors.white,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
});
