import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { getFirebase, useEmulators } from './firebase';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
const CALENDAR_LIST_SCOPE = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';

export interface CalendarMatch {
  id: string;
  title: string;
  /** ms since epoch; for all-day events, local midnight of the day. */
  start: number;
  allDay: boolean;
  location: string;
  link: string;
  calendarName: string;
}

declare global {
  interface Window {
    /** Browser tests set this to stand in for Google Calendar, which has no emulator. */
    __mockCalendarEvents?: CalendarMatch[];
  }
}

/** Words that describe the task rather than the event, so they are dropped from the search. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'at', 'on', 'in', 'for', 'to', 'of', 'and', 'with', 'my', 'our', 'get', 'got', 'go', 'have', 'make',
  'book', 'schedule', 'scheduled', 'appointment', 'appt', 'call', 'checked', 'check', 'confirm', 'remember', 'do', 'done',
]);

/** Search phrases from a task name, most specific first: "Get car seat checked at fire station" → "car seat fire station", "car seat", "fire station". */
export function searchPhrases(name: string): string[] {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  if (words.length === 0) return [];
  const phrases = [words.join(' ')];
  for (let i = 0; i + 1 < words.length; i++) phrases.push(`${words[i]} ${words[i + 1]}`);
  const longest = [...words].sort((a, b) => b.length - a.length)[0];
  if (longest.length >= 4) phrases.push(longest);
  return [...new Set(phrases)].slice(0, 4);
}

let cached: { token: string; expires: number } | null = null;

/**
 * A short-lived Google token that can read calendar events. Re-confirms the signed-in Google
 * account in a popup with the calendar scopes added; the first time, Google asks to allow access.
 */
async function calendarToken(): Promise<string> {
  if (cached && cached.expires > Date.now()) return cached.token;
  const { auth } = await getFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in first.');
  const provider = new GoogleAuthProvider();
  provider.addScope(CALENDAR_SCOPE);
  provider.addScope(CALENDAR_LIST_SCOPE);
  if (user.email) provider.setCustomParameters({ login_hint: user.email });
  const result = await reauthenticateWithPopup(user, provider);
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) throw new Error('Google did not grant calendar access.');
  // Google access tokens last an hour; refresh a little early.
  cached = { token, expires: Date.now() + 55 * 60_000 };
  return token;
}

async function api<T>(token: string, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) cached = null;
  if (!res.ok) throw new Error(`[${res.status}] Calendar: ${((await res.json().catch(() => ({}))) as { error?: { message?: string } }).error?.message ?? res.statusText}`);
  return (await res.json()) as T;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  location?: string;
  htmlLink: string;
  status?: string;
  start: { dateTime?: string; date?: string };
}

function toMatch(e: GoogleEvent, calendarName: string): CalendarMatch | null {
  if (e.status === 'cancelled' || (!e.start.dateTime && !e.start.date)) return null;
  const allDay = !e.start.dateTime;
  const start = allDay ? (([y, m, d]) => new Date(y, m - 1, d).getTime())(e.start.date!.split('-').map(Number)) : Date.parse(e.start.dateTime!);
  return { id: e.id, title: e.summary ?? '(no title)', start, allDay, location: e.location ?? '', link: e.htmlLink, calendarName };
}

/**
 * Events in any of the user's calendars that match the task, from a week ago to a year ahead,
 * soonest first. Searches each phrase until something matches.
 */
export async function findCalendarEvents(taskName: string): Promise<CalendarMatch[]> {
  if (useEmulators) {
    if (!window.__mockCalendarEvents) throw new Error('Google Calendar is not available against the emulators.');
    return window.__mockCalendarEvents;
  }
  const phrases = searchPhrases(taskName);
  if (phrases.length === 0) return [];
  const token = await calendarToken();
  const { items: calendars = [] } = await api<{ items?: { id: string; summary: string; summaryOverride?: string; selected?: boolean }[] }>(
    token,
    'users/me/calendarList',
    { minAccessRole: 'reader' },
  );
  const now = Date.now();
  const window_ = { timeMin: new Date(now - 7 * 86_400_000).toISOString(), timeMax: new Date(now + 365 * 86_400_000).toISOString() };
  for (const q of phrases) {
    const results = await Promise.all(
      calendars.map((c) =>
        api<{ items?: GoogleEvent[] }>(token, `calendars/${encodeURIComponent(c.id)}/events`, {
          q,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '10',
          ...window_,
        })
          .then((r) => (r.items ?? []).map((e) => toMatch(e, c.summaryOverride ?? c.summary)))
          // One unreadable calendar (a removed share, say) should not hide matches in the others.
          .catch(() => []),
      ),
    );
    const matches = results.flat().filter((m): m is CalendarMatch => m !== null);
    if (matches.length > 0) {
      const unique = new Map(matches.map((m) => [`${m.title}|${m.start}`, m]));
      return [...unique.values()].sort((a, b) => a.start - b.start).slice(0, 10);
    }
  }
  return [];
}
