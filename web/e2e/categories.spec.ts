import { addItem, createHousehold, expect, signIn, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
});

test('common foods and typos land in the right aisle', async ({ page }) => {
  for (const item of ['watermelon', 'papaya', 'tilapia', 'zuchini']) await addItem(page, item);
  await expect(page.locator('main li', { hasText: 'watermelon' })).toContainText('Produce & Greens');
  await expect(page.locator('main li', { hasText: 'papaya' })).toContainText('Produce & Greens');
  await expect(page.locator('main li', { hasText: 'tilapia' })).toContainText('Meat & Seafood');
  await expect(page.locator('main li', { hasText: 'zuchini' })).toContainText('Produce & Greens');
});

test('Gemini places what the word list cannot', async ({ page }) => {
  await page.evaluate(() => (window.__mockCategory = 'Produce & Greens'));
  await addItem(page, 'kohlrabi');
  await expect(page.locator('main li', { hasText: 'kohlrabi' })).toContainText('Produce & Greens');
});

test('an aisle you correct is remembered for next time', async ({ page }) => {
  await addItem(page, 'Crepe mix');
  await page.getByRole('button', { name: 'Edit Crepe mix' }).click();
  await page.getByRole('dialog').getByLabel('Aisle').selectOption('Pantry & Dry Goods');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Mark Crepe mix done' }).click();

  await addItem(page, 'crepe mix');
  await expect(page.getByRole('button', { name: 'Mark Crepe mix done' })).toBeVisible();
  await expect(page.locator('main li', { hasText: 'Crepe mix' }).first()).toContainText('Pantry & Dry Goods');
});

test('a misspelling suggests the saved spelling', async ({ page }) => {
  await addItem(page, 'Zucchini');
  await page.getByLabel('New item').fill('zuchini');
  await expect(page.locator('ul.absolute li')).toContainText(['Zucchini']);
});
