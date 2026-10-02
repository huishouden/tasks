import { addItem, createHousehold, expect, signIn, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await page.getByRole('button', { name: /Chores & Notes/ }).first().click();
});

test('an appointment shows its date and place, and links to Google Calendar', async ({ page }) => {
  await addItem(page, 'Get car inspected at the dealer');
  await page.getByRole('button', { name: 'Edit Get car inspected at the dealer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit item' });
  await dialog.getByLabel('Date').fill('2030-06-14');
  await dialog.getByLabel('Time (optional)').fill('10:30');
  await dialog.getByLabel('Where').fill('Main St Service Center');

  const add = dialog.getByRole('link', { name: 'Add to Google Calendar' });
  const url = new URL((await add.getAttribute('href'))!);
  expect(url.searchParams.get('text')).toBe('Get car inspected at the dealer');
  expect(url.searchParams.get('location')).toBe('Main St Service Center');

  await dialog.getByLabel('Link').fill('https://calendar.google.com/calendar/event?eid=abc123');
  await expect(add).toHaveCount(0); // an existing event replaces "add"
  await dialog.getByRole('button', { name: 'Save' }).click();

  const row = page.locator('main li', { hasText: 'Get car inspected' });
  await expect(row).toContainText(/Jun 14.*10:30/);
  await expect(row).toContainText('Main St Service Center');
  await expect(row.getByRole('link', { name: 'Open in Calendar' })).toHaveAttribute('href', 'https://calendar.google.com/calendar/event?eid=abc123');

  await page.getByRole('button', { name: 'Kitchen' }).click();
  await expect(page.getByRole('region', { name: 'Coming up' })).toHaveCount(0); // 2030 is beyond two weeks
});

test('a past date shows as overdue and appears under Coming up', async ({ page }) => {
  await addItem(page, 'Renew registration');
  await page.getByRole('button', { name: 'Edit Renew registration' }).click();
  await page.getByRole('dialog').getByLabel('Date').fill('2020-01-01');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main li', { hasText: 'Renew registration' })).toContainText('(overdue)');

  await page.getByRole('button', { name: 'Kitchen' }).click();
  await expect(page.getByRole('region', { name: 'Coming up' })).toContainText('Renew registration');
});

test('a long list item becomes a checklist that completes step by step', async ({ page }) => {
  const long =
    'Garage cleanout: sort tools, sweep the floor, donate old bikes, recycle paint cans, hang shelves, label bins, fix the light';
  await addItem(page, long);
  const row = page.locator('main ul > li', { hasText: 'Garage cleanout' });
  // Wraps instead of widening the page.
  const rowBox = (await row.boundingBox())!;
  const mainBox = (await page.locator('main').boundingBox())!;
  expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(mainBox.x + mainBox.width + 1);

  await row.getByRole('button', { name: /^Edit Garage cleanout/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit item' });
  await dialog.getByRole('button', { name: /Split into checklist/ }).click();
  await expect(dialog.getByLabel('Item')).toHaveValue('Garage cleanout');
  await expect(dialog.getByLabel(/^Step \d+$/)).toHaveCount(7);
  await dialog.getByRole('button', { name: 'Save' }).click();

  const item = page.locator('main ul > li', { hasText: 'Garage cleanout' });
  await item.getByRole('button', { name: /0 of 7 done/ }).click();
  const steps = item.getByRole('list', { name: 'Steps for Garage cleanout' }).getByRole('checkbox');
  await expect(steps).toHaveCount(7);
  // The box reflects the saved checklist, which updates a moment after the click.
  for (let i = 0; i < 6; i++) {
    await steps.nth(i).click();
    await expect(steps.nth(i)).toBeChecked();
  }
  await expect(item.getByRole('button', { name: /6 of 7 done/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Garage cleanout done' })).toBeVisible();
  await steps.nth(6).click();
  // The last step completes the item, which moves it into the Done section.
  await expect(page.getByRole('button', { name: 'Mark Garage cleanout done' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark Garage cleanout not done' })).toBeVisible();
});

test('a new list is selected and receives the items added next', async ({ page }) => {
  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByPlaceholder(/Target, Home Depot/).fill('Weekend Projects');
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page.getByRole('heading', { name: 'Weekend Projects', level: 1 })).toBeVisible();
  await addItem(page, 'Fix the fence');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Weekend Projects', level: 1 })).toBeVisible();
  await expect(page.locator('main li', { hasText: 'Fix the fence' })).toBeVisible();
});
