import { createHousehold, expect, signIn, test } from './fixtures';

// Shopping lists, stores and meals are Huishouden Groceries' (/groceries/ on the same site). Tasks
// sends old links there and points the way from its lists.

test('old Kitchen, Store and Meals links open in Groceries, query kept', async ({ page }) => {
  for (const mode of ['meals', 'store', 'hub']) {
    await page.goto(`./?mode=${mode}`);
    await page.waitForURL((url) => url.pathname === '/groceries/' && url.search === `?mode=${mode}`);
  }
});

test('an old link to a shopping list item opens in Groceries; a to-do link stays', async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await page.goto('./?list=chores');
  await expect(page.getByRole('heading', { name: 'Chores & Notes', level: 1 })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/tasks/');
  await page.goto('./?list=groceries&item=abc');
  await page.waitForURL((url) => url.pathname === '/groceries/' && url.search === '?list=groceries&item=abc');
});

test('the lists point to Groceries for shopping, on a tablet and on a phone', async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await expect(page.locator('nav[aria-label="Lists"]').getByRole('link', { name: 'Shopping lists are in Groceries' })).toHaveAttribute('href', '/groceries/');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('link', { name: 'Shopping lists are in Groceries' }).locator('visible=true')).toHaveAttribute('href', '/groceries/');
});
