import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { expect, test } from '@playwright/test';

// Calls the real Gemini model through the app's suggestMeals() in a dev build. App Check is
// satisfied by a debug token registered for the Tasks app; without the token file this is skipped.
const TOKEN_FILE = `${homedir()}/.config/huishouden-tasks/appcheck-debug-token`;

declare global {
  interface Window {
    __suggestMeals: (available: string[]) => Promise<{ type: string; name: string; parts: { ingredients: string[] }[] }[]>;
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string;
  }
}

test('Gemini returns usable meals for a real grocery haul', async ({ page }) => {
  test.skip(!existsSync(TOKEN_FILE), 'no App Check debug token on this machine');
  test.setTimeout(90_000);
  const token = readFileSync(TOKEN_FILE, 'utf8').trim();
  await page.addInitScript((t) => (self.FIREBASE_APPCHECK_DEBUG_TOKEN = t), token);
  await page.goto('/');
  await page.waitForFunction(() => '__suggestMeals' in window);

  const available = ['eggs', 'mushrooms', 'zucchini', 'steak', 'salmon', 'chicken tenderloins', 'potatoes', 'rice', 'pears', 'orange juice'];
  const meals = await page.evaluate((a) => window.__suggestMeals(a), available);

  expect(meals.length).toBeGreaterThanOrEqual(6);
  for (const type of ['breakfast', 'lunch', 'dinner']) expect(meals.some((m) => m.type === type)).toBe(true);
  // Breakfasts stay breakfast-like: no fish or steak.
  const breakfastIngredients = meals.filter((m) => m.type === 'breakfast').flatMap((m) => m.parts.flatMap((p) => p.ingredients.map((i) => i.toLowerCase())));
  expect(breakfastIngredients.filter((i) => /salmon|steak|chicken/.test(i))).toEqual([]);
});
