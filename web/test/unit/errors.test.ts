import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyResultError, TimeoutError, friendlyError, withTimeout } from '../../src/lib/errors';

function firebaseError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

// Error texts below are the shapes Firebase AI Logic, Auth and Firestore actually produce.
describe('friendlyError', () => {
  it.each([
    [
      'busy',
      new Error(
        'AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/projects/p/models/gemini-3.8-flash:generateContent: [500 ] This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later. (AI/fetch-error)',
      ),
    ],
    [
      'busy',
      new Error(
        'AI: Error fetching from …:generateContent: [429 ] Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 10, model: gemini-3.8-flash, per minute (AI/fetch-error)',
      ),
    ],
    [
      'quota',
      new Error(
        'AI: Error fetching from …:generateContent: [429 ] You exceeded your current quota. Quota exceeded for metric: generate_content_free_tier_requests, limit: 250, id: GenerateRequestsPerDayPerProjectPerModel-FreeTier (AI/fetch-error)',
      ),
    ],
    ['offline', firebaseError('auth/network-request-failed', 'Firebase: Error (auth/network-request-failed).')],
    ['offline', new TypeError('Failed to fetch')],
    ['timeout', new TimeoutError()],
    ['empty', new EmptyResultError()],
    ['verification', firebaseError('appCheck/fetch-status-error', 'AppCheck: Fetch server returned an HTTP error status. HTTP status: 403. (appCheck/fetch-status-error).')],
    ['permission', firebaseError('permission-denied', 'Missing or insufficient permissions.')],
    ['unknown', new Error('Cannot read properties of undefined')],
  ] as const)('%s ← %s', (kind, error) => {
    expect(friendlyError(error, 'meals', true).kind).toBe(kind);
  });

  it('treats everything as offline when the device is offline', () => {
    expect(friendlyError(new Error('anything'), 'meals', false)).toMatchObject({ kind: 'offline', retryable: true });
  });

  it('does not offer a retry for the daily limit', () => {
    const e = new Error('[429 ] Quota exceeded … GenerateRequestsPerDayPerProjectPerModel');
    expect(friendlyError(e, 'meals', true)).toMatchObject({ kind: 'quota', retryable: false });
  });

  it('keeps the original text for the Details toggle, including the cause', () => {
    const e = new Error('outer', { cause: new Error('inner') });
    expect(friendlyError(e, 'save', true).detail).toBe('outer (inner)');
  });

  it('words messages for the screen they appear on', () => {
    const e = new Error('[503 ] unavailable');
    expect(friendlyError(e, 'meals', true).message).toMatch(/Gemini is busy/);
    expect(friendlyError(e, 'save', true).message).toMatch(/service is busy/);
  });
});

describe('withTimeout', () => {
  afterEach(() => vi.useRealTimers());

  it('rejects with TimeoutError when the promise takes too long', async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 1000);
    vi.advanceTimersByTime(1001);
    await expect(pending).rejects.toBeInstanceOf(TimeoutError);
  });

  it('passes results and errors through when in time', async () => {
    await expect(withTimeout(Promise.resolve(5), 1000)).resolves.toBe(5);
    await expect(withTimeout(Promise.reject(new Error('no')), 1000)).rejects.toThrow('no');
  });
});
