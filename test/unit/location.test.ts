import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { HouseholdHome } from '@huishouden/pwa-kit/home';
import { LocationOff, searchCentre } from '../../src/lib/location';

// An invented home in Springfield, Illinois.
const HOME: HouseholdHome = { address: '12 Example Lane, Springfield, Illinois 62701', lat: 39.7817, lng: -89.6501, setBy: 'alex@example.com', updatedAt: 0 };
const HERE = { latitude: 40, longitude: -75 };

/** A browser whose location permission is `state`; a position read answers HERE or fails with `error`. */
function browser(state: PermissionState | 'unsupported', error?: { code: number }) {
  const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) =>
    error ? fail(error as GeolocationPositionError) : ok({ coords: HERE } as GeolocationPosition),
  );
  vi.stubGlobal('window', {});
  vi.stubGlobal(
    'navigator',
    state === 'unsupported' ? {} : { geolocation: { getCurrentPosition }, permissions: { query: async () => ({ state }) } },
  );
  return getCurrentPosition;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('searchCentre', () => {
  test('location allowed: searches near the device', async () => {
    browser('granted');
    expect(await searchCentre({ home: HOME })).toEqual({ point: { lat: 40, lon: -75 }, from: 'here', canAsk: true });
  });

  test('not asked yet, with a home: near home without a prompt, and a tap can still ask', async () => {
    const read = browser('prompt');
    expect(await searchCentre({ home: HOME })).toEqual({ point: { lat: 39.7817, lon: -89.6501 }, from: 'home', canAsk: true });
    expect(read).not.toHaveBeenCalled();
    expect(await searchCentre({ home: HOME, ask: true })).toMatchObject({ from: 'here' });
    expect(read).toHaveBeenCalledOnce();
  });

  test('location off or unsupported: near home, with nothing to ask', async () => {
    for (const state of ['denied', 'unsupported'] as const) {
      const read = browser(state);
      expect(await searchCentre({ home: HOME, ask: true })).toEqual({ point: { lat: 39.7817, lon: -89.6501 }, from: 'home', canAsk: false });
      expect(read).not.toHaveBeenCalled();
    }
  });

  test('refused at the prompt: home, and no more asking', async () => {
    browser('prompt', { code: 1 });
    expect(await searchCentre({ home: HOME, ask: true })).toMatchObject({ from: 'home', canAsk: false });
  });

  test('a position that cannot be read falls back to home', async () => {
    browser('granted', { code: 3 });
    expect(await searchCentre({ home: HOME })).toMatchObject({ from: 'home', canAsk: true });
  });

  test('no home: asks as before, and says location is off when it is', async () => {
    const read = browser('prompt');
    expect(await searchCentre({ home: undefined })).toMatchObject({ from: 'here' });
    expect(read).toHaveBeenCalledOnce();
    browser('prompt', { code: 1 });
    await expect(searchCentre({ home: undefined })).rejects.toBeInstanceOf(LocationOff);
    browser('denied');
    await expect(searchCentre({ home: undefined })).rejects.toBeInstanceOf(LocationOff);
    browser('unsupported');
    await expect(searchCentre({ home: undefined })).rejects.toBeInstanceOf(LocationOff);
  });

  test('a position that cannot be read, with no home, is not mistaken for location off', async () => {
    browser('granted', { code: 3 });
    await expect(searchCentre({ home: undefined })).rejects.toMatchObject({ code: 3 });
  });
});
