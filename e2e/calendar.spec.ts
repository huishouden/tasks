import { stubGoogleTokens } from '@huishouden/pwa-kit/e2e';
import { addItem, createHousehold, expect, signIn, test } from './fixtures';

// Google Calendar has no emulator; these tests stand in its results via window.__mockCalendarEvents.
test.beforeEach(async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await page.getByRole('button', { name: /Chores & Notes/ }).first().click();
  await addItem(page, 'Get car inspected at the dealer');
  await page.getByRole('button', { name: 'Edit Get car inspected at the dealer' }).click();
});

test('picking a calendar match fills in the date, time, place and event link', async ({ page }) => {
  const start = new Date(2030, 5, 14, 10, 30).getTime();
  await page.evaluate(
    (s) =>
      (window.__mockCalendarEvents = [
        { id: 'e1', title: 'Car inspection', start: s, allDay: false, location: 'Main St Service Center', description: '', link: 'https://www.google.com/calendar/event?eid=e1', calendarName: 'Family' },
      ]),
    start,
  );
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await dialog.getByRole('button', { name: 'Find in my calendar' }).click();
  const match = dialog.getByRole('list', { name: 'Calendar matches' }).getByRole('button');
  await expect(match).toContainText('Car inspection');
  await expect(match).toContainText('Family');
  await match.click();

  await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue('2030-06-14');
  await expect(dialog.getByLabel('Time (optional)')).toHaveValue('10:30');
  await expect(dialog.getByLabel('Where')).toHaveValue('Main St Service Center');
  await dialog.getByText('List and link').click();
  await expect(dialog.getByLabel('Link')).toHaveValue('https://www.google.com/calendar/event?eid=e1');
  await dialog.getByRole('button', { name: 'Save' }).click();

  const row = page.locator('main li', { hasText: 'Get car inspected' });
  await expect(row).toContainText(/Jun 14.*10:30/);
  await expect(row.getByRole('link', { name: 'Open in Calendar' })).toBeVisible();
});

test('says so when nothing matches', async ({ page }) => {
  await page.evaluate(() => (window.__mockCalendarEvents = []));
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await dialog.getByRole('button', { name: 'Find in my calendar' }).click();
  await expect(dialog.getByRole('status')).toContainText('No events matching');
});

test('a closed Google window is explained, with Try again', async ({ page }) => {
  // Google Identity Services, stood in by the kit: the person closes the permission window.
  await stubGoogleTokens(page, { fail: 'popup_closed' });
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await dialog.getByRole('button', { name: 'Find in my calendar' }).click();
  const alert = dialog.getByRole('alert');
  await expect(alert).toContainText('Calendar access was not allowed');
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
});
