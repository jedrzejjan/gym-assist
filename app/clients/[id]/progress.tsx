import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getClient } from '../../../data/clients';
import { mutate, useDb, useLive } from '../../../data/live';
import { latestWeight } from '../../../data/measurements';
import {
  bodyProgress,
  estimateAll,
  type OneRepMax,
  setOneRepMax,
  type StrengthItem,
  strengthList,
} from '../../../data/progress';
import { fullName } from '../../../domain/clients';
import { formatDayMonth, formatDayMonthYear, todayLocal } from '../../../domain/dates';
import { estimateAllText, planEstimateAll, round2 } from '../../../domain/progress';
import { formatKg, formatSet, parseWeight } from '../../../domain/sets';
import { AppBar } from '../../../ui/AppBar';
import { Button } from '../../../ui/Button';
import { Chips } from '../../../ui/Chips';
import { type ClientTab, ClientTabs } from '../../../ui/ClientTabs';
import { Dialog } from '../../../ui/Dialog';
import { ListRow } from '../../../ui/ListRow';
import { Screen } from '../../../ui/Screen';
import { Text } from '../../../ui/Text';
import { NumberField } from '../../../ui/TextField';
import { colors, fonts, sizes } from '../../../ui/theme';

type Shown = 'strength' | 'body';

const VIEWS = [
  { value: 'strength' as const, label: 'Strength' },
  { value: 'body' as const, label: 'Body' },
];

/**
 * "1RM 101.75 kg · estimated · 5 Nov 2026"; for a bodyweight exercise the stored value is the
 * total load: "1RM 81 kg total (BW + 17.5) · manual · 1 Nov 2026", with the latest body weight.
 */
function oneRepMaxLine(orm: OneRepMax, usesBodyweight: boolean, bodyWeightKg: number | null) {
  const date = formatDayMonthYear(todayLocal(new Date(orm.createdAt)));
  const value =
    usesBodyweight && bodyWeightKg !== null
      ? `${formatKg(orm.valueKg)} kg total (BW + ${formatKg(Math.max(0, orm.valueKg - bodyWeightKg))})`
      : `${formatKg(orm.valueKg)} kg`;
  return `1RM ${value} · ${orm.source} · ${date}`;
}

/** "−2.3 kg since 15 Sep" (a minus sign, not a hyphen), "+1.2 kg …", "0 kg …". */
function changeText(changeKg: number, since: string) {
  const sign = changeKg < 0 ? '−' : changeKg > 0 ? '+' : '';
  return `${sign}${formatKg(Math.abs(changeKg))} kg since ${formatDayMonth(since)}`;
}

/**
 * Boards `progress/strength`, `progress/strength - no 1RM`, the two 1RM dialogs and
 * `progress/body` (spec section 5, progress.ts; Sprint 2 plan, decision 6). The 1RM changes only
 * here, on purpose: "Estimate" from the best set, "Set manually", or "Estimate all 1RMs"
 * (board `progress/dialog - estimate all`, GYM-134), which keeps the 1RMs set by hand.
 */
