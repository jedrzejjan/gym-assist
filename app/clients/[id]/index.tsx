import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { archiveClient, getClient } from '../../../data/clients';
import { mutate, useDb, useLive } from '../../../data/live';
import { latestWeight } from '../../../data/measurements';
import { ageOn, fullName } from '../../../domain/clients';
import { formatDayMonthYear, todayLocal } from '../../../domain/dates';
import { AppBar } from '../../../ui/AppBar';
import { Button } from '../../../ui/Button';
import { genderLabel } from '../../../ui/ClientForm';
import { Dialog } from '../../../ui/Dialog';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { colors, fonts, sizes } from '../../../ui/theme';

/**
 * Boards `client/profile` and `client/profile - me`. In Sprint 1 the client screen shows the
 * profile only; "Start session" arrives with GYM-19 (PR #21, decision 7).
 */
export default function ClientScreen() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useLive((d) => getClient(d, id), [id]);
  const weight = useLive((d) => latestWeight(d, id), [id]);
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (!client) return null;
  const name = fullName(client.firstName, client.lastName);
  const age = client.dateOfBirth
    ? `${ageOn(client.dateOfBirth, todayLocal(new Date()))} years (${formatDayMonthYear(client.dateOfBirth)})`
    : null;

  const archive = () => {
    setConfirmArchive(false);
    mutate(db, (tx) => archiveClient(tx, client.id));
    router.back();
  };

  return (
    <Screen
      header={<AppBar title={name} back={{ label: '‹ Clients', onPress: () => router.back() }} />}
      footer={
        <>
          <Button
            label="Edit profile"
            variant="secondary"
            onPress={() => router.push(`/clients/${client.id}/edit`)}
          />
          {client.isSelf ? null : (
            <Button
              label="Archive client"
              variant="secondary"
              onPress={() => setConfirmArchive(true)}
            />
          )}
        </>
      }
    >
      <View style={styles.card}>
        <Field label="Gender" value={genderLabel(client.gender)} />
        <Field label="Age" value={age} />
        <Field label="Height" value={client.heightCm != null ? `${client.heightCm} cm` : null} />
        <View style={styles.field}>
          <Text variant="label">Body weight</Text>
          <View style={styles.weightLine}>
            <Text>
              {weight ? `${weight.valueKg} kg · ${formatDayMonthYear(weight.date)}` : '-'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/clients/${client.id}/weight`)}
              hitSlop={8}
              style={styles.link}
            >
              <Text style={styles.linkText}>History ›</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {client.isSelf ? (
        <Text variant="small" style={styles.note}>
          &quot;Me&quot; can be renamed but not archived.
        </Text>
      ) : null}
      <Dialog
        visible={confirmArchive}
        title={`Archive ${name}?`}
        message="The client is hidden from the list. All history is kept."
        confirmLabel="Archive"
        onConfirm={archive}
        onCancel={() => setConfirmArchive(false)}
      />
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <Text style={value ? undefined : { color: colors.muted }}>{value ?? '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: sizes.gutter,
    backgroundColor: colors.white,
    borderRadius: sizes.tileRadius,
    paddingHorizontal: sizes.gutter,
  },
  field: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 2,
  },
  weightLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { minHeight: sizes.minTap, justifyContent: 'center' },
  linkText: { color: colors.accent, fontFamily: fonts.semibold, fontSize: sizes.small },
  note: { paddingHorizontal: sizes.gutter },
});
