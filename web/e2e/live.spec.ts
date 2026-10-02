import { expect, test } from '@playwright/test';

// Smoke test of the deployed site. Read-only: it stops at Google's account picker and never
// signs in, so it is safe to run after every deploy.

test('the deployed app loads with its Firebase config and offline worker', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const config = await (await request.get('/__/firebase/init.json')).json();
  expect(config.projectId).toBe('huishouden-piekstra');

  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).name).toBe('HearthList');

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r))).toBe(true);
  expect(errors).toEqual([]);
});

test('Google sign-in is allowed for this domain', async ({ page }) => {
  await page.goto('/');
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  const picker = await popup;
  // An unauthorized domain or disabled provider closes the popup and shows an error instead.
  await expect.poll(() => (picker.isClosed() ? 'closed' : new URL(picker.url()).host), { timeout: 15_000 }).toBe('accounts.google.com');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
