import { BackHandler, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Screen } from './Screen';
import { Text } from './Text';
import { sizes } from './theme';

/** Board `app/error - migration failed`: shown instead of the app when an update fails. */
export function MigrationError({ error }: { error: string }) {
  return (
    <Screen footer={<Button label="Close app" onPress={() => BackHandler.exitApp()} />}>
      <View style={styles.body}>
        <Text variant="title">The update could not finish</Text>
        <Text>
          Your data is safe: the app restored the copy it made before the update. Please report this
          problem, then try again after the next update.
        </Text>
        <Text variant="small">{`Error: ${error}`}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: sizes.gutter, paddingTop: 160, gap: 24 },
});
