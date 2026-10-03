import { expect, test, type Page } from '@playwright/test';
import { captureScreenshot } from '@huishouden/pwa-kit/e2e';

// README images and CI's before/after evidence: the signed-out app's invented household (src/data/demo.ts)
// on the site at BASE_URL. The clock is frozen on an obviously invented Monday morning so every run
// renders the same. `bun run screenshots` (CI runs it after each deploy and on every PR).
const fixedTime = '2031-01-06T10:00:00';

const ready = (p: Page) => expect(p.getByText('Sample data')).toBeVisible({ timeout: 15_000 });
test('lists', ({ page }) =>
  captureScreenshot(page, 'lists', { fixedTime, prepare: async (p) => {
    await ready(p);
    await expect(p.getByRole('heading', { name: 'Chores & Notes' })).toBeVisible();
  } }));

test('tasks with a checklist', ({ page }) =>
  captureScreenshot(page, 'tasks-checklist', { fixedTime, prepare: async (p) => {
    await ready(p);
    await p.getByRole('button', { name: /^Weekend Projects/ }).first().click();
    await p.getByRole('button', { name: /2 of 7 done/ }).click();
    await expect(p.getByText('Move the furniture')).toBeVisible();
  } }));

test('phone: lists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'phone-lists', { fixedTime, prepare: async (p) => {
    await ready(p);
    await expect(p.getByRole('heading', { name: 'Chores & Notes' })).toBeVisible();
  } });
});
