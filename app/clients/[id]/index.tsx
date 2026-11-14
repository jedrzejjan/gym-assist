import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { archiveClient, getClient } from '../../../data/clients';
import { mutate, useDb, useLive } from '../../../data/live';
import { latestWeight } from '../../../data/measurements';
import { ageOn, fullName } from '../../../domain/clients';
import { formatDayMonthYear, todayLocal } from '../../../domain/dates';
import { AppBar } from '../../../ui/AppBar';
import { Button } from '../../../ui/Button';
import { genderLabel } from '../../../ui/ClientForm';
import { type ClientTab, ClientTabs } from '../../../ui/ClientTabs';
import { Dialog } from '../../../ui/Dialog';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { colors, fonts, sizes } from '../../../ui/theme';

/**
 * Boards `client/profile` and `client/profile - me`: the Profile tab of the client screen.
 * "Start session" lives on the History tab (Sprint 2 plan, decision 2).
 */
export default function ClientScreen() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useLive((d) => getClient(d, id), [id]);
  const weight = useLive((d) => latestWeight(d, id), [id]);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const archiving = useRef(false); // a double tap must not go back twice
  if (!client) return null;
  const name = fullName(client.firstName, client.lastName);
  const age = client.dateOfBirth
    ? `${ageOn(client.dateOfBirth, todayLocal(new Date()))} years (${formatDayMonthYear(client.dateOfBirth)})`
    : null;

  const archive = () => {
    if (archiving.current) return;
    archiving.current = true;
    setConfirmArchive(false);
    mutate(db, (tx) => archiveClient(tx, client.id));
    router.back();
  };

  const goTab = (t: ClientTab) =>
    router.replace(t === 'profile' ? `/clients/${id}` : `/clients/${id}/${t}`);

  return (
    <Screen
      header={
        <>
          <AppBar title={name} back={{ label: '‹ Clients', onPress: () => router.back() }} />
          <ClientTabs current="profile" onSelect={goTab} />
        </>
      }
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
              accessibilityLabel="Weight history"
              onPress={() => router.push(`/clients/${client.id}/weight`)}
              hitSlop={8}
              style={styles.link}
            >
              <Text style={styles.linkText}>Weight history ›</Text>
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
