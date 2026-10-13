import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIRESTORE_EMULATOR } from './ports';
import { expect, signIn, test } from './fixtures';

// While the lists cannot be reached Tasks stays in the kit's opening frame (AppOpening) with the
// "Still connecting" note above the placeholder, not in the loaded frame. The emulator is made to
// refuse the lists (and items) reads, as the real rules did before a new household was visible.
const PROJECT = 'demo-huishouden-tasks';
const RULES = `${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT}:securityRules`;
const REST = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT}/databases/(default)/documents`;
const here = dirname(fileURLToPath(import.meta.url));
const real = readFileSync(join(here, 'emulators/firestore.rules'), 'utf8');

async function loadRules(content: string) {
  const res = await fetch(RULES, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }) });
  if (!res.ok) throw new Error(`rules: ${res.status} ${await res.text()}`);
}

function refusingReads(rules: string): string {
  const refused = rules.replace(/(match \/(?:lists\/\{listId\}|items\/\{itemId\}) \{\s*allow read: if )isMember\(\);/g, '$1false;');
  if (refused === rules) throw new Error('the rules no longer read lists with isMember(): update this test');
  return refused;
}

test.afterEach(async () => {
  await loadRules(real);
});

test('lists that cannot be reached keep the opening frame and say it is still connecting', async ({ page }) => {
  const email = 'alice@example.com';
  const str = (stringValue: string) => ({ stringValue });
  const fields = {
    name: str('Example household'),
    members: { arrayValue: { values: [str(email)] } },
    roles: { mapValue: { fields: { [email]: str('admin') } } },
    createdAt: { integerValue: String(Date.now()) },
  };
  const made = await fetch(`${REST}/households/connecting`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  expect(made.ok).toBe(true);
  await loadRules(refusingReads(real));

  await signIn(page, email, 'Alice Example');
  const note = page.locator('[data-hh-frame="opening"] [data-hh-opening-note]');
  await expect(note).toContainText('Still connecting. Retrying automatically.', { timeout: 20_000 });
  await expect(page.locator('[data-hh-frame="opening"] [data-hh-skeleton]')).toBeVisible();
  await expect(page.locator('[data-hh-frame=""]')).toHaveCount(0);
  expect(await note.getAttribute('role')).toBe('status');

  // The images for the PR's evidence: SCREENSHOT_DIR=… bun run e2e:local -- connecting
  if (process.env.SCREENSHOT_DIR) {
    for (const [name, size] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 1280, height: 800 }]] as const) {
      await page.setViewportSize(size);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(note).toBeVisible();
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/connecting-${name}-${scheme}.png`, animations: 'disabled', caret: 'hide' });
      }
    }
  }
});
