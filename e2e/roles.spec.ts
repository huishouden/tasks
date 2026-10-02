import { addItem, createHousehold, expect, signIn, test, watchErrors } from './fixtures';

// Against the household's real rules (fetched from huishouden/rules): what the app hides, the rules
// refuse too. SCREENSHOT_DIR keeps the helper's screens for a PR's before and after.
const shots = process.env.SCREENSHOT_DIR;

test('a helper ticks off anyone’s items and changes only their own; settings are for admins and members', async ({ browser, page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await addItem(page, 'Eggs');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByPlaceholder('Their Google account email').fill('helen@example.com');
  await page.getByLabel('Their role').selectOption('helper');
  await page.getByRole('button', { name: 'Add member' }).click();
  await expect(page.getByLabel('Role for helen@example.com')).toHaveValue('helper');
  if (shots) await page.screenshot({ path: `${shots}/tasks-settings-admin.png` });
  await page.getByRole('button', { name: 'Close' }).click();

  const tablet = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: { width: 1280, height: 800 } });
  const helen = await tablet.newPage();
  const errors = watchErrors(helen);
  await signIn(helen, 'helen@example.com', 'Helen Example');
  const eggs = helen.locator('main li', { hasText: 'Eggs' });
  await expect(eggs).toBeVisible();

  // Refused, so not offered: changing Alice's item, and setting up lists.
  await expect(helen.getByRole('button', { name: 'Delete Eggs' })).toHaveCount(0);
  await expect(helen.getByRole('button', { name: 'New list' })).toHaveCount(0);
  await expect(helen.getByRole('button', { name: 'Delete list' })).toHaveCount(0);
  await expect(helen.getByText('Only admins and members can change settings.')).toBeVisible();

  // Permitted: adding her own, which she can delete, and ticking off Alice's.
  await addItem(helen, 'Juice');
  await expect(helen.getByRole('button', { name: 'Delete Juice' })).toBeVisible();
  await helen.getByRole('button', { name: 'Mark Eggs done' }).click();
  await expect(page.getByRole('button', { name: 'Mark Eggs not done' })).toBeVisible();
  if (shots) await helen.screenshot({ path: `${shots}/tasks-helper-lists.png` });

  await helen.getByRole('button', { name: 'Settings' }).click();
  await expect(helen.getByText('Only admins can invite or remove people and set roles.')).toBeVisible();
  await expect(helen.getByRole('button', { name: 'Add member' })).toHaveCount(0);
  if (shots) await helen.screenshot({ path: `${shots}/tasks-helper-settings.png` });
  await helen.getByRole('button', { name: 'Close' }).click();

  await helen.getByRole('button', { name: 'Meals', exact: true }).click();
  await expect(helen.getByText('Only admins and members can suggest, save and plan meals.')).toBeVisible();
  if (shots) await helen.screenshot({ path: `${shots}/tasks-helper-meals.png` });

  await helen.getByRole('button', { name: 'Lists', exact: true }).click();
  await helen.getByRole('button', { name: 'Delete Juice' }).click();
  await expect(helen.locator('main li', { hasText: 'Juice' })).toHaveCount(0);
  expect(errors.filter((e) => e.includes('permission-denied') || e.includes('PERMISSION_DENIED'))).toEqual([]);
  await tablet.close();
});
