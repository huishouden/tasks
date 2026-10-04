import { expect, test } from '@playwright/test';
import { expectLocalized } from '@huishouden/pwa-kit/e2e';
import es from '../src/locales/es.json' with { type: 'json' };
import nl from '../src/locales/nl.json' with { type: 'json' };

// The signed-out sample household in Spanish and Dutch: Tasks' own chrome and the kit's, no English
// left. Task names, steps, places and the sample's second list are household data and stay as entered.
const fixedTime = '2031-01-06T10:00:00';
const ENGLISH = ['Tasks', 'Chores & Notes', 'New list', 'Shopping lists are in Groceries', 'to do', 'Need today', 'Share', 'Today', 'Tomorrow', 'steps', 'Cancelled'];

for (const [lang, m] of [
  ['es', es],
  ['nl', nl],
] as const) {
  test(`the sample in ${lang}`, async ({ page }) => {
    await page.clock.setFixedTime(fixedTime);
    // "Cancel" is in a sample task's name ("Cancel streaming trial"), read in its buttons' labels.
    await expectLocalized(page, lang, { words: ENGLISH, allow: ['Cancel'] });
    await expect(page.locator('main').getByRole('heading', { level: 1 })).toHaveText(m['defaultList.chores']);
    await expect(page.getByRole('region', { name: m['due.today'] })).toBeVisible();

    // A task's dialog: its fields and buttons translated, its name as entered.
    await page.getByRole('button', { name: m['item.edit'].replace('{name}', 'Drop off dry cleaning'), exact: true }).click();
    const dialog = page.getByRole('dialog', { name: m['edit.title'] });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: m['publish.byTime'].replace('{time}', lang === 'es' ? '6:00 p.m.' : '18:00') })).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: lang === 'es' ? 'Guardar' : 'Opslaan', exact: true })).toBeVisible();
    await expect(dialog.getByText(m['where.label'], { exact: true })).toBeVisible();
  });
}
