import { calendarError } from '@huishouden/pwa-kit/calendar';
import { popupCancelled } from '@huishouden/pwa-kit/feedback';
/** What went wrong, phrased for the household rather than for a developer. */
export interface FriendlyError {
  kind: 'offline' | 'busy' | 'timeout' | 'verification' | 'permission' | 'cancelled' | 'unknown';
  message: string;
  /** Whether trying the same thing again soon is likely to work. */
  retryable: boolean;
  /** The original error text, shown only behind "Details". */
  detail: string;
}

export type ErrorContext = 'sign-in' | 'save' | 'calendar';

function text(e: unknown): string {
  if (e instanceof Error) {
    const cause = e.cause instanceof Error ? ` (${e.cause.message})` : '';
    return `${e.message}${cause}`;
  }
  return String(e);
}

function code(e: unknown): string {
  return (e as { code?: unknown })?.code?.toString() ?? '';
}

export function friendlyError(e: unknown, context: ErrorContext, online = typeof navigator === 'undefined' || navigator.onLine): FriendlyError {
  const detail = text(e);
  const all = `${code(e)} ${detail}`.toLowerCase();
  const make = (kind: FriendlyError['kind'], message: string, retryable: boolean): FriendlyError => ({ kind, message, retryable, detail });

  if (!online || /network-request-failed|failed to fetch|networkerror|err_internet_disconnected|load failed/.test(all)) {
    return make('offline', "Couldn't reach the internet. Check the connection and try again.", true);
  }
  if (context === 'calendar') {
    // Google's permission window (Google Identity Services) in the kit's words, like every other app.
    return make(popupCancelled(e) || /access_denied/.test(all) ? 'cancelled' : 'unknown', calendarError(e), true);
  }
  if (/popup-closed-by-user|cancelled-popup-request|access_denied/.test(all)) return make('cancelled', 'Sign-in was cancelled.', true);
  if (/user-mismatch/.test(all)) {
    return make('verification', 'Pick the same Google account you are signed in with.', true);
  }
  if (/timed out|timeout|deadline/.test(all)) {
    return make('timeout', 'That took too long. Try again.', true);
  }
  if (/\[(500|502|503|429)|resource_exhausted|quota|high demand|overloaded|unavailable|is busy/.test(all)) {
    return make('busy', 'The service is busy right now. Try again in a minute.', true);
  }
  if (/app.?check|appcheck|recaptcha|unauthenticated|\[403|attestation/.test(all)) {
    return make('verification', "Couldn't verify this device. Reload the page and try again.", true);
  }
  if (/permission-denied|insufficient permissions/.test(all)) {
    return make('permission', "You don't have access to that. If you were just added to the household, reload the page.", false);
  }
  if (context === 'sign-in' && /unauthorized-domain/.test(all)) {
    return make('verification', "This address isn't set up for sign-in yet.", false);
  }
  return make('unknown', 'Something went wrong. Try again in a bit.', true);
}
