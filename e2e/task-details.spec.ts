import { addItem, createHousehold, expect, signIn, test } from './fixtures';

// A task list asks for the details a task has (when, where, steps), not a shopping list's.
test.beforeEach(async ({ page }) => {
  // A fixed clock in the morning, so "before 6" is later today.
  await page.clock.install({ time: new Date(2031, 0, 6, 10, 0) });
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await page.getByRole('button', { name: /Chores & Notes/ }).first().click();
});

test('"before 6" typed into a task becomes its due time, instead of Need today', async ({ page }) => {
  await page.getByLabel('New item').fill('Drycleaners dropoff before 6');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const row = page.locator('main li', { hasText: 'Drycleaners dropoff' });
  await expect(row.getByText('Drycleaners dropoff', { exact: true })).toBeVisible();
  await expect(row).toContainText(/Today · by 6:00\s?PM/);
  await expect(row).not.toContainText('before 6');

  // The editor shows a task's fields only.
  await row.getByRole('button', { name: 'Edit Drycleaners dropoff' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue('2031-01-06');
  await expect(dialog.getByLabel('Time (optional)')).toHaveValue('18:00');
  await expect(dialog.getByRole('button', { name: /^By 6:00/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByLabel('Quantity')).toHaveCount(0);
  await expect(dialog.getByLabel('Section')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Need today' })).toHaveCount(0);
});

test('an existing task offers its typed time with one tap', async ({ page }) => {
  await addItem(page, 'Pick up prescription');
  await page.getByRole('button', { name: 'Edit Pick up prescription' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await dialog.getByLabel('Notes', { exact: true }).fill('pharmacy closes, get there by 5');
  await dialog.getByRole('button', { name: /^Due today by 5:00\s?PM from “by 5”$/ }).click();
  await expect(dialog.getByLabel('Time (optional)')).toHaveValue('17:00');
  await expect(dialog.getByLabel('Notes', { exact: true })).toHaveValue('pharmacy closes, get there');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main li', { hasText: 'Pick up prescription' })).toContainText(/Today · by 5:00\s?PM/);
});

test('Find nearby fills in the place from the closest matches', async ({ page }) => {
  await addItem(page, 'Drycleaners dropoff');
  await page.getByRole('button', { name: 'Edit Drycleaners dropoff' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await page.evaluate(() => {
    window.__mockPosition = { lat: 40, lon: -75 };
    const place = (name: string, address: string, distanceKm: number) => ({
      name, address, distanceKm, lat: 40, lon: -75, osmUrl: `https://www.openstreetmap.org/node/${name.length}`, mapsUrl: 'https://www.google.com/maps',
    });
    window.__mockPlaces = [place('Example Cleaners', '12 Main St', 0.8), place('Corner Cleaners', '', 2.4)];
  });
  await dialog.getByRole('button', { name: 'Find nearby' }).click();
  const results = dialog.getByRole('list', { name: 'Nearby places' }).getByRole('button');
  await expect(results).toHaveCount(2);
  await results.first().click();
  await expect(dialog.getByLabel('Where')).toHaveValue('Example Cleaners, 12 Main St');
  await dialog.getByRole('button', { name: 'Save' }).click();

  const where = page.locator('main li', { hasText: 'Drycleaners dropoff' }).getByRole('link', { name: /Example Cleaners, 12 Main St, open in Maps/ });
  await expect(where).toHaveAttribute('href', /google\.com\/maps\/search/);
});

test('Need today is offered until there is a time, then the time replaces it', async ({ page }) => {
  await addItem(page, 'Call the vet');
  await page.getByRole('button', { name: 'Edit Call the vet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await dialog.getByRole('button', { name: 'Need today' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  const row = page.locator('main li', { hasText: 'Call the vet' });
  await expect(row.getByText('Today', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Edit Call the vet' }).click();
  await dialog.getByLabel('Date', { exact: true }).fill('2031-01-06');
  await dialog.getByLabel('Time (optional)').fill('14:00');
  await expect(dialog.getByRole('button', { name: 'Need today' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(row).toContainText(/Today · 2:00\s?PM/);
  await expect(row.getByText('Today', { exact: true })).toHaveCount(0);
});

test('a shopping item keeps quantity and section, with the rest folded away', async ({ page }) => {
  await page.getByRole('button', { name: /Groceries/ }).first().click();
  await addItem(page, 'Greek yogurt');
  await page.getByRole('button', { name: 'Edit Greek yogurt' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit item' });
  await expect(dialog.getByLabel('Quantity')).toBeVisible();
  await expect(dialog.getByLabel('Section')).toBeVisible();
  await expect(dialog.getByLabel('Date', { exact: true })).toBeHidden();
  await dialog.getByText('Date, place, list and link').click();
  await expect(dialog.getByLabel('Date', { exact: true })).toBeVisible();
});
