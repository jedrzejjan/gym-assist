import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, fonts, sizes } from './theme';

type Action = { label: string; onPress: () => void; strong?: boolean; disabled?: boolean };

type Props = {
  visible: boolean;
  title: string;
  message: string;
  /** Closing the dialog (Cancel, or the Android back button). */
  onCancel: () => void;
  /** Extra content under the message, e.g. a number field (`progress/dialog - set 1RM`). */
  children?: ReactNode;
} & (
  | { confirmLabel: string; onConfirm: () => void; confirmDisabled?: boolean; actions?: never }
  /** A dialog with its own buttons instead of Cancel + confirm (`log/dialog - draft exists`). */
  | { actions: Action[]; confirmLabel?: never; onConfirm?: never; confirmDisabled?: never }
);

/** Confirmation dialog (boards `client/dialog - archive`, `weight/dialog - replace`, `- delete`). */
export function Dialog(props: Props) {
  const { visible, title, message, onCancel } = props;
  if (!visible) return null;
  const buttons: Action[] = props.actions ?? [
    { label: 'Cancel', onPress: onCancel },
    {
      label: props.confirmLabel,
      onPress: props.onConfirm,
      strong: true,
      disabled: props.confirmDisabled,
    },
  ];
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityRole="alert">
          <Text variant="title">{title}</Text>
          <Text variant="small">{message}</Text>
          {props.children}
          <View style={styles.actions}>
            {buttons.map((b) => (
              <DialogButton
                key={b.label}
                label={b.label}
                onPress={b.onPress}
                strong={b.strong}
                disabled={b.disabled}
              />
            ))}
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
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={[styles.button, disabled && styles.disabled]}
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 8,
  },
  button: { minHeight: sizes.minTap, minWidth: sizes.minTap, justifyContent: 'center' },
  buttonText: { color: colors.accent, fontSize: sizes.body },
  strong: { fontFamily: fonts.semibold },
  disabled: { opacity: 0.4 },
});
