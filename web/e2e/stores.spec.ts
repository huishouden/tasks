import type { Page } from '@playwright/test';
import { addItem, createHousehold, expect, signIn, test } from './fixtures';

/** Space picks a row up, arrows move it, Space drops it; waits out dnd-kit's row animation. */
async function moveRow(page: Page, label: string, rows: number): Promise<void> {
  const settle = () => page.waitForTimeout(350);
  await page.getByRole('button', { name: `Move ${label}` }).focus();
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

async function sectionOrder(page: Page): Promise<string[]> {
  return page.locator('main section[aria-label] h2').evaluateAll((hs) => hs.map((h) => h.childNodes[0]?.textContent?.trim() ?? ''));
}

test.beforeEach(async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  for (const item of ['Bananas', 'Whole milk', 'Frozen peas']) await addItem(page, item);
});

test('a store layout changes the walking order and shows aisle labels', async ({ page }) => {
  await page.getByRole('button', { name: 'Store' }).click();
  await expect.poll(() => sectionOrder(page)).toEqual(['Produce & Greens', 'Dairy & Eggs', 'Frozen Foods']);

  await page.getByRole('button', { name: /Add store/ }).click();
  await page.getByLabel('Store name').fill('Publix');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Publix layout' });
  await expect(editor).toBeVisible();

  // Frozen moves from 8th to the top: this Publix is walked back to front.
  await moveRow(page, 'Frozen Foods', -7);
  await editor.getByLabel('Aisle for Dairy & Eggs').fill('Aisle 12');
  await editor.getByRole('button', { name: 'Done' }).click();

  await expect.poll(() => sectionOrder(page)).toEqual(['Frozen Foods', 'Produce & Greens', 'Dairy & Eggs']);
  await expect(page.getByRole('region', { name: 'Dairy & Eggs' })).toContainText('Aisle 12');

  await page.getByRole('button', { name: 'Typical store' }).click();
  await expect.poll(() => sectionOrder(page)).toEqual(['Produce & Greens', 'Dairy & Eggs', 'Frozen Foods']);
});

test('opening Store mode at a saved store picks it automatically', async ({ context, page }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 39.7392, longitude: -104.9903 });

  await page.getByRole('button', { name: 'Store' }).click();
  await page.getByRole('button', { name: /Add store/ }).click();
  await page.getByLabel('Store name').fill('Publix');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: /save this spot/ }).click();
  await expect(page.getByText('Location saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Typical store' }).click();

  // Somewhere else: nothing is picked.
  await context.setGeolocation({ latitude: 39.76, longitude: -105.01 });
  await page.getByRole('button', { name: 'Lists' }).click();
  await page.getByRole('button', { name: 'Store' }).click();
  await expect(page.getByText(/because you're there/)).toHaveCount(0);

  // Back in the car park: Publix is picked.
  await context.setGeolocation({ latitude: 39.7394, longitude: -104.9901 });
  await page.getByRole('button', { name: 'Lists' }).click();
  await page.getByRole('button', { name: 'Store' }).click();
  await expect(page.getByText("Picked Publix because you're there.")).toBeVisible();
});

test('lists can be reordered for everyone', async ({ page }) => {
  await page.getByRole('button', { name: 'Reorder lists' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reorder lists' });
  await moveRow(page, 'Chores & Notes', -4);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('nav[aria-label="Lists"] > button').first()).toHaveText(/Chores & Notes/);
  await page.reload();
  await expect(page.locator('nav[aria-label="Lists"] > button').first()).toHaveText(/Chores & Notes/);
});
