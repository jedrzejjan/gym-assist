import { render, screen } from '@testing-library/react-native';
import Home from '../index';

test('home screen shows the app name', async () => {
  await render(<Home />);
  expect(screen.getByText('Gym Assist')).toBeTruthy();
});
