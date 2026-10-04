import { devices } from '@playwright/test';
import { addItem, createHousehold, expect, readHouseholdCollection, signIn, slowNetwork, test, watchErrors } from './fixtures';
import { openAppSettings } from '@huishouden/pwa-kit/e2e';

test('a new household opens its to-do lists even on a slow connection, with the shopping lists made for Groceries', async ({ context, page }) => {
  // Regression: the lists subscribed before the server acknowledged the household, were refused
  // by the rules, and the screen spun forever.
  const errors = watchErrors(page);
  await signIn(page, 'alice@example.com', 'Alice Example');
  await slowNetwork(context, page, 800);
  // Several round trips at 800 ms each: allow for them rather than the default 5 s.
  await createHousehold(page, 15_000);
  await expect(page.locator('nav[aria-label="Lists"] button')).toHaveText(['Chores & Notes', 'New list']);
  await expect(page.locator('nav[aria-label="Lists"]').getByRole('link', { name: 'Shopping lists are in Groceries' })).toHaveAttribute('href', '/groceries/');
  // The household starts with every default list, so Groceries opens ready too.
  expect((await readHouseholdCollection('lists')).map((l) => l.name).sort()).toEqual(['Chores & Notes', 'Costco & Bulk', 'Groceries', 'Hardware & Home', 'Pantry Restock']);
  expect(errors.filter((e) => e.includes('permission-denied'))).toEqual([]);
});

test('a to-do takes notes and Need today, and is stored as a chore', async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await addItem(page, 'Water the plants');
  await page.getByLabel('New item').fill('Renew the car registration');
  await page.getByRole('button', { name: 'More details' }).click();
  await page.getByRole('button', { name: /Need Today/ }).click();
  await page.getByPlaceholder('Ticket number, what to bring…').fill('Bring the insurance card');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const rows = page.locator('main ul > li');
  await expect(rows.first()).toContainText('Renew the car registration');
  await expect(rows.first()).toContainText('Today');
  await expect(rows.first()).toContainText('Bring the insurance card · Alice');
  // One document shape for both apps: Tasks' items are chores, with no quantity or section to set.
  await expect.poll(async () => (await readHouseholdCollection('items')).map((i) => i.category)).toEqual(['Chores & Tasks', 'Chores & Tasks']);
  await expect(page.getByPlaceholder('1, 2 lbs, a dozen')).toHaveCount(0);
});

test('an invited member sees the same lists and changes sync both ways', async ({ browser, page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await addItem(page, 'Take out the bins');

  await openAppSettings(page, 'Tasks settings');
  await page.getByPlaceholder('Their Google account email').fill('bob@example.com');
  await page.getByRole('button', { name: 'Add member' }).click();
  const bobRow = page.locator('li', { hasText: 'bob@example.com' });
  await expect(bobRow).toContainText('Invited, not signed in yet');
  await expect(bobRow.getByRole('button', { name: 'Send invite to bob@example.com' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  const phone = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://localhost:5173/tasks/' });
  const bob = await phone.newPage();
  await signIn(bob, 'bob@example.com', 'Bob Example');
  await expect(bob.getByRole('heading', { name: 'Chores & Notes' })).toBeVisible();
  await expect(bob.locator('main li', { hasText: 'Take out the bins' })).toBeVisible();

  await addItem(bob, 'Book the vet');
  await expect(page.locator('main li', { hasText: 'Book the vet' })).toContainText('Bob');

  await openAppSettings(page, 'Tasks settings');
  await expect(page.locator('li', { hasText: 'bob@example.com' })).toContainText('Joined');
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Mark Take out the bins done' }).click();
  await expect(bob.getByRole('button', { name: 'Mark Take out the bins not done' })).toBeVisible();
  await phone.close();
});

test('someone not in the household cannot see it', async ({ browser, page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await addItem(page, 'Secret item');

  const other = await browser.newContext({ baseURL: 'http://localhost:5173/tasks/' });
  const mallory = await other.newPage();
  await signIn(mallory, 'mallory@example.com', 'Mallory');
  await expect(mallory.getByText('Joining someone?')).toBeVisible();
  await expect(mallory.getByText('Secret item')).toHaveCount(0);
  await other.close();
});
