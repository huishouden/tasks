import { stubOpenStreetMap, useGeolocation } from '@huishouden/pwa-kit/e2e';
import { addItem, createHousehold, expect, seedHome, signIn, test } from './fixtures';

// Find nearby without the device's location: near the household's home (set in the portal), and
// says so. OpenStreetMap is stubbed (Overpass finds nothing, so the search is Nominatim's, bounded
// around the centre) and the home is invented.
const HOME = { address: '12 Example Lane, Springfield, Illinois 62701', lat: 39.7817, lng: -89.6501, timeZone: 'America/Chicago' };
const CLEANERS = {
  osm_type: 'node',
  osm_id: 101,
  lat: '39.7900',
  lon: '-89.6440',
  name: 'Example Cleaners',
  display_name: 'Example Cleaners, 40 Sample Street, Springfield, Illinois 62701',
};

/** The centre of a bounded Nominatim search, from its `viewbox` (left,top,right,bottom). */
function centreOf(url: string) {
  const [left, top, right, bottom] = new URL(url).searchParams.get('viewbox')!.split(',').map(Number);
  return { lat: (top + bottom) / 2, lng: (left + right) / 2 };
}

test.beforeEach(async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
});

test('with a home and no location allowed, an errand finds places near home and says so', async ({ page }) => {
  await seedHome(HOME);
  const asked = await stubOpenStreetMap(page, { search: [CLEANERS] });
  await page.reload();
  await page.getByRole('button', { name: /Chores & Notes/ }).first().click();
  await addItem(page, 'Drop off dry cleaning');
  await page.getByRole('button', { name: 'Edit Drop off dry cleaning' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });

  // Straight away, without asking for location.
  const places = dialog.getByRole('list', { name: 'Nearby places' }).getByRole('button');
  await expect(places).toHaveCount(1);
  await expect(dialog.getByTestId('search-centre')).toContainText('Near home');
  // Measured from home: 0.7 miles.
  await expect(places.first()).toContainText(/0\.7 mi · 40 Sample Street/);
  const centre = centreOf(asked.find((u) => u.includes('viewbox'))!);
  expect(centre.lat).toBeCloseTo(HOME.lat, 3);
  expect(centre.lng).toBeCloseTo(HOME.lng, 3);

  await places.first().click();
  await expect(dialog.getByLabel('Where')).toHaveValue('Example Cleaners, 40 Sample Street, Springfield, Illinois 62701');
});

test('"Use my location" switches the search to where the device is', async ({ page, context }) => {
  await seedHome(HOME);
  const asked = await stubOpenStreetMap(page, { search: [CLEANERS] });
  await page.reload();
  await page.getByRole('button', { name: /Chores & Notes/ }).first().click();
  await addItem(page, 'Drop off dry cleaning');
  await page.getByRole('button', { name: 'Edit Drop off dry cleaning' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  await expect(dialog.getByTestId('search-centre')).toContainText('Near home');

  // The person allows location when asked.
  await useGeolocation(context, { lat: 39.8, lng: -89.65 });
  await dialog.getByRole('button', { name: 'Use my location' }).click();
  await expect(dialog.getByTestId('search-centre')).toContainText('Near you');
  await expect(dialog.getByRole('button', { name: 'Use my location' })).toHaveCount(0);
  const centre = centreOf(asked.filter((u) => u.includes('viewbox')).at(-1)!);
  expect(centre.lat).toBeCloseTo(39.8, 3);
});

test('with neither location nor a home, it points to setting a home', async ({ page, context }) => {
  await context.clearPermissions();
  await page.getByRole('button', { name: /Chores & Notes/ }).first().click();
  await addItem(page, 'Drop off dry cleaning');
  await page.getByRole('button', { name: 'Edit Drop off dry cleaning' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit task' });
  // Nothing looked up on open: no location and no home.
  await expect(dialog.getByRole('list', { name: 'Nearby places' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Find nearby' }).click();
  await expect(dialog.getByText('Location is off for this app')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Huishouden' })).toHaveAttribute('href', '/#household');
});
