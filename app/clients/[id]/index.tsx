import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { archiveClient, getClient } from '../../../data/clients';
import { mutate, useDb, useLive } from '../../../data/live';
import { latestWeight } from '../../../data/measurements';
import {
  discardSession,
  finishSession,
  getDraft,
  getSession,
  resumePoint,
} from '../../../data/sessions';
import { ageOn, fullName } from '../../../domain/clients';
import { formatDayMonth, formatDayMonthYear, todayLocal } from '../../../domain/dates';
import { AppBar } from '../../../ui/AppBar';
import { Button } from '../../../ui/Button';
import { genderLabel } from '../../../ui/ClientForm';
import { Dialog } from '../../../ui/Dialog';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { colors, fonts, sizes } from '../../../ui/theme';
import { useTapGuard } from '../../../ui/useTapGuard';

/**
 * Boards `client/profile` and `client/profile - me`, with "Start session" from
 * `client/overview`. In Sprint 1 the client screen shows the profile and "Start session"; the
 * History, Recovery and Progress tabs arrive in Sprint 2 (PR #21, decision 7).
 */
export default function ClientScreen() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useLive((d) => getClient(d, id), [id]);
  const weight = useLive((d) => latestWeight(d, id), [id]);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const archiving = useRef(false); // a double tap must not go back twice
  // Spec section 4, "One draft at a time": starting while a draft exists asks first.
  const draft = useLive((d) => {
    const info = getDraft(d);
    return info ? { ...info, date: getSession(d, info.sessionId)!.date } : null;
  }, []);
  const [draftPrompt, setDraftPrompt] = useState<'choose' | 'discard' | null>(null);
  const guard = useTapGuard(); // a double tap must not finish, discard or navigate twice

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

  const toDateStep = () => router.push(`/session/start?clientId=${client.id}`);
  const startSession = () => (draft ? setDraftPrompt('choose') : toDateStep());

  const resume = () => {
    if (!draft) return;
    setDraftPrompt(null);
    const point = resumePoint(db, draft.sessionId);
    router.push(`/session/${draft.sessionId}`);
    if (point.screen === 'exercise') {
      router.push(`/session/${draft.sessionId}/exercise/${point.seId}`);
    }
  };
  const finishDraft = () => {
    if (!draft) return;
    setDraftPrompt(null);
    mutate(db, (tx) => finishSession(tx, draft.sessionId));
    toDateStep();
  };
  const discardDraft = () => {
    if (!draft) return;
    setDraftPrompt(null);
    mutate(db, (tx) => discardSession(tx, draft.sessionId));
    toDateStep();
  };
  const exercisesText = (n: number) =>
    n === 0 ? 'empty' : n === 1 ? '1 exercise' : `${n} exercises`;
  const draftSummary = draft
    ? `${draft.clientName} · ${formatDayMonth(draft.date)} · ${exercisesText(draft.exerciseCount)}`
    : '';

  return (
    <Screen
      header={<AppBar title={name} back={{ label: '‹ Clients', onPress: () => router.back() }} />}
      footer={
        <>
          <Button label="Start session" onPress={startSession} />
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
              accessibilityLabel="Body-weight history"
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
        visible={draftPrompt === 'choose'}
        title="A session is already in progress"
        message={draftSummary}
        onCancel={() => setDraftPrompt(null)}
        actions={[
          { label: 'Resume', onPress: () => guard(resume), strong: true },
          // An empty draft can't be finished (spec section 4, "Finishing needs an exercise").
          ...(draft && draft.exerciseCount > 0
            ? [{ label: 'Finish it', onPress: () => guard(finishDraft) }]
            : []),
          { label: 'Discard it', onPress: () => setDraftPrompt('discard') },
        ]}
      />
      <Dialog
        visible={draftPrompt === 'discard'}
        title="Discard this session?"
        message="All exercises and sets in this session will be deleted."
        confirmLabel="Discard"
        onConfirm={() => guard(discardDraft)}
        onCancel={() => setDraftPrompt(null)}
      />
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
