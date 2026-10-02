import { devices } from '@playwright/test';
import { addItem, createHousehold, expect, signIn, slowNetwork, test, watchErrors } from './fixtures';

test('a new household opens its lists even on a slow connection', async ({ context, page }) => {
  // Regression: the lists subscribed before the server acknowledged the household, were refused
  // by the rules, and the screen spun forever.
  const errors = watchErrors(page);
  await signIn(page, 'alice@example.com', 'Alice Example');
  await slowNetwork(context, page, 800);
  // Several round trips at 800 ms each: allow for them rather than the default 5 s.
  await createHousehold(page, 15_000);
  await expect(page.locator('nav[aria-label="Lists"] button')).toHaveText([
    'Groceries',
    'Pantry Restock',
    'Costco & Bulk',
    'Hardware & Home',
    'Chores & Notes',
    'New list',
    'Reorder lists',
  ]);
  expect(errors.filter((e) => e.includes('permission-denied'))).toEqual([]);
});

test('items get an aisle, urgency and quantity', async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await addItem(page, 'Whole milk');
  await addItem(page, 'Tortilla chips');
  await page.getByLabel('New item').fill('Coffee beans');
  await page.getByRole('button', { name: 'More details' }).click();
  await page.getByRole('button', { name: /Need Today/ }).click();
  await page.getByPlaceholder('1, 2 lbs, a dozen').fill('2 bags');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const rows = page.locator('main ul > li');
  await expect(rows.first()).toContainText('Coffee beans');
  await expect(rows.first()).toContainText('Today');
  await expect(rows.first()).toContainText('2 bags · Beverages & Coffee · Alice');
  await expect(page.locator('main li', { hasText: 'Whole milk' })).toContainText('Dairy & Eggs');
  await expect(page.locator('main li', { hasText: 'Tortilla chips' })).toContainText('Snacks & Sweets');
});

test('an invited member sees the same lists and changes sync both ways', async ({ browser, page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await addItem(page, 'Eggs');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByPlaceholder('their.gmail@gmail.com').fill('bob@example.com');
  await page.getByRole('button', { name: 'Add member' }).click();
  const bobRow = page.locator('li', { hasText: 'bob@example.com' });
  await expect(bobRow).toContainText('Invited, not signed in yet');
  await expect(bobRow.getByRole('button', { name: 'Send invite to bob@example.com' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  const phone = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://localhost:5173' });
  const bob = await phone.newPage();
  await signIn(bob, 'bob@example.com', 'Bob Example');
  await expect(bob.getByRole('heading', { name: 'Groceries' })).toBeVisible();
  await expect(bob.locator('main li', { hasText: 'Eggs' })).toBeVisible();

  await addItem(bob, 'Diapers');
  await expect(page.locator('main li', { hasText: 'Diapers' })).toContainText('Bob');

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('li', { hasText: 'bob@example.com' })).toContainText('Joined');
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Mark Eggs done' }).click();
  await expect(bob.getByRole('button', { name: 'Mark Eggs not done' })).toBeVisible();
  await phone.close();
});

test('someone not in the household cannot see it', async ({ browser, page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await addItem(page, 'Secret item');

  const other = await browser.newContext({ baseURL: 'http://localhost:5173' });
  const mallory = await other.newPage();
  await signIn(mallory, 'mallory@example.com', 'Mallory');
  await expect(mallory.getByText('Joining someone?')).toBeVisible();
  await expect(mallory.getByText('Secret item')).toHaveCount(0);
  await other.close();
});
