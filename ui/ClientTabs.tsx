import { TabBar } from './TabBar';

export type ClientTab = 'profile' | 'history' | 'recovery' | 'progress';

// Board order: Profile | History | Recovery | Progress. Recovery (GYM-23) and Progress (GYM-24)
// join the list when their screens exist.
const TABS: { value: ClientTab; label: string }[] = [
  { value: 'profile', label: 'Profile' },
  { value: 'history', label: 'History' },
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
