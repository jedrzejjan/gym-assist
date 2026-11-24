// The dropdowns of Add exercise (boards `library / add exercise` and `- muscles open`, GYM-149).
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MultiSelect } from '../../ui/MultiSelect';
import { Select } from '../../ui/Select';

const EQUIPMENT = [
  { value: 'barbell' as const, label: 'Barbell' },
  { value: 'dumbbell' as const, label: 'Dumbbell' },
];
const MUSCLES = [
  { value: 'chest' as const, label: 'Chest' },
  { value: 'shoulders' as const, label: 'Shoulders' },
  { value: 'triceps' as const, label: 'Triceps' },
];

test('Select opens a list; choosing an option reports it and closes the list', async () => {
  const onChange = jest.fn();
  await render(<Select label="Equipment *" options={EQUIPMENT} value={null} onChange={onChange} />);
  expect(screen.queryByRole('radio', { name: 'Barbell' })).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Equipment *, -' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Barbell' }));

  expect(onChange).toHaveBeenCalledWith('barbell');
  expect(screen.queryByRole('radio', { name: 'Barbell' })).toBeNull();
});

test('Select shows the chosen option on the field and marks it in the list', async () => {
  await render(
    <Select label="Equipment *" options={EQUIPMENT} value="dumbbell" onChange={jest.fn()} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Equipment *, Dumbbell' }));
  expect(screen.getByRole('radio', { name: 'Dumbbell' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Barbell' })).not.toBeChecked();
});

test('MultiSelect applies the ticks only on Done, in the order they were ticked', async () => {
  const onChange = jest.fn();
  await render(
    <MultiSelect label="Primary muscles *" options={MUSCLES} value={[]} onChange={onChange} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Primary muscles *, -' }));
  expect(screen.getByText('Pick one or more')).toBeTruthy();

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Shoulders' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Chest' }));
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Done (2)' }));

  expect(onChange).toHaveBeenCalledWith(['shoulders', 'chest']);
  expect(screen.queryByRole('checkbox', { name: 'Chest' })).toBeNull();
});

test('MultiSelect: unticking works, and closing without Done changes nothing', async () => {
  const onChange = jest.fn();
  await render(
    <MultiSelect
      label="Primary muscles *"
      options={MUSCLES}
      value={['chest', 'triceps']}
      onChange={onChange}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Primary muscles *, Chest, Triceps' }));
  expect(screen.getByRole('checkbox', { name: 'Chest' })).toBeChecked();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Chest' }));
  expect(screen.getByRole('button', { name: 'Done (1)' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Close list' }));

  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Primary muscles *, Chest, Triceps' }));
  expect(screen.getByRole('checkbox', { name: 'Chest' })).toBeChecked();
});