export default function ProgressTab() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useLive((d) => getClient(d, id), [id]);
  const strength = useLive((d) => strengthList(d, id), [id]);
  const body = useLive((d) => bodyProgress(d, id), [id]);
  const bw = useLive((d) => latestWeight(d, id), [id]);
  const [view, setView] = useState<Shown>('strength');
  const [estimating, setEstimating] = useState<StrengthItem | null>(null);
  const [manual, setManual] = useState<StrengthItem | null>(null);
  const [manualText, setManualText] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const saving = useRef(false); // a double tap must not store two rows
  if (!client) return null;
  const name = fullName(client.firstName, client.lastName);

  const goTab = (t: ClientTab) =>
    router.replace(t === 'profile' ? `/clients/${id}` : `/clients/${id}/${t}`);

  const store = (item: StrengthItem, valueKg: number, source: 'estimated' | 'manual') => {
    if (saving.current) return;
    saving.current = true;
    try {
      mutate(db, (tx) => setOneRepMax(tx, id, item.exerciseId, valueKg, source));
    } finally {
      saving.current = false;
    }
  };

  const confirmEstimate = () => {
    if (!estimating?.best) return;
    const item = estimating;
    setEstimating(null);
    store(item, round2(item.best!.e1rmKg), 'estimated');
  };

  const typed = parseWeight(manualText);
  const manualValid = typeof typed === 'number' && typed > 0;
  const openManual = (item: StrengthItem) => {
    setManualText('');
    setManual(item);
  };
  const saveManual = () => {
    if (!manual || !manualValid) return;
    const item = manual;
    setManual(null);
    store(item, typed as number, 'manual');
  };

  const estimate = estimating?.best ?? null;

  const allPlan = planEstimateAll(strength);
  const allCount = allPlan.set.length + allPlan.update.length;
  const confirmEstimateAll = () => {
    setConfirmAll(false);
    if (saving.current) return;
    saving.current = true;
    try {
      mutate(db, (tx) => estimateAll(tx, id));
    } finally {
      saving.current = false;
    }
  };

  return (
    <Screen
      header={
        <>
          <AppBar title={name} back={{ label: '‹ Clients', onPress: () => router.back() }} />
          <ClientTabs current="progress" onSelect={goTab} />
        </>
      }
    >
      <View style={styles.chips}>
        <Chips options={VIEWS} value={view} onChange={(v) => v && setView(v)} clearable={false} />
      </View>

      {view === 'strength' ? (
        <View style={styles.list}>
          {strength.length === 0 ? (
            <Text variant="small">No finished sessions yet.</Text>
          ) : (
            <Button
              label="Estimate all 1RMs"
              variant="secondary"
              disabled={allCount === 0}
              onPress={() => setConfirmAll(true)}
            />
          )}
          {strength.map((item) => (
            <View key={item.exerciseId} style={styles.card}>
              <Text style={styles.name}>{item.nameEn}</Text>
              <Text style={styles.line}>
                {item.oneRepMax
                  ? oneRepMaxLine(item.oneRepMax, item.usesBodyweight, bw?.valueKg ?? null)
                  : 'No 1RM yet'}
              </Text>
              <Text style={styles.line}>
                {`Best set: ${item.best ? formatSet(item.best.shown, item.usesBodyweight) : '-'}`}
              </Text>
              <View style={styles.actions}>
                <CardAction
                  label="Estimate"
                  a11y={`Estimate ${item.nameEn}`}
                  // A 1RM must be more than 0 kg: sets logged as 0 kg give nothing to estimate.
                  disabled={item.best === null || !(round2(item.best.e1rmKg) > 0)}
                  onPress={() => setEstimating(item)}
                />
                <CardAction
                  label="Set manually"
                  a11y={`Set manually ${item.nameEn}`}
                  onPress={() => openManual(item)}
                />
              </View>
            </View>
          ))}
          {strength.some((i) => i.oneRepMax === null) ? (
            <Text variant="small">Weight entry in % needs a 1RM for the exercise.</Text>
          ) : null}
        </View>
      ) : body ? (
        <View>
          <View style={[styles.card, styles.bodyCard]}>
            <Text variant="label">Body weight</Text>
            <View style={styles.bodyLine}>
              <Text style={styles.bodyValue}>{`${formatKg(body.latest.valueKg)} kg`}</Text>
              {body.changeKg !== null && body.since !== null ? (
                <Text variant="small">{changeText(body.changeKg, body.since)}</Text>
              ) : null}
            </View>
          </View>
          {body.entries.map((e) => (
            <ListRow
              key={e.id}
              title={`${formatKg(e.valueKg)} kg`}
              subtitle={formatDayMonthYear(e.date)}
            />
          ))}
          <Text variant="small" style={styles.note}>
            More measurements (waist, biceps…) come later.
          </Text>
        </View>
      ) : null}

      <Dialog
        visible={estimate !== null}
        title="Set the 1RM from history?"
        message={
          estimating && estimate
            ? `${estimating.nameEn}: ${formatKg(round2(estimate.e1rmKg))} kg, from ${formatSet(
                estimate.shown,
                estimating.usesBodyweight,
              )} on ${formatDayMonthYear(estimate.date)}.`
            : ''
        }
        confirmLabel="Set 1RM"
        onConfirm={confirmEstimate}
        onCancel={() => setEstimating(null)}
      />
      <Dialog
        visible={confirmAll}
        title="Estimate all 1RMs?"
        message={estimateAllText(allPlan)}
        confirmLabel="Estimate all"
        onConfirm={confirmEstimateAll}
        onCancel={() => setConfirmAll(false)}
      />
      <Dialog
        visible={manual !== null}
        title="Set 1RM manually"
        message={manual ? `${manual.nameEn} · ${name}` : ''}
        confirmLabel="Save"
        confirmDisabled={!manualValid}
        onConfirm={saveManual}
        onCancel={() => setManual(null)}
      >
        <NumberField label="1RM (kg)" value={manualText} onChangeText={setManualText} />
      </Dialog>
    </Screen>
  );
}

/** The small outlined buttons on a Strength card ("Estimate", "Set manually"). */
function CardAction({
  label,
  a11y,
  onPress,
  disabled = false,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, disabled && styles.actionDisabled]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: sizes.gutter, paddingTop: sizes.gutter },
  list: { padding: sizes.gutter, gap: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: sizes.tileRadius,
    padding: sizes.gutter,
    gap: 4,
  },
  name: { fontFamily: fonts.semibold, fontSize: sizes.body, color: colors.navy },
  line: { color: colors.slate },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  action: {
    minHeight: sizes.minTap,
    paddingHorizontal: 16,
    borderRadius: sizes.radius,
    borderWidth: 1,
    borderColor: colors.accent,
    justifyContent: 'center',
  },
  actionDisabled: { opacity: 0.4 },
  actionText: { color: colors.accent, fontFamily: fonts.semibold },
  bodyCard: { margin: sizes.gutter },
  bodyLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  bodyValue: { fontFamily: fonts.semibold, fontSize: sizes.title, color: colors.navy },
  note: { padding: sizes.gutter },
});
