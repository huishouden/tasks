import type { Page } from '@playwright/test';
import { addItem, createHousehold, expect, signIn, test, watchErrors } from './fixtures';

let errors: string[] = [];

async function names(page: Page): Promise<string[]> {
  return page.locator('main ul > li').evaluateAll((rows) => rows.map((r) => r.querySelector('.font-medium')?.textContent ?? ''));
}

const undoBar = (page: Page) => page.getByRole('status').filter({ has: page.getByRole('button', { name: 'Undo' }) });

test.beforeEach(async ({ page }) => {
  errors = watchErrors(page);
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  for (const item of ['Apples', 'Bread', 'Cheese']) await addItem(page, item);
  await expect.poll(() => names(page)).toEqual(['Apples', 'Bread', 'Cheese']);
});

test.afterEach(() => {
  // A restore the rules refused would only show up as a console error.
  expect(errors.filter((e) => e.includes('permission-denied'))).toEqual([]);
});

test('undoing a row delete brings the item back in place with its details', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Bread' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await dialog.getByLabel('Notes', { exact: true }).fill('sourdough');
  await dialog.getByRole('button', { name: 'Need today' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main li', { hasText: 'Bread' })).toContainText('sourdough');

  await page.getByRole('button', { name: 'Delete Bread' }).click();
  await expect(undoBar(page)).toContainText('Deleted "Bread"');
  await expect.poll(() => names(page)).toEqual(['Apples', 'Cheese']);

  await undoBar(page).getByRole('button', { name: 'Undo' }).click();
  await expect(undoBar(page)).toHaveCount(0);
  await expect.poll(() => names(page)).toEqual(['Apples', 'Bread', 'Cheese']);
  await expect(page.locator('main li', { hasText: 'Bread' })).toContainText('sourdough');

  // Restored on the server too, not just in this tab's cache.
  await page.reload();
  await expect.poll(() => names(page)).toEqual(['Apples', 'Bread', 'Cheese']);
  await expect(page.locator('main li', { hasText: 'Bread' })).toContainText('sourdough');
});

test('undoing a delete from the edit dialog brings the item back', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Cheese' }).click();
  await page.getByRole('dialog', { name: 'Edit task' }).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(undoBar(page)).toContainText('Deleted "Cheese"');
  await expect.poll(() => names(page)).toEqual(['Apples', 'Bread']);

  await undoBar(page).getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => names(page)).toEqual(['Apples', 'Bread', 'Cheese']);
});

test('cancelling a task moves it to Done marked Cancelled; Undo and un-ticking take it back up', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Bread' }).click();
  await page.getByRole('dialog', { name: 'Edit task' }).getByRole('button', { name: 'Cancel task' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(undoBar(page)).toContainText('Cancelled "Bread"');
  const row = page.locator('main li', { hasText: 'Bread' });
  await expect(row).toContainText('Cancelled');
  await expect(page.getByRole('button', { name: 'Done (1)' })).toBeVisible();

  await undoBar(page).getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Mark Bread done' })).toBeVisible();
  await expect(row).not.toContainText('Cancelled');

  // Cancelled again and kept (on the server too), then restored with its tick.
  await page.getByRole('button', { name: 'Edit Bread' }).click();
  await page.getByRole('dialog', { name: 'Edit task' }).getByRole('button', { name: 'Cancel task' }).click();
  await page.reload();
  await expect(page.locator('main li', { hasText: 'Bread' })).toContainText('Cancelled');
  await page.getByRole('button', { name: 'Restore Bread' }).click();
  await expect(page.getByRole('button', { name: 'Mark Bread done' })).toBeVisible();
  // Ticked off afterwards, it is done, not cancelled.
  await page.getByRole('button', { name: 'Mark Bread done' }).click();
  await expect(page.getByRole('button', { name: 'Mark Bread not done' })).toBeVisible();
  await expect(page.locator('main li', { hasText: 'Bread' })).not.toContainText('Cancelled');
});

test('undoing Clear done restores the items as done', async ({ page }) => {
  await page.getByRole('button', { name: 'Mark Apples done' }).click();
  await page.getByRole('button', { name: 'Mark Cheese done' }).click();
  await expect(page.getByRole('button', { name: 'Done (2)' })).toBeVisible();

  await page.getByRole('button', { name: 'Clear done' }).click();
  await expect(undoBar(page)).toContainText('Cleared 2 done items');
  await expect(page.getByRole('button', { name: /^Done \(/ })).toHaveCount(0);

  await undoBar(page).getByRole('button', { name: 'Undo' }).click();
  // The Done section is open by default, so the restored items show without expanding it.
  await expect(page.getByRole('button', { name: 'Done (2)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Apples not done' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Cheese not done' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Bread done' })).toBeVisible();
});

test('a newer delete replaces the bar, and Undo restores only that one', async ({ page }) => {
  await page.getByRole('button', { name: 'Delete Apples' }).click();
  await expect(undoBar(page)).toContainText('Deleted "Apples"');
  await page.getByRole('button', { name: 'Delete Cheese' }).click();
  await expect(undoBar(page)).toHaveCount(1);
  await expect(undoBar(page)).toContainText('Deleted "Cheese"');

  await undoBar(page).getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => names(page)).toEqual(['Bread', 'Cheese']);
});

test('without Undo the bar goes away and the delete sticks', async ({ page }) => {
  await page.getByRole('button', { name: 'Delete Bread' }).click();
  await expect(undoBar(page)).toContainText('Deleted "Bread"');
  await page.waitForTimeout(4_000);
  await expect(undoBar(page)).toBeVisible();
  await expect(undoBar(page)).toHaveCount(0, { timeout: 4_000 });

  await page.reload();
  await expect.poll(() => names(page)).toEqual(['Apples', 'Cheese']);
});
