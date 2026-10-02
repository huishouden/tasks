import { expect, test } from '@playwright/test';
import { expectCleanLoad, expectGoogleSignInPopup, expectHuishoudenFrame, expectInstallable } from '@huishouden/pwa-kit/e2e';

// Smoke tests of the deployed site (the kit runs them after every deploy with BASE_URL set).
// Read-only: they stop at Google's account picker and never sign in or write data.

test('loads with no runtime errors', async ({ page }) => {
  await expectCleanLoad(page);
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('is installable with the suite name and icons', async ({ page, request }) => {
  await expectInstallable(page, request);
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Huishouden Tasks', short_name: 'Tasks', description: 'Shared lists and chores' });
});

test('Google sign-in is reachable for this domain', async ({ page, context }) => {
  await expectGoogleSignInPopup(page, context, (p) => p.getByRole('button', { name: 'Sign in with Google' }).click());
});

test('opens in the Huishouden frame', async ({ page }) => {
  await expectHuishoudenFrame(page, { app: 'Tasks', portalUrl: 'https://huishouden-piekstra.web.app', path: '/' });
});

test('a shared link shows a preview', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', 'Shared lists and chores');
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toBe('https://huishouden-tasks.web.app/og.png');
  expect((await request.get('/og.png')).ok()).toBe(true);
});
