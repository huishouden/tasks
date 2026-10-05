import { addItem, createHousehold, expect, signIn, test } from './fixtures';

// DESIGN.md "Completion": an open item and a done one differ by name and by look, never by
// aria-pressed; the done row stays readable (no faded row) and says when it was ticked off.
test('open and done items carry different names and a done line', async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  for (const item of ['Apples', 'Bread']) await addItem(page, item);

  const markDone = page.getByRole('button', { name: 'Mark Apples done' });
  const markNotDone = page.getByRole('button', { name: 'Mark Apples not done' });
  await expect(markDone).toBeVisible();
  await expect(markNotDone).toHaveCount(0);
  await expect(page.locator('main [aria-pressed]').filter({ hasText: /Apples/ })).toHaveCount(0);

  await markDone.click();
  await expect(markNotDone).toBeVisible();
  await expect(markDone).toHaveCount(0);
  const done = page.locator('main li', { has: markNotDone });
  // On the hour the time reads "1 AM", without minutes.
  await expect(done).toContainText(/Done · \d{1,2}(:\d{2})?\b/);
  await expect(done).not.toHaveCSS('opacity', /^0\./);
  // Done sorts after what is still open.
  const rows = await page.locator('main li').evaluateAll((li) => li.map((r) => r.textContent ?? ''));
  expect(rows.findIndex((t) => t.includes('Bread'))).toBeLessThan(rows.findIndex((t) => t.includes('Apples')));

  await markNotDone.click();
  await expect(markDone).toBeVisible();
  await expect(page.locator('main li', { has: markDone })).not.toContainText('Done ·');
});
