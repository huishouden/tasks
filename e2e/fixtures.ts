import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';

const PROJECT = 'demo-huishouden-tasks';

declare global {
  interface Window {
    __testSignIn: (email: string, name: string) => Promise<unknown>;
  }
}

/** Retries until the emulator answers; the hub reports ready before every emulator is listening. */
async function emulatorRequest(url: string, init: RequestInit): Promise<void> {
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return;
      throw new Error(`${res.status} ${await res.text()}`);
    } catch (e) {
      if (Date.now() > deadline) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

/** Wipes emulator data so every test starts with no users and no households. */
export async function resetEmulators(): Promise<void> {
  await emulatorRequest(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await emulatorRequest(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

/**
 * Writes the household's food settings as the portal would, bypassing the rules (the emulator's
 * admin access), for the one household in the emulator. People follow @huishouden/pwa-kit/food.
 */
export async function seedFood(people: { id: string; name: string; diets: string[]; avoid: string[] }[]): Promise<void> {
  const base = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
  const headers = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
  const list = (await (await fetch(`${base}/households`, { headers })).json()) as { documents?: { name: string }[] };
  const household = list.documents?.[0]?.name.split('/').pop();
  if (!household) throw new Error('seedFood: no household yet');
  const str = (v: string) => ({ stringValue: v });
  const arr = (vs: string[]) => ({ arrayValue: { values: vs.map(str) } });
  const fields = {
    people: {
      arrayValue: {
        values: people.map((p) => ({ mapValue: { fields: { id: str(p.id), name: str(p.name), diets: arr(p.diets), avoid: arr(p.avoid) } } })),
      },
    },
    pantryAssumed: arr(['salt', 'black pepper', 'common dried herbs and spices', 'cooking oil', 'cooking spray', 'butter']),
    updatedAt: { integerValue: String(Date.now()) },
    by: str('alice@example.com'),
  };
  await emulatorRequest(`${base}/households/${household}/settings/food`, { method: 'PATCH', headers, body: JSON.stringify({ fields }) });
}

/** Documents in one of the household's collections, read with admin access (for checking writes). */
export async function readHouseholdCollection(name: string): Promise<Record<string, unknown>[]> {
  const base = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
  const headers = { Authorization: 'Bearer owner' };
  const list = (await (await fetch(`${base}/households`, { headers })).json()) as { documents?: { name: string }[] };
  const household = list.documents?.[0]?.name.split('/').pop();
  const res = (await (await fetch(`${base}/households/${household}/${name}`, { headers })).json()) as { documents?: { fields: Record<string, { stringValue?: string }> }[] };
  return (res.documents ?? []).map((d) => Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, v.stringValue ?? v])));
}

export async function signIn(page: Page, email: string, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await page.waitForFunction(() => '__testSignIn' in window);
  await page.evaluate(([e, n]) => window.__testSignIn(e, n), [email, name] as const);
}

/** Adds round-trip latency so server acknowledgements arrive after local writes, as on a real network. */
export async function slowNetwork(context: BrowserContext, page: Page, latencyMs = 600): Promise<void> {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: latencyMs, downloadThroughput: -1, uploadThroughput: -1 });
}

export async function addItem(page: Page, name: string): Promise<void> {
  await page.getByLabel('New item').fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('main li', { hasText: name }).first()).toBeVisible();
}

export async function createHousehold(page: Page, timeout = 5_000): Promise<void> {
  await page.getByRole('button', { name: 'Create household' }).click();
  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible({ timeout });
}

/** Fails the test on uncaught page errors and Firestore listener errors. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

export const test = base.extend<{ fresh: void; noMapLookups: void }>({
  fresh: [
    async ({}, use) => {
      await resetEmulators();
      await use();
    },
    { auto: true },
  ],
  // Tests never reach the real OpenStreetMap service: no shops nearby unless a test routes one in.
  noMapLookups: [
    async ({ context }, use) => {
      await context.route('https://overpass-api.de/**', (route) => route.fulfill({ json: { elements: [] } }));
      await use();
    },
    { auto: true },
  ],
});

export { expect };
