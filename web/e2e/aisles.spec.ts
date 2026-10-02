import type { BrowserContext, Page } from '@playwright/test';
import { addItem, createHousehold, expect, signIn, test } from './fixtures';

const HERE = { latitude: 39.7392, longitude: -104.9903 };

/** Stands in for OpenStreetMap: one supermarket right where the device is. */
async function storeNearby(page: Page) {
  await page.route('https://overpass-api.de/**', (route) =>
    route.fulfill({
      json: { elements: [{ type: 'way', id: 42, center: { lat: HERE.latitude, lon: HERE.longitude }, tags: { shop: 'supermarket', brand: 'Publix', 'addr:street': 'West Main Street' } }] },
    }),
  );
}

async function atTheStore(context: BrowserContext) {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(HERE);
}

test.beforeEach(async ({ page }) => {
  await storeNearby(page);
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  for (const item of ['Greek yogurt', 'Apples', 'Cereal']) await addItem(page, item);
});

test('without location access, only a small Detect link shows and nothing blocks the list', async ({ page }) => {
  await expect(page.getByRole('button', { name: /At a store\? Detect it/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Detected store' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mark Apples done' }).click();
  await expect(page.getByRole('region', { name: /^Aisle for/ })).toHaveCount(0); // no store, no aisle prompt
});

test('a detected store is offered once; Not now keeps it away after a reload', async ({ context, page }) => {
  await atTheStore(context);
  await page.reload();
  const offer = page.getByRole('region', { name: 'Detected store' });
  await expect(offer).toContainText('At Publix · Main St?');
  await offer.getByRole('button', { name: 'Not at Publix · Main St' }).click();
  await expect(offer).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Groceries', level: 1 })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByRole('region', { name: 'Detected store' })).toHaveCount(0);
});

test('shopping a detected store: optional aisles while checking off, then grouped by aisle next time', async ({ context, page }) => {
  await atTheStore(context);
  await page.reload();
  await page.getByRole('region', { name: 'Detected store' }).getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Shopping at Publix · Main St' })).toBeVisible();

  // Checking off offers an aisle; answering is optional.
  await page.getByRole('button', { name: 'Mark Greek yogurt done' }).click();
  const prompt = page.getByRole('region', { name: /^Aisle for Greek yogurt at Publix/ });
  await expect(prompt).toContainText('Greek yogurt: which aisle?');
  await prompt.getByLabel('Aisle for Greek yogurt', { exact: true }).fill('12');
  await prompt.getByLabel('Aisle for Greek yogurt', { exact: true }).press('Enter');
  await expect(prompt).toHaveCount(0);
  await page.getByRole('button', { name: 'Mark Apples done' }).click();
  await page.getByRole('button', { name: 'Skip aisle' }).click();
  // Checking another item moves the prompt on rather than stacking up.
  await page.getByRole('button', { name: 'Mark Cereal done' }).click();
  await expect(page.getByRole('region', { name: /^Aisle for/ })).toHaveCount(1);
  await expect(page.getByRole('region', { name: /^Aisle for Cereal/ })).toBeVisible();

  // Next trip: the aisle is known and Store mode walks it first.
  await page.getByRole('button', { name: 'Mark Greek yogurt not done' }).click();
  await expect(page.getByRole('button', { name: /^Aisle 12\. Change where Greek yogurt is/ })).toBeVisible();
  await page.getByRole('button', { name: 'Store', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Aisle 12' })).toContainText('Greek yogurt');

  // It was moved: correct it in place.
  await page.getByRole('button', { name: /^Aisle 12\. Change where Greek yogurt is/ }).click();
  await page.getByLabel('Where Greek yogurt actually was').fill('14');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: 'Aisle 14' })).toContainText('Greek yogurt');

  await page.getByRole('button', { name: 'Done shopping' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Shopping at' })).toHaveCount(0);
  // Still standing in the store: coming back to the app must not restart the trip.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Groceries', level: 1 })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByRole('status').filter({ hasText: 'Shopping at' })).toHaveCount(0);
});
