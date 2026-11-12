import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, fonts, sizes } from './theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmation dialog (boards `client/dialog - archive`, `weight/dialog - replace`, `- delete`). */
export function Dialog({ visible, title, message, confirmLabel, onConfirm, onCancel }: Props) {
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityRole="alert">
          <Text variant="title">{title}</Text>
          <Text variant="small">{message}</Text>
          <View style={styles.actions}>
            <DialogButton label="Cancel" onPress={onCancel} />
            <DialogButton label={confirmLabel} onPress={onConfirm} strong />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DialogButton({
  label,
  onPress,
  strong = false,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={styles.button}
    >
      <Text style={[styles.buttonText, strong && styles.strong]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 32,
  },
  card: { backgroundColor: colors.white, borderRadius: sizes.tileRadius, padding: 24, gap: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
  button: { minHeight: sizes.minTap, minWidth: sizes.minTap, justifyContent: 'center' },
  buttonText: { color: colors.accent, fontSize: sizes.body },
  strong: { fontFamily: fonts.semibold },
});
