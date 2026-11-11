import { Poppins_400Regular, Poppins_600SemiBold, useFonts } from '@expo-google-fonts/poppins';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { openAppDatabase } from '../data/db/open';
import { DbProvider } from '../data/live';
import type { Db } from '../data/types';
import { MigrationError } from '../ui/MigrationError';

SplashScreen.preventAutoHideAsync().catch(() => {});

type Started = { db: Db; ok: true } | { ok: false; error: string };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Poppins_400Regular, Poppins_600SemiBold });
  const [started, setStarted] = useState<Started | null>(null);

  useEffect(() => {
    openAppDatabase()
      .then(({ db, result }) => setStarted(result.ok ? { db, ok: true } : result))
      .catch((e: unknown) =>
        setStarted({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      );
  }, []);

  // If the fonts fail to load, carry on with the system font rather than a stuck splash screen.
  const ready = (fontsLoaded || fontError !== null) && started !== null;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null; // the splash screen stays up
  if (!started.ok) return <MigrationError error={started.error} />;
  return (
    <DbProvider db={started.db}>
      <Stack screenOptions={{ headerShown: false }} />
    </DbProvider>
  );
}
