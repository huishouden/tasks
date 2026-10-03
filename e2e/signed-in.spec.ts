import { expect, test, type Page } from '@playwright/test';
import { runPortalTodo, signInTestUser } from '@huishouden/pwa-kit/e2e';
import { seedTestHousehold } from '@huishouden/pwa-kit/staging';

// Signed in as invented test users on the staging site (pwa-kit STANDARD.md "Staging"): the real
// staging Firestore and rules, the seeded test household. Other runs share that household, so each
// test adds an item unique to its run, looks for exactly that, and removes it again.
test.skip(!process.env.HH_STAGING_SA, 'signed-in tests run against staging, in CI');

// Another app's run may have reseeded the household with an older kit, without the helper.
test.beforeAll(async () => {
  await seedTestHousehold({ accessToken: process.env.HH_STAGING_ACCESS_TOKEN! });
});

/** The household's Chores & Notes list; a household the seed made fresh gets the default lists first. */
async function openChores(page: Page) {
  const restore = page.getByRole('button', { name: 'Add the default lists' });
  const chores = page.getByRole('button', { name: /^Chores & Notes/ }).first();
  await expect(restore.or(chores)).toBeVisible({ timeout: 30_000 });
  if (await restore.isVisible()) await restore.click();
  await chores.click();
  await expect(page.getByRole('heading', { name: 'Chores & Notes' })).toBeVisible();
}

test('a to-do one member adds shows for the other, and checking it off syncs back', async ({ page, browser }) => {
  await signInTestUser(page, { email: 'test-a@example.com' });
  await openChores(page);
  const name = `Test call the plumber ${Date.now().toString(36)}`;
  await page.getByLabel('New item').fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('main li', { hasText: name })).toBeVisible();

  // Saved in the household, not just on this screen: the other member's own browser shows it.
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const theirs = await other.newPage();
    await signInTestUser(theirs, { email: 'test-b@example.com' });
    await openChores(theirs);
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

test('a helper ticks off a member’s item and adds their own, but can’t delete the member’s or set up lists', async ({ page, browser }) => {
  await signInTestUser(page, { email: 'test-a@example.com' });
  await openChores(page);
  const theirs = `Test water the plants ${Date.now().toString(36)}`;
  await page.getByLabel('New item').fill(theirs);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('main li', { hasText: theirs })).toBeVisible();

  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const helper = await other.newPage();
    await signInTestUser(helper, { email: 'test-helper@example.com' });
    await openChores(helper);
    await expect(helper.locator('main li', { hasText: theirs })).toBeVisible({ timeout: 20_000 });
    // Refused: deleting test-a's item and setting up lists; the reason is shown where lists are set up.
    await expect(helper.getByRole('button', { name: `Delete ${theirs}` })).toHaveCount(0);
    await expect(helper.getByRole('button', { name: 'New list' })).toHaveCount(0);
    await expect(helper.getByText('Only admins and members can change settings.')).toBeVisible();
    // Permitted: ticking test-a's item off, and adding and deleting one of their own.
    await helper.getByRole('button', { name: `Mark ${theirs} done` }).click();
    await expect(page.getByRole('button', { name: `Mark ${theirs} not done` })).toBeVisible({ timeout: 20_000 });
    const mine = `Test feed the cat ${Date.now().toString(36)}`;
    await helper.getByLabel('New item').fill(mine);
    await helper.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('main li', { hasText: mine })).toBeVisible({ timeout: 20_000 });
    await helper.getByRole('button', { name: `Delete ${mine}` }).click();
    await expect(page.locator('main li', { hasText: mine })).toHaveCount(0, { timeout: 20_000 });
  } finally {
    await other.close();
  }

  await page.locator('main li', { hasText: theirs }).getByRole('button', { name: `Delete ${theirs}` }).click();
  await expect(page.locator('main li', { hasText: theirs })).toHaveCount(0);
});

test('Done and Cancel on the portal’s To-do list close the item in Tasks', async ({ page, context }) => {
  await signInTestUser(page, { email: 'test-a@example.com' });
  await openChores(page);
  const run = Date.now().toString(36);
  const done = `Test book the window cleaner ${run}`;
  const cancelled = `Test sort the recycling ${run}`;
  for (const name of [done, cancelled]) {
    await page.getByLabel('New item').fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('main li', { hasText: name })).toBeVisible();
  }
  try {
    // Tasks stays open here, publishing a few seconds after the change; the portal (at the site's
    // root) runs in a second tab of the same signed-in browser.
    const portal = await context.newPage();
    try {
      await runPortalTodo(portal, done);
      await runPortalTodo(portal, cancelled, { action: 'cancel' });
    } finally {
      await portal.close();
    }
    await expect(page.getByRole('button', { name: `Mark ${done} not done` })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('main li', { hasText: done })).not.toContainText('Cancelled');
    await expect(page.getByRole('button', { name: `Restore ${cancelled}` })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('main li', { hasText: cancelled })).toContainText('Cancelled');
  } finally {
    // Leave the shared household as it was.
    for (const name of [done, cancelled]) {
      const remove = page.locator('main li', { hasText: name }).getByRole('button', { name: `Delete ${name}` });
      if (await remove.count()) await remove.first().click();
      await expect(page.locator('main li', { hasText: name })).toHaveCount(0);
    }
  }
});
