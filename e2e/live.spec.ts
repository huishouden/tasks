import { expect, test } from '@playwright/test';
import { expectCleanLoad, expectGoogleSignInPopup, expectInstallable } from '@huishouden/pwa-kit/e2e';

// Smoke tests of the deployed site (the kit runs them after every deploy with BASE_URL set).
// Read-only: they stop at Google's account picker and never sign in or write data.

test('loads with no runtime errors', async ({ page }) => {
  await expectCleanLoad(page);
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('is installable with the suite name and icons', async ({ page, request }) => {
  await expectInstallable(page, request);
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Huishouden Tasks', short_name: 'Tasks' });
});

test('Google sign-in is reachable for this domain', async ({ page, context }) => {
  await expectGoogleSignInPopup(page, context, (p) => p.getByRole('button', { name: 'Sign in with Google' }).click());
});

test('uses the Huishouden frame: cream page and the suite name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Huishouden', { exact: true })).toBeVisible();
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe('rgb(250, 249, 245)');
});
