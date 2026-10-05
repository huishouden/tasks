import { expect, test, type Page } from '@playwright/test';
import { runPortalTodo, useTestHousehold } from '@huishouden/pwa-kit/e2e';

// Signed in as the invented people of a household of this run's own (pwa-kit STANDARD.md
// "Staging"), against the real rules: on the emulators (`bun run e2e:emulator`), and on
// staging for what needs the suite's site (@staging) or a kit bump (@smoke).
const hh = useTestHousehold(test);

/** The household's Chores & Notes list; the household starts empty, so the first visit adds the default lists. */
async function openChores(page: Page) {
  const restore = page.getByRole('button', { name: 'Add the default lists' });
  const chores = page.getByRole('button', { name: /^Chores & Notes/ }).first();
  await expect(restore.or(chores)).toBeVisible({ timeout: 30_000 });
  if (await restore.isVisible()) await restore.click();
  await chores.click();
  await expect(page.getByRole('heading', { name: 'Chores & Notes' })).toBeVisible();
}

async function addItem(page: Page, name: string) {
  await page.getByLabel('New item').fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('main li', { hasText: name })).toBeVisible();
}

test('a to-do one member adds shows for the other, and checking it off syncs back', { tag: '@smoke' }, async ({ browser }) => {
  const page = await hh.open(browser, 'admin');
  await openChores(page);
  const name = 'Test call the plumber';
  await addItem(page, name);

  // Saved in the household, not just on this screen: the other member's own browser shows it.
  const theirs = await hh.open(browser, 'member');
  await openChores(theirs);
  await expect(theirs.locator('main li', { hasText: name })).toBeVisible({ timeout: 20_000 });
  await theirs.getByRole('button', { name: `Mark ${name} done` }).click();
  await expect(page.getByRole('button', { name: `Mark ${name} not done` })).toBeVisible({ timeout: 20_000 });
});

test('a helper ticks off a member’s item and adds their own, but can’t delete the member’s or set up lists', async ({ browser }) => {
  const page = await hh.open(browser, 'admin');
  await openChores(page);
  const theirs = 'Test water the plants';
  await addItem(page, theirs);

  const helper = await hh.open(browser, 'helper');
  await openChores(helper);
  await expect(helper.locator('main li', { hasText: theirs })).toBeVisible({ timeout: 20_000 });
  // Refused: deleting the admin's item and setting up lists; the reason is shown where lists are set up.
  await expect(helper.getByRole('button', { name: `Delete ${theirs}` })).toHaveCount(0);
  await expect(helper.getByRole('button', { name: 'New list' })).toHaveCount(0);
  await expect(helper.getByText('Only admins and members can change settings.')).toBeVisible();
  // Permitted: ticking the admin's item off, and adding and deleting one of their own.
  await helper.getByRole('button', { name: `Mark ${theirs} done` }).click();
  await expect(page.getByRole('button', { name: `Mark ${theirs} not done` })).toBeVisible({ timeout: 20_000 });
  const mine = 'Test feed the cat';
  await addItem(helper, mine);
  await expect(page.locator('main li', { hasText: mine })).toBeVisible({ timeout: 20_000 });
  await helper.getByRole('button', { name: `Delete ${mine}` }).click();
  await expect(page.locator('main li', { hasText: mine })).toHaveCount(0, { timeout: 20_000 });
});

// @staging: the portal's To-do list is another app on the suite's site.
test('Done and Cancel on the portal’s To-do list close the item in Tasks', { tag: '@staging' }, async ({ browser }) => {
  // Two trips through the portal, each waiting for Tasks to publish.
  test.setTimeout(210_000);
  const page = await hh.open(browser, 'admin');
  await openChores(page);
  const done = 'Test book the window cleaner';
  const cancelled = 'Test sort the recycling';
  for (const name of [done, cancelled]) await addItem(page, name);

  // Tasks stays open here, publishing a few seconds after the change; the portal (at the site's
  // root) runs in a second tab of the same signed-in browser. A minute each leaves room for a
  // second publish should the first one fail (the next change publishes again).
  const portal = await hh.open(browser, 'admin', 'about:blank');
  await runPortalTodo(portal, done, { timeout: 60_000 });
  await runPortalTodo(portal, cancelled, { action: 'cancel', timeout: 60_000 });
  await expect(page.getByRole('button', { name: `Mark ${done} not done` })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('main li', { hasText: done })).not.toContainText('Cancelled');
  await expect(page.getByRole('button', { name: `Restore ${cancelled}` })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('main li', { hasText: cancelled })).toContainText('Cancelled');
});
