import { expect, test } from '@playwright/test';
import { expectCleanLoad, expectCompactSampleBanner, expectGoogleSignInPopup, expectHuishoudenFrame, expectInstallable, expectSecurityHeaders, expectThemeConsistent, openAppSettings } from '@huishouden/pwa-kit/e2e';

// Smoke tests of the deployed site (the kit runs them after every deploy with BASE_URL set).
// Read-only: they stop at Google's account picker and never sign in or write data.

test('loads with no runtime errors', async ({ page }) => {
  await expectCleanLoad(page);
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('is installable with the suite name and icons', async ({ page, request }) => {
  await expectInstallable(page, request);
  const manifest = await (await request.get('manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Huishouden Tasks', short_name: 'Tasks', description: 'Shared to-dos and chores' });
});

test('Google sign-in is reachable for this domain', async ({ page, context }) => {
  await expectGoogleSignInPopup(page, context, (p) => p.getByRole('button', { name: 'Sign in with Google' }).click());
});

test('opens in the Huishouden frame', async ({ page }) => {
  await expectHuishoudenFrame(page, { app: 'Tasks', portalUrl: '/', path: './' });
});

test('a shared link shows a preview', async ({ page, request }) => {
  await page.goto('./');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', 'Shared to-dos and chores');
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toBe('https://huishouden-piekstra.web.app/tasks/og.png');
  expect((await request.get('og.png')).ok()).toBe(true);
});

test('signed out, it opens on the invented sample household', async ({ page }) => {
  const firestore: string[] = [];
  page.on('request', (r) => r.url().includes('firestore.googleapis.com') && firestore.push(r.url()));
  await page.goto('./');
  await expect(page.getByText('Sample data')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Chores & Notes' })).toBeVisible();
  await page.getByLabel('New item').fill('Sample errand');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('main li', { hasText: 'Sample errand' })).toBeVisible();
  // The sample never reaches a server.
  expect(firestore).toEqual([]);
});

test('sends the security headers and leaves sign-in un-framed', ({ request }) => expectSecurityHeaders(request, './', { geolocation: true }));

test('signed out, the Sample data banner is one line on a phone', ({ page }) => expectCompactSampleBanner(page, './'));

test('follows the suite theme: dark on a dark device, readable', ({ page }) => expectThemeConsistent(page, { path: './' }));

test("the theme is the app bar's, for the whole suite; Tasks settings have none of their own", async ({ page }) => {
  await page.goto('./');
  await openAppSettings(page, 'Tasks settings');
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('group', { name: 'Theme' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);

  const bar = page.locator('hh-app-bar');
  await bar.locator('[data-trigger]').click();
  const theme = bar.getByRole('group', { name: 'Theme' });
  await expect(theme.getByRole('button')).toHaveText(['Automatic', 'Light', 'Dark']);
  await theme.getByRole('button', { name: 'Dark' }).click();
  await expect(theme.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem('hh-theme'))).toBe('dark');
  await theme.getByRole('button', { name: 'Light' }).click();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
});
