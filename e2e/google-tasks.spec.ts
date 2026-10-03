import { createHousehold, expect, googleTasksLinks, seedGroceriesLink, signIn, test } from './fixtures';

// Google Tasks has no emulator: the kit's stand-ins answer instead (window.__mockGoogleTasksToken,
// __mockGoogleTaskLists, __mockGoogleTasks), as Google would to a member who connected.
const row = (page: import('@playwright/test').Page, name: string) => page.locator('main li').filter({ has: page.getByText(name, { exact: true }) });

test('to-dos told to an assistant are offered first; a Google list Groceries takes is left to it', async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  // Groceries already brings "Shopping" into its Groceries list (the same settings document).
  await seedGroceriesLink('g-shop', 'Shopping');
  await page.evaluate(() => {
    const at = Date.now();
    window.__mockGoogleTasksToken = 'tasks-token';
    window.__mockGoogleTaskLists = [
      { id: 'g-my', title: 'My Tasks' },
      { id: 'g-shop', title: 'Shopping' },
    ];
    window.__mockGoogleTasks = [
      { id: 'eggs-1', listId: 'g-shop', title: 'Eggs', notes: '', updated: at - 3000, completed: false },
      { id: 'dentist-1', listId: 'g-my', title: 'Call the dentist', notes: 'Ask about Tuesday', due: '2031-05-16', updated: at - 2000, completed: false },
      { id: 'gate-1', listId: 'g-my', title: 'Fix the gate', notes: '', updated: at - 1000, completed: false },
    ];
  });

  await page.getByRole('button', { name: 'Tasks settings' }).click();
  const settings = page.getByRole('region', { name: 'Google Tasks', exact: true });
  await settings.getByRole('button', { name: 'Connect Google Tasks' }).click();
  // Groceries' link is shown, not offered for change; only to-do lists are choices.
  await expect(settings).toContainText('Goes to Groceries in Groceries');
  await expect(settings.getByLabel('Bring Shopping into')).toHaveCount(0);
  await expect(settings.getByLabel('Bring My Tasks into').locator('option')).toHaveText(['Leave in Google Tasks', 'Offer for Chores & Notes']);
  await settings.getByLabel('Bring My Tasks into').selectOption({ label: 'Offer for Chores & Notes' });
  await expect(settings).toContainText('New tasks in My Tasks are offered for Chores & Notes.');
  await page.getByRole('button', { name: 'Close' }).click();
  // Saving kept Groceries' link as it was.
  await expect.poll(googleTasksLinks).toEqual(['g-my → chores', 'g-shop → groceries']);

  // To-dos: offered, one Not this one, one added with its day and notes.
  const card = page.getByRole('region', { name: 'New in Google Tasks' });
  await expect(card).toContainText('New in Google Tasks: Call the dentist');
  await expect(card).not.toContainText('Eggs');
  await card.getByRole('button', { name: '+1 more' }).click();
  await card.getByRole('button', { name: 'Not this one: Fix the gate' }).click();
  await card.getByRole('button', { name: 'Add Call the dentist' }).click();
  await expect(card).toHaveCount(0);
  const dentist = row(page, 'Call the dentist');
  await expect(dentist).toContainText('Ask about Tuesday');
  await expect(dentist).toContainText(/May 16/);
  // Shopping is Groceries' to bring in: nothing from it lands here.
  await expect(row(page, 'Eggs')).toHaveCount(0);

  // Cleared from the list, a task taken in does not come back.
  await page.getByRole('button', { name: 'Mark Call the dentist done' }).click();
  await page.getByRole('button', { name: /Clear done/ }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chores & Notes' })).toBeVisible();
  await expect(row(page, 'Call the dentist')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'New in Google Tasks' })).toHaveCount(0);
});
