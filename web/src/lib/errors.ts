/** What went wrong, phrased for the household rather than for a developer. */
export interface FriendlyError {
  kind: 'offline' | 'busy' | 'quota' | 'timeout' | 'verification' | 'permission' | 'empty' | 'unknown';
  message: string;
  /** Whether trying the same thing again soon is likely to work. */
  retryable: boolean;
  /** The original error text, shown only behind "Details". */
  detail: string;
}

export type ErrorContext = 'meals' | 'sign-in' | 'save';

/** Thrown when a reply arrives but contains nothing usable. */
export class EmptyResultError extends Error {
  constructor() {
    super('No usable results');
    this.name = 'EmptyResultError';
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('Timed out');
    this.name = 'TimeoutError';
  }
}

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
    return make(
      'offline',
      context === 'meals' ? "You're offline. Meal ideas need a connection." : "Couldn't reach the internet. Check the connection and try again.",
      true,
    );
  }
  if (e instanceof TimeoutError || /timed out|timeout|deadline/.test(all)) {
    return make('timeout', 'That took too long. Try again.', true);
  }
  if (e instanceof EmptyResultError) {
    return make('empty', 'No usable ideas came back. Try again, or add a few more ingredients.', true);
  }
  // 429 covers both per-minute and per-day limits; only the daily one is worth waiting a day for.
  if (/(quota|resource_exhausted|limit).*(per ?day|daily)|(per ?day|daily).*(quota|limit)/.test(all)) {
    return make('quota', "Today's free meal ideas are used up. Try again tomorrow.", false);
  }
  if (/\[(500|502|503|429)|resource_exhausted|quota|high demand|overloaded|unavailable|is busy/.test(all)) {
    return make('busy', context === 'meals' ? 'Gemini is busy right now. Try again in a minute.' : 'The service is busy right now. Try again in a minute.', true);
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

/** Rejects with TimeoutError if `promise` has not settled within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
