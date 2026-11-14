import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from './Text';
import { colors, sizes } from './theme';

export type MenuItem = { label: string; onPress: () => void };

/**
 * The kebab menu (⋮) at the right of the app bar (board `client/profile - menu`, GYM-133). It holds
 * the actions a screen needs rarely, or that are risky, so they stay one tap away instead of on
 * the screen. It closes on an item, on a tap outside it and on the Android back button.
 */
export function Menu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More options"
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={styles.kebab}
      >
        <Text style={styles.kebabText}>⋮</Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={close}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={['top']} style={styles.anchor} pointerEvents="box-none">
          <View style={styles.card} accessibilityRole="menu">
            {items.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                onPress={() => {
                  close();
                  item.onPress();
                }}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <Text>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  kebab: {
    minHeight: sizes.minTap,
    minWidth: sizes.minTap,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    marginRight: -12, // the icon lines up with the gutter, the tap area reaches the edge
  },
  kebabText: { color: colors.white, fontSize: 24, lineHeight: 28 },
  // Just under the app bar, at the right edge, like Android's overflow menu.
  anchor: { alignItems: 'flex-end', paddingTop: sizes.appBar - 8, paddingRight: 8 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    elevation: 8,
    shadowColor: colors.navy,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  item: { minHeight: sizes.minTap, justifyContent: 'center', paddingHorizontal: sizes.gutter },
  pressed: { backgroundColor: colors.background },
});
