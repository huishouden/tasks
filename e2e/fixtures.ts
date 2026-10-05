import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';
import { AUTH_EMULATOR, FIRESTORE_EMULATOR } from './ports';

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
  await emulatorRequest(`${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await emulatorRequest(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

const REST = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT}/databases/(default)/documents`;
const ADMIN = { Authorization: 'Bearer owner' };

/** The id of the one household in the emulator, read with admin access. */
async function onlyHouseholdId(): Promise<string> {
  const list = (await (await fetch(`${REST}/households`, { headers: ADMIN })).json()) as { documents?: { name: string }[] };
  const id = list.documents?.[0]?.name.split('/').pop();
  if (!id) throw new Error('No household in the emulator yet');
  return id;
}

/**
 * Links a Google list to the Groceries list in the shared Google Tasks settings, as Groceries would,
 * with admin access.
 */
export async function seedGroceriesLink(googleListId: string, title: string): Promise<void> {
  const household = await onlyHouseholdId();
  const str = (v: string) => ({ stringValue: v });
  const link = { mapValue: { fields: { googleListId: str(googleListId), title: str(title), listId: str('groceries'), mode: str('add') } } };
  const fields = { googleTasks: { arrayValue: { values: [link] } }, handled: { arrayValue: { values: [] } }, updatedAt: { integerValue: String(Date.now()) }, by: str('alice@example.com') };
  await emulatorRequest(`${REST}/households/${household}/settings/tasks`, { method: 'PATCH', headers: { ...ADMIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
}

/** Gives the household a home (`households/{id}.home`), as the portal's Household panel would, with admin access. */
export async function seedHome(home: { address: string; lat: number; lng: number; timeZone?: string }): Promise<void> {
  const household = await onlyHouseholdId();
  const fields: Record<string, unknown> = {
    address: { stringValue: home.address },
    lat: { doubleValue: home.lat },
    lng: { doubleValue: home.lng },
    setBy: { stringValue: 'alice@example.com' },
    updatedAt: { integerValue: String(Date.now()) },
    ...(home.timeZone ? { timeZone: { stringValue: home.timeZone } } : {}),
  };
  await emulatorRequest(`${REST}/households/${household}?updateMask.fieldPaths=home`, {
    method: 'PATCH',
    headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { home: { mapValue: { fields } } } }),
  });
}

/** The Google lists linked in the shared Google Tasks settings, with the household list each feeds. */
export async function googleTasksLinks(): Promise<string[]> {
  const household = await onlyHouseholdId();
  type Val = { stringValue?: string; mapValue?: { fields: Record<string, Val> }; arrayValue?: { values?: Val[] } };
  const doc = (await (await fetch(`${REST}/households/${household}/settings/tasks`, { headers: ADMIN })).json()) as { fields?: Record<string, Val> };
  return (doc.fields?.googleTasks?.arrayValue?.values ?? []).map((v) => `${v.mapValue?.fields.googleListId?.stringValue} → ${v.mapValue?.fields.listId?.stringValue}`).sort();
}

/** Documents in one of the household's collections, read with admin access (for checking writes). */
export async function readHouseholdCollection(name: string): Promise<Record<string, unknown>[]> {
  const household = await onlyHouseholdId();
  const res = (await (await fetch(`${REST}/households/${household}/${name}`, { headers: ADMIN })).json()) as { documents?: { fields: Record<string, { stringValue?: string }> }[] };
  return (res.documents ?? []).map((d) => Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, v.stringValue ?? v])));
}

export async function signIn(page: Page, email: string, name: string): Promise<void> {
  await page.goto('./');
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
  await expect(page.getByRole('heading', { name: 'Chores & Notes' })).toBeVisible({ timeout });
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
