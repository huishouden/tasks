import { addItem, createHousehold, expect, readHouseholdCollection, signIn, test } from './fixtures';

// A task list asks for the details a task has (when, where, steps), not a shopping list's.
test.beforeEach(async ({ page }) => {
  // The household is created at the real time (the rules refuse a backdated one), then the clock is
  // fixed in the morning, so "before 6" is later today.
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await page.clock.install({ time: new Date(2031, 0, 6, 10, 0) });
  await page.reload();
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

test('a date typed into a task becomes its due date, and an old name with a date fills the editor', async ({ page }) => {
  await page.getByLabel('New item').fill('Cancel streaming trial by January 20th');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const row = page.locator('main li', { hasText: 'Cancel streaming trial' });
  await expect(row.getByText('Cancel streaming trial', { exact: true })).toBeVisible();
  await expect(row).toContainText('By Mon, Jan 20');

  // A task saved before dates were read keeps the date in its name; the editor reads it.
  await addItem(page, 'Renew library card');
  await page.getByRole('button', { name: 'Edit Renew library card' }).click();
  let dialog = page.getByRole('dialog', { name: 'Edit task' });
  await dialog.getByLabel('Task', { exact: true }).fill('Renew library card on 1/15');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Edit Renew library card on 1/15' }).click();
  dialog = page.getByRole('dialog', { name: 'Edit task' });
  await expect(dialog.getByLabel('Task', { exact: true })).toHaveValue('Renew library card');
  await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue('2031-01-15');
  await expect(dialog.getByRole('status').filter({ hasText: 'Read “on 1/15” from the name.' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Undo' }).click();
  await expect(dialog.getByLabel('Task', { exact: true })).toHaveValue('Renew library card on 1/15');
  await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue('');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Edit Renew library card on 1/15' }).click();
  dialog = page.getByRole('dialog', { name: 'Edit task' });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main li', { hasText: 'Renew library card' })).toContainText('Wed, Jan 15');
});

test('a dated task goes on the household calendar with a reminder, and leaves both when done and cleared', async ({ page }) => {
  await page.getByLabel('New item').fill('Drycleaners dropoff before 6');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect.poll(async () => (await readHouseholdCollection('agenda')).map((a) => [a.title, a.kind, a.url]), { timeout: 15_000 }).toEqual([
    ['Drycleaners dropoff', 'task', expect.stringMatching(/^https:\/\/huishouden-piekstra\.web\.app\/tasks\/\?list=chores&item=/)],
  ]);
  await expect.poll(async () => (await readHouseholdCollection('reminders')).map((r) => [r.title, r.body]), { timeout: 15_000 }).toEqual([['Drycleaners dropoff', expect.stringMatching(/^By 6:00\s?PM$/)]]);

  // The calendar's link opens the task in its list (a local http run links to production).
  const link = new URL(String((await readHouseholdCollection('agenda'))[0].url));
  await page.goto(`./${link.search}`);
  await expect(page.getByRole('dialog', { name: 'Edit task' }).getByLabel('Task', { exact: true })).toHaveValue('Drycleaners dropoff');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Mark Drycleaners dropoff done' }).click();
  await expect.poll(async () => (await readHouseholdCollection('agenda')).map((a) => a.status), { timeout: 15_000 }).toEqual(['done']);
  await expect.poll(async () => (await readHouseholdCollection('reminders')).length, { timeout: 15_000 }).toBe(0);
  await page.getByRole('button', { name: /Clear done/ }).click();
  await expect.poll(async () => (await readHouseholdCollection('agenda')).length, { timeout: 15_000 }).toBe(0);
});

test('Today, above every list, leads with what is due today and can check it off', async ({ page }) => {
  await page.getByLabel('New item').fill('Drycleaners dropoff before 6');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: /^Groceries/ }).first().click();
  const today = page.getByRole('region', { name: 'Today' });
  await expect(today).toContainText('Drycleaners dropoff');
  await expect(today).toContainText(/Today · by 6:00\s?PM · Chores & Notes/);
  await today.getByRole('button', { name: 'Check off Drycleaners dropoff' }).click();
  await expect(today).toHaveCount(0);
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

test.describe('with location allowed', () => {
  test.beforeEach(async ({ page }) => {
    // Stand-ins for the device position and OpenStreetMap, on every page load.
    await page.addInitScript(() => {
      window.__mockPosition = { lat: 40, lon: -75 };
      const place = (name: string, address: string, distanceKm: number, lat: number) => ({
        name, address, distanceKm, lat, lon: -75, osmUrl: `https://www.openstreetmap.org/node/${name.length}`, mapsUrl: 'https://www.google.com/maps',
      });
      window.__mockPlaces = [place('Example Cleaners', '12 Main St', 0.1, 40.001), place('Corner Cleaners', '40 Oak Ave', 2.4, 40.02)];
    });
    await page.reload();
    await page.getByRole('button', { name: /Chores & Notes/ }).first().click();
  });

  test('an errand that names a kind of place shows the nearest ones straight away', async ({ page }) => {
    await addItem(page, 'Drop off dry cleaning');
    await page.getByRole('button', { name: 'Edit Drop off dry cleaning' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit task' });
    const nearest = dialog.getByRole('list', { name: 'Nearby places' }).getByRole('button');
    await expect(nearest).toHaveCount(2);
    await nearest.first().click();
    await expect(dialog.getByLabel('Where')).toHaveValue('Example Cleaners, 12 Main St');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('main li', { hasText: 'Drop off dry cleaning' })).toContainText('Example Cleaners');

    // Back near that place later: the errand is mentioned, and Done finishes it.
    await page.reload();
    const line = page.getByRole('status', { name: 'Nearby errand' });
    await expect(line).toContainText('Near Example Cleaners: Drop off dry cleaning');
    await line.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Mark Drop off dry cleaning not done' })).toBeVisible();
    await expect(line).toHaveCount(0);
  });

  test('far from the place, nothing is mentioned', async ({ page }) => {
    await addItem(page, 'Drop off dry cleaning');
    await page.getByRole('button', { name: 'Edit Drop off dry cleaning' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit task' });
    await dialog.getByRole('list', { name: 'Nearby places' }).getByRole('button').nth(1).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Chores & Notes', level: 1 })).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page.getByRole('status', { name: 'Nearby errand' })).toHaveCount(0);
  });

  test('a task without a kind of place does not look anything up', async ({ page }) => {
    await addItem(page, 'Call grandma');
    await page.getByRole('button', { name: 'Edit Call grandma' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('dialog').getByRole('list', { name: 'Nearby places' })).toHaveCount(0);
  });
});

test('when the free map has nothing nearby, Google Maps is one tap away', async ({ page }) => {
  await addItem(page, 'Drycleaners dropoff');
  await page.getByRole('button', { name: 'Edit Drycleaners dropoff' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await page.evaluate(() => {
    window.__mockPosition = { lat: 40, lon: -75 };
    window.__mockPlaces = [];
  });
  await dialog.getByLabel('Where').fill('drycleaners');
  await dialog.getByRole('button', { name: 'Find nearby' }).click();
  await expect(dialog.getByRole('status')).toContainText('The free map has nothing like "drycleaners" near you');
  await expect(dialog.getByRole('link', { name: 'Search Google Maps' })).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=drycleaners');
});

test('a chosen place keeps its hours and warns when it is closed at the due time', async ({ page }) => {
  await addItem(page, 'Drycleaners dropoff');
  await page.getByRole('button', { name: 'Edit Drycleaners dropoff' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await page.evaluate(() => {
    window.__mockPosition = { lat: 40, lon: -75 };
    window.__mockPlaces = [
      { name: 'Example Cleaners', address: '12 Main St', distanceKm: 0.8, lat: 40, lon: -75, osmUrl: 'n1', mapsUrl: 'm', openingHours: 'Mo-Fr 07:00-18:00; Sa 08:00-12:00; Su off' },
    ];
  });
  await dialog.getByRole('button', { name: 'Find nearby' }).click();
  // Monday 6 January 2031 (the fixed clock): open 7–6.
  await expect(dialog.getByRole('list', { name: 'Nearby places' })).toContainText(/Today: 7:00\sAM – 6:00\sPM/);
  await dialog.getByRole('list', { name: 'Nearby places' }).getByRole('button').first().click();
  await dialog.getByLabel('Date', { exact: true }).fill('2031-01-06');
  await dialog.getByLabel('Time (optional)').fill('18:30');
  await expect(dialog.getByText(/^Closed at 6:30\sPM\. That day: 7:00\sAM – 6:00\sPM$/)).toBeVisible();
  await dialog.getByLabel('Time (optional)').fill('17:00');
  await expect(dialog.getByText(/^Closed at/)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Save' }).click();

  // The hours are saved with the place.
  await page.getByRole('button', { name: 'Edit Drycleaners dropoff' }).click();
  await expect(page.getByRole('dialog').getByText(/^Today: 7:00\sAM – 6:00\sPM$/)).toBeVisible();
});

test('a busy map service is reported as busy, not as nothing nearby', async ({ page }) => {
  await addItem(page, 'Drycleaners dropoff');
  await page.getByRole('button', { name: 'Edit Drycleaners dropoff' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await page.evaluate(() => {
    window.__mockPosition = { lat: 40, lon: -75 };
    window.__mockPlaces = undefined;
  });
  // Every map server refuses.
  await page.route(/overpass|nominatim/, (route) => route.fulfill({ status: 504, body: 'busy' }));
  await dialog.getByRole('button', { name: 'Find nearby' }).click();
  await expect(dialog.getByRole('status')).toContainText('The free map service is busy right now.');
  await expect(dialog.getByRole('link', { name: 'Search Google Maps' })).toBeVisible();
});
