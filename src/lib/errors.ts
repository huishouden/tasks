import { calendarError } from '@huishouden/pwa-kit/calendar';
import { popupCancelled } from '@huishouden/pwa-kit/feedback';
import { t } from '../i18n';
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
    return make('offline', t('errors.offline'), true);
  }
  if (context === 'calendar') {
    // Google's permission window (Google Identity Services) in the kit's words, like every other app.
    return make(popupCancelled(e) || /access_denied/.test(all) ? 'cancelled' : 'unknown', calendarError(e), true);
  }
  if (/popup-closed-by-user|cancelled-popup-request|access_denied/.test(all)) return make('cancelled', t('errors.signInCancelled'), true);
  if (/user-mismatch/.test(all)) {
    return make('verification', t('errors.sameAccount'), true);
  }
  if (/timed out|timeout|deadline/.test(all)) {
    return make('timeout', t('errors.timeout'), true);
  }
  if (/\[(500|502|503|429)|resource_exhausted|quota|high demand|overloaded|unavailable|is busy/.test(all)) {
    return make('busy', t('errors.busy'), true);
  }
  if (/app.?check|appcheck|recaptcha|unauthenticated|\[403|attestation/.test(all)) {
    return make('verification', t('errors.verify'), true);
  }
  if (/permission-denied|insufficient permissions/.test(all)) {
    return make('permission', t('errors.permission'), false);
  }
  if (context === 'sign-in' && /unauthorized-domain/.test(all)) {
    return make('verification', t('errors.domain'), false);
  }
  return make('unknown', t('errors.unknown'), true);
}
