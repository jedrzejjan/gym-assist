import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
import { type ClientTab, ClientTabs } from '../../../ui/ClientTabs';
import { Dialog } from '../../../ui/Dialog';
import type { MenuItem } from '../../../ui/Menu';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { colors, sizes } from '../../../ui/theme';
import { useTapGuard } from '../../../ui/useTapGuard';

/**
 * Boards `client/profile`, `client/profile - me` and `client/profile - menu`: the Profile tab of
 * the client screen (GYM-133). "Start session" is the only button at the bottom; Edit profile,
 * Weight history and Archive client are in the kebab menu.
 */
export default function ClientScreen() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useLive((d) => getClient(d, id), [id]);
  const weight = useLive((d) => latestWeight(d, id), [id]);
  // Spec section 4, "One draft at a time": starting while a draft exists asks first.
  const draft = useLive((d) => {
    const info = getDraft(d);
    return info ? { ...info, date: getSession(d, info.sessionId)!.date } : null;
  }, []);
  const [draftPrompt, setDraftPrompt] = useState<'choose' | 'discard' | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const archiving = useRef(false); // a double tap must not go back twice
  const guard = useTapGuard(); // a double tap must not finish, discard or navigate twice
  if (!client) return null;
  const name = fullName(client.firstName, client.lastName);
  // Years only: the date of birth is in Edit profile (GYM-133).
  const age = client.dateOfBirth
    ? `${ageOn(client.dateOfBirth, todayLocal(new Date()))} years`
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

  const toDateStep = () => router.push(`/session/start?clientId=${id}`);
  const startSession = () => (draft ? setDraftPrompt('choose') : guard(toDateStep));

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
    mutate(db, (tx) => discardSession(tx, draft.sessionId), { export: false }); // a draft only
    toDateStep();
  };
  const exercisesText = (n: number) =>
    n === 0 ? 'empty' : n === 1 ? '1 exercise' : `${n} exercises`;
  const draftSummary = draft
    ? `${draft.clientName} · ${formatDayMonth(draft.date)} · ${exercisesText(draft.exerciseCount)}`
    : '';

  const menu: MenuItem[] = [
    { label: 'Edit profile', onPress: () => guard(() => router.push(`/clients/${id}/edit`)) },
    { label: 'Weight history', onPress: () => guard(() => router.push(`/clients/${id}/weight`)) },
    // "Me" can't be archived.
    ...(client.isSelf ? [] : [{ label: 'Archive client', onPress: () => setConfirmArchive(true) }]),
  ];

  return (
    <Screen
      header={
        <>
          <AppBar
            title={name}
            back={{ label: '‹ Clients', onPress: () => router.back() }}
            menu={menu}
          />
          <ClientTabs current="profile" onSelect={goTab} />
        </>
      }
      footer={<Button label="Start session" onPress={startSession} />}
    >
      <View style={styles.card}>
        <Field label="Gender" value={genderLabel(client.gender)} />
        <Field label="Age" value={age} />
        <Field label="Height" value={client.heightCm != null ? `${client.heightCm} cm` : null} />
        <Field
          label="Body weight"
          value={weight ? `${weight.valueKg} kg · ${formatDayMonthYear(weight.date)}` : null}
        />
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
  note: { paddingHorizontal: sizes.gutter },
});
