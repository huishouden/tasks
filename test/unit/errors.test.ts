import { describe, expect, it } from 'vitest';
import { friendlyError } from '../../src/lib/errors';

function firebaseError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

// Error texts below are the shapes Firebase Auth, App Check and Firestore actually produce.
describe('friendlyError', () => {
  it.each([
    ['busy', new Error('[503 ] The service is currently unavailable.')],
    ['offline', firebaseError('auth/network-request-failed', 'Firebase: Error (auth/network-request-failed).')],
    ['offline', new TypeError('Failed to fetch')],
    ['timeout', new Error('Request timed out')],
    ['cancelled', firebaseError('auth/popup-closed-by-user', 'Firebase: Error (auth/popup-closed-by-user).')],
    ['verification', firebaseError('appCheck/fetch-status-error', 'AppCheck: Fetch server returned an HTTP error status. HTTP status: 403. (appCheck/fetch-status-error).')],
    ['permission', firebaseError('permission-denied', 'Missing or insufficient permissions.')],
    ['unknown', new Error('Cannot read properties of undefined')],
  ] as const)('%s ← %s', (kind, error) => {
    expect(friendlyError(error, 'save', true).kind).toBe(kind);
  });

  it('treats everything as offline when the device is offline', () => {
    expect(friendlyError(new Error('anything'), 'save', false)).toMatchObject({ kind: 'offline', retryable: true });
  });

  it('keeps the original text for the Details toggle, including the cause', () => {
    const e = new Error('outer', { cause: new Error('inner') });
    expect(friendlyError(e, 'save', true).detail).toBe('outer (inner)');
  });
});
