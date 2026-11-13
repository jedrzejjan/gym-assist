import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';

import { getClient } from '../../../data/clients';
import { listHistory } from '../../../data/history';
import { mutate, useDb, useLive } from '../../../data/live';
import {
  discardSession,
  finishSession,
  getDraft,
  getSession,
  resumePoint,
} from '../../../data/sessions';
import { fullName } from '../../../domain/clients';
import { formatDayMonth, formatDayMonthYear } from '../../../domain/dates';
import { countsText } from '../../../domain/history';
import { AppBar } from '../../../ui/AppBar';
import { Button } from '../../../ui/Button';
import { type ClientTab, ClientTabs } from '../../../ui/ClientTabs';
import { Dialog } from '../../../ui/Dialog';
import { ListRow } from '../../../ui/ListRow';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { sizes } from '../../../ui/theme';
import { useTapGuard } from '../../../ui/useTapGuard';

/**
 * Boards `history/list` and `history/list - empty`: the client's finished sessions, newest first,
 * with "Start session" at the bottom (plan decision 2). Tapping a session opens its summary.
 */
export default function HistoryTab() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useLive((d) => getClient(d, id), [id]);
  const rows = useLive((d) => listHistory(d, id), [id]);
  // Spec section 4, "One draft at a time": starting while a draft exists asks first.
  const draft = useLive((d) => {
    const info = getDraft(d);
    return info ? { ...info, date: getSession(d, info.sessionId)!.date } : null;
  }, []);
  const [draftPrompt, setDraftPrompt] = useState<'choose' | 'discard' | null>(null);
  const guard = useTapGuard(); // a double tap must not finish, discard or navigate twice

  if (!client) return null;

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
      scroll={false}
      header={
        <>
          <AppBar
            title={fullName(client.firstName, client.lastName)}
            back={{ label: '‹ Clients', onPress: () => router.back() }}
          />
          <ClientTabs current="history" onSelect={goTab} />
        </>
      }
      footer={<Button label="Start session" onPress={startSession} />}
    >
      <FlatList
        data={rows}
        keyExtractor={(r) => r.sessionId}
        renderItem={({ item }) => (
          <ListRow
            title={formatDayMonthYear(item.date)}
            subtitle={countsText(item.exerciseCount, item.setCount)}
            onPress={() => guard(() => router.push(`/session/${item.sessionId}/summary`))}
          />
        )}
        ListEmptyComponent={
          <Text variant="small" style={styles.empty}>
            No sessions yet. Start the first one below.
          </Text>
        }
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

const styles = StyleSheet.create({
  empty: { padding: sizes.gutter },
});
