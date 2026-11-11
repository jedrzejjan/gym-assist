import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { mutate, useDb } from '../data/live';
import { setSetting, WELCOME_DONE } from '../data/settings';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { colors, sizes } from '../ui/theme';

/** Board `app/welcome`: first start only (spec section 5). */
export default function Welcome() {
  const db = useDb();

  const skip = () => {
    mutate(db, (tx) => setSetting(tx, WELCOME_DONE, '1'));
    router.replace('/');
  };

  return (
    <Screen
      footer={
        <>
          <Button label="Create my profile" onPress={() => router.push('/create-profile')} />
          <Button label="Skip for now" variant="secondary" onPress={skip} />
        </>
      }
    >
      <View style={styles.body}>
        <Text style={styles.name}>Gym Assist</Text>
        <Text variant="small">Log training sessions and track progress for your clients.</Text>
        <Text style={styles.question}>Do you want to track your own training too?</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: sizes.gutter, paddingTop: 200, gap: 16 },
  name: { fontSize: 32, fontFamily: 'Poppins_600SemiBold', color: colors.navy },
  question: { marginTop: 80, fontSize: sizes.title, color: colors.navy },
});
