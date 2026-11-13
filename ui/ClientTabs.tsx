import { TabBar } from './TabBar';

export type ClientTab = 'profile' | 'history' | 'recovery' | 'progress';

// Board order: Profile | History | Recovery | Progress. Progress (GYM-24) joins the list when
// its screen exists.
const TABS: { value: ClientTab; label: string }[] = [
  { value: 'profile', label: 'Profile' },
  { value: 'history', label: 'History' },
  { value: 'recovery', label: 'Recovery' },
];

/** The client screen's tabs. Presentation only: each screen routes in `onSelect`. */
export function ClientTabs({
  current,
  onSelect,
}: {
  current: ClientTab;
  onSelect: (t: ClientTab) => void;
}) {
  return <TabBar tabs={TABS} current={current} onSelect={onSelect} />;
}
