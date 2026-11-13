/**
 * @jest-environment node
 *
 * Android Auto Backup copies the app's data, the database included, to the trainer's Google
 * account (spec section 5, Backup plan; Sprint 2 plan, decision 11). Expo turns it on by default;
 * app.json says so explicitly, and this test keeps anyone from switching it off by accident.
 */
import appJson from '../app.json';

test('app.json keeps android.allowBackup true', () => {
  expect(appJson.expo.android.allowBackup).toBe(true);
});
