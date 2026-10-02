import type { Page } from '@playwright/test';
import { addItem, createHousehold, expect, signIn, test } from './fixtures';

// Regenerates the README screenshots from a sample household: `bun run screenshots`.
// Excluded from the normal suite; run it after any change to how the app looks.
const OUT = process.env.SCREENSHOT_DIR ?? 'docs/screenshots';

const MEALS = {
  meals: [
    { type: 'breakfast', name: 'Mushroom omelet with orange juice', parts: [{ ingredients: ['eggs', 'mushrooms'], prep: 'Folded over mushrooms sautéed in butter with salt and pepper' }, { ingredients: ['orange juice'], prep: 'Poured chilled' }] },
    { type: 'breakfast', name: 'Scrambled eggs with pears and coffee', parts: [{ ingredients: ['eggs'], prep: 'Scrambled in butter with salt and pepper' }, { ingredients: ['pears'], prep: 'Sliced fresh' }, { ingredients: ['coffee'], prep: 'Brewed hot' }] },
    { type: 'lunch', name: 'Chicken and zucchini rice bowl', parts: [{ ingredients: ['chicken tenderloins'], prep: 'Diced and pan-fried in olive oil with garlic powder' }, { ingredients: ['zucchini'], prep: 'Sliced and sautéed in olive oil with seasoning' }, { ingredients: ['rice'], prep: 'Cooked in a rice cooker' }] },
    { type: 'dinner', name: 'Seared steak with potatoes and carrots', parts: [{ ingredients: ['steak'], prep: 'Pan-seared in butter with salt and pepper' }, { ingredients: ['potatoes'], prep: 'Roasted in olive oil with paprika' }, { ingredients: ['carrots'], prep: 'Cut into batons and roasted in olive oil' }] },
    { type: 'dinner', name: 'Pan-seared salmon with rice and zucchini', parts: [{ ingredients: ['salmon'], prep: 'Pan-seared in olive oil with garlic powder' }, { ingredients: ['rice'], prep: 'Steamed' }, { ingredients: ['zucchini'], prep: 'Sautéed with Italian seasoning' }] },
    { type: 'snack', name: 'Pear slices and string cheese', parts: [{ ingredients: ['pears'], prep: 'Sliced fresh' }, { ingredients: ['string cheese'], prep: 'Served chilled' }] },
  ],
};

async function shot(page: Page, name: string) {
  await page.locator('main').evaluate((m) => m.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test('README screenshots', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, 'alex@example.com', 'Alex Example');
  await page.getByLabel('Household name').fill('Example Household');
  // Created at the real time (the rules refuse a backdated household), then an obviously invented
  // date, so sample appointments never read as real ones.
  await createHousehold(page);
  await page.clock.install({ time: new Date(2031, 0, 6, 10, 0) });
  await page.reload();
  await page.getByRole('heading', { name: 'Groceries' }).waitFor();

  // Bought this week (on the Costco list, so Groceries shows only what is still needed), for meal ideas.
  await page.getByRole('button', { name: /Costco & Bulk/ }).first().click();
  for (const item of ['Eggs', 'Mushrooms', 'Orange juice', 'Pears', 'Chicken tenderloins', 'Zucchini', 'Rice', 'Steak', 'Potatoes', 'Carrots', 'Salmon', 'String cheese']) {
    await addItem(page, item);
    await page.getByRole('button', { name: `Mark ${item} done` }).click();
  }
  await page.getByRole('button', { name: /Clear done/ }).waitFor();
  await page.getByRole('button', { name: /Groceries/ }).first().click();
  // Still to buy.
  for (const item of ['Watermelon', 'Greek yogurt', 'Sourdough bread', 'Tilapia', 'Paper towels', 'Coffee beans']) await addItem(page, item);
  await page.getByLabel('New item').fill('Diapers');
  await page.getByRole('button', { name: 'More details' }).click();
  await page.getByRole('button', { name: /Need Today/ }).click();
  await page.getByPlaceholder('1, 2 lbs, a dozen').fill('2 boxes');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'More details' }).click();

  // A to-do list with an appointment and a checklist.
  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByPlaceholder(/Target, Home Depot/).fill('Weekend Projects');
  await page.getByRole('dialog').getByRole('button', { name: 'chores', exact: true }).click();
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page.getByRole('heading', { name: 'Weekend Projects', level: 1 })).toBeVisible();
  await addItem(page, 'Get car inspected at the dealer');
  await page.getByRole('button', { name: 'Edit Get car inspected at the dealer' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Date', { exact: true }).fill('2031-01-09');
  await dialog.getByLabel('Time (optional)').fill('10:30');
  await dialog.getByLabel('Where').fill('Main St Service Center');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await addItem(page, 'Garage cleanout: sort tools, sweep the floor, donate old bikes, recycle paint cans, hang shelves, label bins, fix the light');
  await page.getByRole('button', { name: /^Edit Garage cleanout/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Split into \d+ steps$/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: /0 of 7 done/ }).click();
  for (const i of [0, 1, 2]) await page.getByRole('list', { name: 'Steps for Garage cleanout' }).getByRole('checkbox').nth(i).click();
  // Same clock on every run from here (after the data exists, so item order still follows when
  // each was added), so before/after and README screenshots differ only by real changes.
  await page.clock.setFixedTime(new Date(2031, 0, 6, 10, 30));
  await shot(page, 'tasks-checklist');

  await page.getByRole('button', { name: /Groceries/ }).first().click();
  await shot(page, 'lists');

  await page.getByRole('button', { name: 'Kitchen' }).click();
  await shot(page, 'kitchen');

  await page.getByRole('button', { name: 'Meals' }).click();
  await page.evaluate((r) => (window.__mockMenuResponse = r), MEALS);
  await page.getByRole('button', { name: 'Suggest meals' }).click();
  await page.getByRole('heading', { name: 'Chicken and zucchini rice bowl' }).waitFor();
  await page.getByRole('button', { name: 'Save Seared steak with potatoes and carrots to favorites' }).click();
  await shot(page, 'meals');

  // Store mode on a phone, with a saved store layout.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Store', exact: true }).click();
  await page.getByRole('button', { name: /Add store/ }).click();
  await page.getByLabel('Store name').fill('Corner Grocer');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Aisle for Dairy & Eggs').fill('Aisle 12');
  await page.getByLabel('Aisle for Household & Cleaning').fill('Aisle 15');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Mark Watermelon done' }).click();
  await page.getByRole('button', { name: 'Mark Sourdough bread done' }).click();
  await shot(page, 'store-phone');
});
