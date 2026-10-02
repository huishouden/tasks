import { expect, test, type Page } from '@playwright/test';
import { captureScreenshot } from '@huishouden/pwa-kit/e2e';

// README images and CI's before/after evidence: the signed-out app's invented household (src/data/demo.ts)
// on the site at BASE_URL. The clock is frozen on an obviously invented Monday morning so every run
// renders the same. `bun run screenshots` (CI runs it after each deploy and on every PR).
const fixedTime = '2031-01-06T10:00:00';

const ready = (p: Page) => expect(p.getByText('Sample data')).toBeVisible({ timeout: 15_000 });
const mode = async (p: Page, name: string) => {
  await ready(p);
  await p.getByRole('button', { name, exact: true }).click();
};

test('lists', ({ page }) =>
  captureScreenshot(page, 'lists', { fixedTime, prepare: async (p) => {
    await ready(p);
    await expect(p.getByRole('heading', { name: 'Groceries' })).toBeVisible();
  } }));

test('tasks with a checklist', ({ page }) =>
  captureScreenshot(page, 'tasks-checklist', { fixedTime, prepare: async (p) => {
    await ready(p);
    await p.getByRole('button', { name: /^Chores & Notes/ }).first().click();
    await expect(p.getByText('Garage clean-out')).toBeVisible();
  } }));

test('kitchen', ({ page }) =>
  captureScreenshot(page, 'kitchen', { fixedTime, prepare: async (p) => {
    await mode(p, 'Kitchen');
    await expect(p.getByText('Coming up')).toBeVisible();
  } }));

test('meals', ({ page }) =>
  captureScreenshot(page, 'meals', { fixedTime, prepare: async (p) => {
    await mode(p, 'Meals');
    await p.getByRole('button', { name: 'Suggest meals' }).click();
    await expect(p.getByRole('button', { name: 'Suggest meals' })).toBeEnabled({ timeout: 10_000 });
  } }));

test('phone: store', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'store-phone', { fixedTime, prepare: async (p) => {
    await mode(p, 'Store');
    await expect(p.getByText('Baby spinach')).toBeVisible();
  } });
});

test('phone: lists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'phone-lists', { fixedTime, prepare: async (p) => {
    await ready(p);
    await expect(p.getByRole('heading', { name: 'Groceries' })).toBeVisible();
  } });
});
