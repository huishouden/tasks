import { devices } from '@playwright/test';
import { addItem, createHousehold, expect, signIn, test } from './fixtures';

// Gemini has no emulator, so these tests stand in a fixed response; the prompt itself is
// exercised against the real model with scripts/menu-probe.ts.
const RESPONSE = {
  meals: [
    {
      type: 'breakfast',
      name: 'Mushroom omelet with orange juice',
      parts: [
        { ingredients: ['eggs', 'mushrooms'], prep: 'Folded over mushrooms sautéed in butter' },
        { ingredients: ['orange juice'], prep: 'Poured chilled' },
      ],
    },
    {
      type: 'dinner',
      name: 'Seared steak with rice',
      parts: [
        { ingredients: ['steak'], prep: 'Pan-seared in butter with salt and pepper' },
        { ingredients: ['rice'], prep: 'Cooked in a rice cooker' },
      ],
    },
    // Uses lobster, which was never bought, so the app must drop it.
    { type: 'dinner', name: 'Lobster tails', parts: [{ ingredients: ['lobster'], prep: 'Broiled' }] },
  ],
};

test('suggests meals from what was bought and shares them with the household', async ({ browser, page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  for (const item of ['Eggs', 'Mushrooms', 'Orange juice', 'Steak', 'Rice']) {
    await addItem(page, item);
    await page.getByRole('button', { name: `Mark ${item} done` }).click();
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByPlaceholder('their.gmail@gmail.com').fill('bob@example.com');
  await page.getByRole('button', { name: 'Add member' }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Meals' }).click();
  const chips = page.getByLabel('Ingredients').getByRole('button');
  await expect(chips).toHaveText(['Rice', 'Steak', 'Orange juice', 'Mushrooms', 'Eggs']);

  await page.evaluate((r) => (window.__mockMenuResponse = r), RESPONSE);
  await page.getByRole('button', { name: 'Suggest meals' }).click();

  const ideas = page.getByLabel('Meal ideas', { exact: true });
  await expect(ideas.getByRole('heading', { level: 3 })).toHaveText(['Mushroom omelet with orange juice', 'Seared steak with rice']);
  await expect(ideas.getByRole('heading', { level: 2 })).toHaveText(['Breakfast', 'Dinner']);
  await expect(ideas).not.toContainText('Lobster');

  const phone = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://localhost:5173' });
  const bob = await phone.newPage();
  await signIn(bob, 'bob@example.com', 'Bob Example');
  await bob.getByRole('button', { name: 'Meals' }).click();
  await expect(bob.getByLabel('Meal ideas', { exact: true }).getByRole('heading', { level: 3 })).toHaveText([
    'Mushroom omelet with orange juice',
    'Seared steak with rice',
  ]);
  await phone.close();
});

test('used-up ingredients are left out, and too few ingredients disables suggestions', async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  for (const item of ['Eggs', 'Rice', 'Steak']) {
    await addItem(page, item);
    await page.getByRole('button', { name: `Mark ${item} done` }).click();
  }
  await page.getByRole('button', { name: 'Meals' }).click();
  const suggest = page.getByRole('button', { name: 'Suggest meals' });
  await expect(suggest).toBeEnabled();
  await page.getByLabel('Ingredients').getByRole('button', { name: 'Steak' }).click();
  await expect(suggest).toBeDisabled();
  await page.getByLabel('Extra ingredient').fill('Bread');
  await page.getByRole('button', { name: 'Add ingredient' }).click();
  await expect(suggest).toBeEnabled();
});

test('a busy model shows a plain message, and Try again recovers', async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  for (const item of ['Eggs', 'Mushrooms', 'Orange juice', 'Steak', 'Rice']) {
    await addItem(page, item);
    await page.getByRole('button', { name: `Mark ${item} done` }).click();
  }
  await page.getByRole('button', { name: 'Meals' }).click();
  await page.evaluate(() => {
    window.__mockMenuError = '[500 ] This model is currently experiencing high demand. (AI/fetch-error)';
  });
  await page.getByRole('button', { name: 'Suggest meals' }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Gemini is busy right now. Try again in a minute.');
  await expect(alert).not.toContainText('fetch-error');
  await alert.getByRole('button', { name: 'Details' }).click();
  await expect(alert).toContainText('high demand');

  await page.evaluate((r) => {
    window.__mockMenuError = undefined;
    window.__mockMenuResponse = r;
  }, RESPONSE);
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Meal ideas', { exact: true }).getByRole('heading', { level: 3 })).toHaveCount(2);
});

test('offline disables suggestions and says why', async ({ context, page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  for (const item of ['Eggs', 'Rice', 'Steak']) {
    await addItem(page, item);
    await page.getByRole('button', { name: `Mark ${item} done` }).click();
  }
  await page.getByRole('button', { name: 'Meals' }).click();
  await context.setOffline(true);
  await expect(page.getByRole('alert')).toContainText("You're offline. Meal ideas need a connection.");
  await expect(page.getByRole('button', { name: 'Suggest meals' })).toBeDisabled();
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Suggest meals' })).toBeEnabled();
});

test('a starred meal is a household favorite on every device, and either member can unstar it', async ({ browser, page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  for (const item of ['Eggs', 'Mushrooms', 'Orange juice', 'Steak', 'Rice']) {
    await addItem(page, item);
    await page.getByRole('button', { name: `Mark ${item} done` }).click();
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByPlaceholder('their.gmail@gmail.com').fill('bob@example.com');
  await page.getByRole('button', { name: 'Add member' }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Meals' }).click();
  await page.evaluate((r) => (window.__mockMenuResponse = r), RESPONSE);
  await page.getByRole('button', { name: 'Suggest meals' }).click();

  const ideas = page.getByLabel('Meal ideas', { exact: true });
  const favorites = page.getByLabel('Favorites', { exact: true });
  await expect(favorites).toHaveCount(0);
  await ideas.getByRole('button', { name: 'Save Seared steak with rice to favorites' }).click();
  await expect(ideas.getByRole('button', { name: 'Remove Seared steak with rice from favorites' })).toHaveAttribute('aria-pressed', 'true');
  await expect(favorites.getByRole('heading', { level: 3 })).toHaveText(['Seared steak with rice']);

  const phone = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://localhost:5173' });
  const bob = await phone.newPage();
  await signIn(bob, 'bob@example.com', 'Bob Example');
  await bob.getByRole('button', { name: 'Meals' }).click();
  const bobFavorites = bob.getByLabel('Favorites', { exact: true });
  await expect(bobFavorites.getByRole('heading', { level: 3 })).toHaveText(['Seared steak with rice']);

  const toggle = bobFavorites.getByRole('button', { name: 'Favorites (1)' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(bobFavorites.getByRole('heading', { level: 3 })).toHaveCount(0);
  await toggle.click();

  await bobFavorites.getByRole('button', { name: 'Remove Seared steak with rice from favorites' }).click();
  await expect(bobFavorites).toHaveCount(0);
  await expect(favorites).toHaveCount(0);
  await expect(ideas.getByRole('button', { name: 'Save Seared steak with rice to favorites' })).toHaveAttribute('aria-pressed', 'false');
  await phone.close();
});

test("Add to Groceries offers a meal's ingredients, leaving out what is on the list or just bought", async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  for (const item of ['Eggs', 'Steak', 'Rice']) {
    await addItem(page, item);
    await page.getByRole('button', { name: `Mark ${item} done` }).click();
  }
  await addItem(page, 'Orange juice');

  await page.getByRole('button', { name: 'Meals' }).click();
  // Not bought recently, so the meal can use them without them counting as already in the kitchen.
  for (const extra of ['Mushrooms', 'Orange juice']) {
    await page.getByLabel('Extra ingredient').fill(extra);
    await page.getByRole('button', { name: 'Add ingredient' }).click();
  }
  await page.evaluate((r) => (window.__mockMenuResponse = r), RESPONSE);
  await page.getByRole('button', { name: 'Suggest meals' }).click();

  await page
    .getByLabel('Meal ideas', { exact: true })
    .getByRole('button', { name: 'Add ingredients for Mushroom omelet with orange juice to Groceries' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Add to Groceries' });
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await expect(dialog.getByRole('checkbox', { name: 'Mushrooms' })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Eggs' })).not.toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Eggs' })).toHaveAccessibleDescription('bought recently');
  await expect(dialog.getByRole('checkbox', { name: 'Orange juice' })).not.toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Orange juice' })).toHaveAccessibleDescription('on list');

  await dialog.getByRole('checkbox', { name: 'Eggs' }).check();
  await dialog.getByRole('button', { name: 'Add 2 items' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Added 2 items to Groceries');

  await page.getByRole('button', { name: 'Lists' }).click();
  const added = page.locator('main li', { hasText: 'for Mushroom omelet with orange juice' });
  await expect(added).toHaveCount(2);
  await expect(added.filter({ hasText: 'Mushrooms' })).toContainText('Alice');
  await expect(added.filter({ hasText: 'Eggs' })).toHaveCount(1);
  // Matched by item name: the added items' note ("…with orange juice") also contains the words.
  await expect(page.getByRole('button', { name: 'Mark Orange juice done' })).toHaveCount(1);
});
