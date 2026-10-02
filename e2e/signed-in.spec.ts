import { expect, test, type Page } from '@playwright/test';
import { signInTestUser } from '@huishouden/pwa-kit/e2e';

// Signed in as invented test users on the staging site (pwa-kit STANDARD.md "Staging"): the real
// staging Firestore and rules, the seeded test household. Other runs share that household, so each
// test adds an item unique to its run, looks for exactly that, and removes it again.
test.skip(!process.env.HH_STAGING_SA, 'signed-in tests run against staging, in CI');

/** The household's Groceries list; a household the seed made fresh gets the default lists first. */
async function openGroceries(page: Page) {
  const restore = page.getByRole('button', { name: 'Add the default lists' });
  const groceries = page.getByRole('button', { name: /^Groceries/ }).first();
  await expect(restore.or(groceries)).toBeVisible({ timeout: 30_000 });
  if (await restore.isVisible()) await restore.click();
  await groceries.click();
  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible();
}

test('a grocery item one member adds shows for the other, and checking it off syncs back', async ({ page, browser }) => {
  await signInTestUser(page, { email: 'test-a@example.com' });
  await openGroceries(page);
  const name = `Test oats ${Date.now().toString(36)}`;
  await page.getByLabel('New item').fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('main li', { hasText: name })).toBeVisible();

  // Saved in the household, not just on this screen: the other member's own browser shows it.
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const theirs = await other.newPage();
    await signInTestUser(theirs, { email: 'test-b@example.com' });
    await openGroceries(theirs);
    await expect(theirs.locator('main li', { hasText: name })).toBeVisible({ timeout: 20_000 });
    await theirs.getByRole('button', { name: `Mark ${name} done` }).click();
    await expect(page.getByRole('button', { name: `Mark ${name} not done` })).toBeVisible({ timeout: 20_000 });
  } finally {
    await other.close();
  }

  // Leave the shared household as it was.
  await page.locator('main li', { hasText: name }).getByRole('button', { name: `Delete ${name}` }).click();
  await expect(page.locator('main li', { hasText: name })).toHaveCount(0);
});
