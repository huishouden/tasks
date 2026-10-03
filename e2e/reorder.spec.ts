import type { Page } from '@playwright/test';
import { addItem, createHousehold, expect, signIn, test } from './fixtures';

async function names(page: Page): Promise<string[]> {
  return page.locator('main ul > li').evaluateAll((rows) => rows.map((r) => r.querySelector('.font-medium')?.textContent ?? ''));
}

/** Drags with small pointer steps, the way a finger or mouse does; dnd-kit ignores instant jumps. */
async function drag(page: Page, item: string, onto: string): Promise<void> {
  const from = await page.getByRole('button', { name: `Move ${item}` }).boundingBox();
  const to = await page.getByRole('button', { name: `Move ${onto}` }).boundingBox();
  if (!from || !to) throw new Error('drag handles not visible');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 8, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}

/**
 * Space picks the item up, each arrow moves it one row, Space drops it. Waits out dnd-kit's
 * ~250 ms row animation between keys, because the keyboard sensor measures rows as they are.
 */
async function moveWithKeyboard(page: Page, item: string, rows: number): Promise<void> {
  const settle = () => page.waitForTimeout(350);
  await page.getByRole('button', { name: `Move ${item}` }).focus();
  await settle();
  await page.keyboard.press('Space');
  await settle();
  for (let i = 0; i < Math.abs(rows); i++) {
    await page.keyboard.press(rows > 0 ? 'ArrowDown' : 'ArrowUp');
    await settle();
  }
  await page.keyboard.press('Space');
  await settle();
}

test.beforeEach(async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  for (const item of ['Apples', 'Bread', 'Cheese']) await addItem(page, item);
  await expect.poll(() => names(page)).toEqual(['Apples', 'Bread', 'Cheese']);
});

test('dragging an item changes the order and it survives a reload', async ({ page }) => {
  await drag(page, 'Cheese', 'Apples');
  await expect.poll(() => names(page)).toEqual(['Cheese', 'Apples', 'Bread']);

  await page.reload();
  await expect.poll(() => names(page)).toEqual(['Cheese', 'Apples', 'Bread']);
});

test('the grip also moves items from the keyboard', async ({ page }) => {
  await moveWithKeyboard(page, 'Apples', 2);
  await expect.poll(() => names(page)).toEqual(['Bread', 'Cheese', 'Apples']);
  await moveWithKeyboard(page, 'Apples', -1);
  await expect.poll(() => names(page)).toEqual(['Bread', 'Apples', 'Cheese']);
});

test('new urgent items go to the top, other new items to the bottom', async ({ page }) => {
  await addItem(page, 'Dates');
  await page.getByLabel('New item').fill('Eggs');
  await page.getByRole('button', { name: 'More details' }).click();
  await page.getByRole('button', { name: /Need Today/ }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect.poll(() => names(page)).toEqual(['Eggs', 'Apples', 'Bread', 'Cheese', 'Dates']);
});

test('reordering is off while searching', async ({ page }) => {
  for (const item of ['Dates', 'Eggs', 'Figs', 'Grapes']) await addItem(page, item);
  await page.getByPlaceholder('Search tasks, notes or people').fill('Bread');
  await expect(page.locator('main li', { hasText: 'Bread' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move Bread' })).toHaveCount(0);
});
