import { addItem, createHousehold, expect, signIn, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  for (const item of ['Ice cream', 'Bananas', 'Whole milk']) await addItem(page, item);
});

test('store mode walks aisles in store order and tracks progress', async ({ page }) => {
  await page.getByRole('button', { name: 'Store', exact: true }).click();
  await expect(page.locator('main h2, h2').filter({ hasText: /left/ })).toHaveText([
    /Produce & Greens/,
    /Dairy & Eggs/,
    /Frozen Foods/,
  ]);
  await page.getByRole('button', { name: 'Mark Bananas done' }).click();
  await expect(page.getByText('1 of 3 in cart')).toBeVisible();
  await page.getByRole('button', { name: 'Clear 1 checked item' }).click();
  await expect(page.getByText('0 of 2 in cart')).toBeVisible();
});

test('kitchen mode lists what is needed and adds from the large bar', async ({ page }) => {
  await page.getByRole('button', { name: 'Kitchen' }).click();
  await expect(page.getByRole('heading', { name: /Groceries\s*3 to get/ })).toBeVisible();
  await page.getByLabel('New item').fill('Eggs');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Groceries\s*4 to get/ })).toBeVisible();
});

test('staples appear after an item is bought twice, keeping its first spelling', async ({ page }) => {
  await page.getByRole('button', { name: 'Mark Whole milk done' }).click();
  await addItem(page, 'whole milk');
  await page.getByRole('button', { name: 'Mark Whole milk done' }).click();
  await expect(page.locator('section[aria-label="Frequent items"] button')).toHaveText(['Whole milk']);

  await page.getByLabel('New item').fill('mi');
  await expect(page.locator('ul.absolute li')).toContainText(['Whole milk']);
});
