import { expect, test } from '@playwright/test';

// The list on screen lives in the address (kit STANDARD.md "Updates"), so a reload (a new version)
// and Back return to it. The signed-out sample household.

const heading = (page: import('@playwright/test').Page) => page.locator('main').getByRole('heading', { level: 1 });

test('a reload and Back return to the screen in the address', async ({ page }) => {
  await page.goto('./');
  await expect(heading(page)).toHaveText('Chores & Notes');
  await expect(page).toHaveURL(/\?list=chores$/);
  await page.locator('nav[aria-label="Lists"]').getByRole('button', { name: /Weekend Projects/ }).click();
  await expect(page).toHaveURL(/\?list=projects$/);
  await page.reload();
  await expect(heading(page)).toHaveText('Weekend Projects');
  await page.goBack();
  await expect(heading(page)).toHaveText('Chores & Notes');
  await page.goForward();
  await expect(heading(page)).toHaveText('Weekend Projects');
});

test('a list the household does not have is corrected in the address and not remembered', async ({ page }) => {
  await page.goto('./?list=projects');
  await expect(heading(page)).toHaveText('Weekend Projects');
  await page.goto('./?list=no-such-list');
  await expect(page).toHaveURL(/\?list=projects$/);
  await expect(heading(page)).toHaveText('Weekend Projects');
  await page.goto('./');
  await expect(page).toHaveURL(/\?list=projects$/);
});
