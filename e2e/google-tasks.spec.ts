import { addItem, createHousehold, expect, signIn, test } from './fixtures';

// Google Tasks has no emulator: the kit's stand-ins answer instead (window.__mockGoogleTasksToken,
// __mockGoogleTaskLists, __mockGoogleTasks), as Google would to a member who connected.
const row = (page: import('@playwright/test').Page, name: string) => page.locator('main li').filter({ has: page.getByText(name, { exact: true }) });

test('tasks told to an assistant come in: groceries straight onto the list, to-dos offered first', async ({ page }) => {
  await signIn(page, 'alice@example.com', 'Alice Example');
  await createHousehold(page);
  await addItem(page, 'Whole milk');
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

  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('region', { name: 'Google Tasks', exact: true });
  await settings.getByRole('button', { name: 'Connect Google Tasks' }).click();
  await settings.getByLabel('Bring Shopping into').selectOption({ label: 'Add to Groceries' });
  await expect(settings).toContainText('New tasks in Shopping go straight onto Groceries.');
  await settings.getByLabel('Bring My Tasks into').selectOption({ label: 'Offer for Chores & Notes' });
  await expect(settings).toContainText('New tasks in My Tasks are offered for Chores & Notes.');
  await page.getByRole('button', { name: 'Close' }).click();

  // Groceries: added without asking, in its aisle.
  await expect(row(page, 'Eggs')).toContainText('Dairy & Eggs');

  // To-dos: offered, one Not this one, one added with its day and notes.
  const card = page.getByRole('region', { name: 'New in Google Tasks' });
  await expect(card).toContainText('New in Google Tasks: Call the dentist');
  await card.getByRole('button', { name: '+1 more' }).click();
  await card.getByRole('button', { name: 'Not this one: Fix the gate' }).click();
  await card.getByRole('button', { name: 'Add Call the dentist' }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: /^Chores & Notes/ }).first().click();
  const dentist = row(page, 'Call the dentist');
  await expect(dentist).toContainText('Ask about Tuesday');
  await expect(dentist).toContainText(/May 16/);

  // Cleared from the list, a task taken in does not come back.
  await page.getByRole('button', { name: /^Groceries/ }).first().click();
  await page.getByRole('button', { name: 'Mark Eggs done' }).click();
  await page.getByRole('button', { name: /Clear done/ }).click();
  await page.reload();
  await page.getByRole('button', { name: /^Groceries/ }).first().click();
  await expect(page.locator('main li', { hasText: 'Whole milk' })).toBeVisible();
  await expect(row(page, 'Eggs')).toHaveCount(0);
});
