import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Signed out, on the invented sample household: nothing here touches the emulators' data.

const ready = (p: Page) => expect(p.getByText('Sample data')).toBeVisible({ timeout: 15_000 });

/** OpenStreetMap answers with one Publix next to wherever the device is. */
async function publixNearby(page: Page) {
  await page.context().route('https://overpass-api.de/**', (route) =>
    route.fulfill({
      json: {
        elements: [{ type: 'node', id: 4242, lat: 39.7392, lon: -104.9903, tags: { shop: 'supermarket', name: 'Publix Super Market', 'addr:street': 'Main Street' } }],
      },
    }),
  );
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 39.7392, longitude: -104.9903 });
}

test("shopping at a detected Publix, each item links to Publix's own search for it", async ({ page }) => {
  await publixNearby(page);
  await page.goto('./');
  await ready(page);
  await page.getByLabel('New item').fill('2 lb queso ecuatoriano');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await page.getByRole('button', { name: 'Store', exact: true }).click();
  await page.getByRole('region', { name: 'Detected store' }).getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Shopping at Publix Super Market · Main St' })).toBeVisible();

  const queso = page.getByRole('link', { name: /^Find .*queso ecuatoriano at Publix$/ });
  await expect(queso).toHaveText('Find at Publix');
  await expect(queso).toHaveAttribute('href', 'https://www.publix.com/search?searchTerm=queso%20ecuatoriano');
  await expect(queso).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('link', { name: 'Find Baby spinach at Publix' })).toHaveAttribute('href', 'https://www.publix.com/search?searchTerm=Baby%20spinach');
  // Checked-off items need no finding.
  await expect(page.getByRole('link', { name: 'Find Zucchini at Publix' })).toHaveCount(0);

  // The item's details offer it too, the store being shopped first.
  await page.getByRole('button', { name: 'Lists', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Baby spinach' }).click();
  const findIt = page.getByRole('dialog').getByRole('group', { name: 'Find it at a store' });
  await expect(findIt.getByRole('link').first()).toHaveAttribute('href', 'https://www.publix.com/search?searchTerm=Baby%20spinach');
  // The sample's Example Market has no search we know of: a web search for the item there.
  await expect(findIt.getByRole('link', { name: 'Search the web for Baby spinach at Example Market' })).toHaveAttribute(
    'href',
    `https://www.google.com/search?q=${encodeURIComponent('"Baby spinach" Example Market')}`,
  );
});

test('with no store detected, an item offers the household’s stores', async ({ page }) => {
  await page.goto('./');
  await ready(page);
  await expect(page.getByRole('link', { name: /^Find .* at / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Whole milk' }).click();
  await expect(page.getByRole('dialog').getByRole('group', { name: 'Find it at a store' }).getByRole('link')).toHaveText(['Example Market']);
});

test('to-dos have no store links', async ({ page }) => {
  await page.goto('./');
  await ready(page);
  await page.getByRole('button', { name: /^Chores & Notes/ }).first().click();
  await page.getByRole('button', { name: 'Edit Garage clean-out' }).click();
  await expect(page.getByRole('dialog').getByRole('group', { name: 'Find it at a store' })).toHaveCount(0);
});

for (const viewport of [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 1024, height: 768 },
]) {
  test(`${viewport.name}: a section heading stays at the top while its items scroll by`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await ready(page);
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    const produce = page.getByRole('region', { name: 'Produce & Greens' });
    const heading = produce.getByRole('heading');
    await expect(heading).toBeVisible();

    const progress = page.getByText(/of \d+ in cart/);
    // Scroll so the section's top is well above the screen while some of its items are still on it.
    await produce.evaluate((section) => {
      const main = section.closest('main')!;
      main.scrollTop += section.getBoundingClientRect().top - main.getBoundingClientRect().top - 10;
    });
    await page.waitForTimeout(100);
    const [h, s, head] = await Promise.all([heading.boundingBox(), produce.boundingBox(), progress.locator('xpath=../..').boundingBox()]);
    // The section has scrolled past the point where its heading is held.
    expect(s!.y).toBeLessThan(h!.y - 5);
    expect(Math.abs(h!.y - (head!.y + head!.height))).toBeLessThan(2);
    // Nothing covers it: the heading is what is drawn there.
    const onTop = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('h2')?.textContent ?? '', { x: h!.x + 20, y: h!.y + h!.height / 2 });
    expect(onTop).toContain('Produce & Greens');
    await expect(heading).toHaveAttribute('data-stuck', '');
  });
}
