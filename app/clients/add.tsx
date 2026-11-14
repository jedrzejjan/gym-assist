import { router } from 'expo-router';
import { useRef, useState } from 'react';

import { createClient } from '../../data/clients';
import { mutate, useDb } from '../../data/live';
import { todayLocal } from '../../domain/dates';
import { parseWeight } from '../../domain/sets';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { ClientForm, useClientForm } from '../../ui/ClientForm';
import { Screen } from '../../ui/Screen';

/** Board `clients/add`: first name and body weight are required (spec section 5, Clients). */
export default function AddClient() {
  const db = useDb();
  const form = useClientForm();
  const [weight, setWeight] = useState('');
  const saving = useRef(false); // a double tap must not create the client twice

  const weightKg = parseWeight(weight);
  const valid = form.valid && typeof weightKg === 'number' && weightKg > 0;

  const save = () => {
    if (!valid || saving.current) return;
    saving.current = true;
    const v = form.values;
    try {
      mutate(db, (tx) =>
        createClient(tx, {
          firstName: v.firstName,
          lastName: v.lastName ?? undefined,
          gender: v.gender ?? undefined,
          dateOfBirth: v.dateOfBirth ?? undefined,
          heightCm: v.heightCm ?? undefined,
          weightKg: weightKg as number,
          weightDate: todayLocal(new Date()),
        }),
      );
    } catch (e) {
      saving.current = false; // let the trainer try again
      throw e;
    }
    router.back();
  };

  return (
    <Screen
      header={
        <AppBar title="New client" back={{ label: '‹ Clients', onPress: () => router.back() }} />
      }
      footer={<Button label="Save client" onPress={save} disabled={!valid} />}
    >
      <ClientForm form={form} weight={{ value: weight, onChange: setWeight }} />
    </Screen>
  );
}
