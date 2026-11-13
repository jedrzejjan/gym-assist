import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, sizes } from './theme';

type Props = {
  header?: ReactNode;
  children: ReactNode;
  /** Main actions, pinned to the bottom within thumb reach. */
  footer?: ReactNode;
  /** false for a screen whose content is its own list (a FlatList must not sit in a ScrollView). */
  scroll?: boolean;
};

export function Screen({ header, children, footer, scroll = true }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  fill: { flex: 1 },
  footer: { padding: sizes.gutter, gap: 12 },
});
