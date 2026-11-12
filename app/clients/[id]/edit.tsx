import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';

import { type ClientRow, getClient, updateClient } from '../../../data/clients';
import { mutate, useDb, useLive } from '../../../data/live';
import { AppBar } from '../../../ui/AppBar';
import { Button } from '../../../ui/Button';
import { ClientForm, useClientForm } from '../../../ui/ClientForm';
import { Screen } from '../../../ui/Screen';

/**
 * Edit profile: the `clients/add` fields without body weight, which is changed in its own history.
 * There is no board for this screen; it follows `clients/add`.
 */
export default function EditProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useLive((db) => getClient(db, id), [id]);
  if (!client) return null;
  return <EditForm client={client} />;
}

function EditForm({ client }: { client: ClientRow }) {
  const db = useDb();
  const form = useClientForm(client);
  const saving = useRef(false);

  const save = () => {
    if (!form.valid || saving.current) return;
    saving.current = true;
    try {
      mutate(db, (tx) => updateClient(tx, client.id, form.values));
    } catch (e) {
      saving.current = false;
      throw e;
    }
    router.back();
  };

  return (
    <Screen
      header={
        <AppBar title="Edit profile" back={{ label: '‹ Profile', onPress: () => router.back() }} />
      }
      footer={<Button label="Save" onPress={save} disabled={!form.valid} />}
    >
      <ClientForm form={form} />
    </Screen>
  );
}
