import { initializeApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { collection, disableNetwork, doc, initializeFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';
// On a Firestore that didn't come from initFirestore the kit's writes are Firestore's own (no outbox).
import { writeBatch } from '@huishouden/pwa-kit/firestore';
import { DAY, HOUR, startOfDay } from '@huishouden/pwa-kit/time';
import { CATEGORIES, DEFAULT_LISTS, URGENCY, type Household, type ListItem, type ShoppingList, type Subtask, type Urgency } from './model';

// Signed out, Tasks shows an invented household so it can be tried and screenshotted (CI's
// before/after and README images). It is the real app on a Firestore that never goes online: an
// in-memory cache with the network off, so every change works on screen and nothing leaves the
// device or survives a reload.

export const DEMO_EMAIL = 'alex@example.com';
export const DEMO_HOUSEHOLD: Household = {
  id: 'demo',
  name: 'The Example household',
  members: [DEMO_EMAIL, 'sam@example.com'],
  joined: [DEMO_EMAIL, 'sam@example.com'],
  createdAt: 0,
};

const at = (now: number, days: number, hour: number, minute = 0) => {
  const d = new Date(startOfDay(now) + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
};

let seq = 0;
function item(listId: string, name: string, now: number, extra: Partial<ListItem> = {}): ListItem {
  seq += 1;
  const created = now - (40 - seq) * HOUR;
  return {
    id: `demo-${seq}`,
    listId,
    name,
    category: CATEGORIES.CHORES,
    quantity: '1',
    notes: '',
    addedBy: seq % 3 === 0 ? 'Sam' : 'Alex',
    completed: false,
    urgency: URGENCY.NORMAL as Urgency,
    position: created,
    createdAt: created,
    updatedAt: created,
    completedAt: null,
    ...extra,
  };
}

const done = (daysAgo: number, now: number): Partial<ListItem> => ({ completed: true, completedAt: now - daysAgo * DAY - 2 * HOUR });
/** Closed as not needed, by the other member. */
const cancelled = (daysAgo: number, now: number): Partial<ListItem> => {
  const t = now - daysAgo * DAY - 3 * HOUR;
  return { completed: true, completedAt: t, cancelledAt: t, cancelledBy: 'sam@example.com' };
};
const steps = (texts: string[], done: number): Subtask[] => texts.map((text, i) => ({ id: `s${i}`, text, done: i < done }));

/** A second to-do list, so the sample shows how lists sit side by side. */
export const DEMO_PROJECTS: Omit<ShoppingList, 'createdAt'> = {
  id: 'projects',
  name: 'Weekend Projects',
  description: 'Bigger jobs, one step at a time',
  icon: 'notes',
  color: '#6f8f72',
  sortOrder: 5,
};

/** The sample household's to-dos, dated from `now` so it always looks current. */
export function demoItems(now: number): ListItem[] {
  seq = 0;
  return [
    item('chores', 'Drop off dry cleaning', now, { dueAt: at(now, 0, 18), dueBy: true, location: 'Example Cleaners, 12 Main St' }),
    item('chores', 'Call the plumber about the kitchen sink', now, { dueAt: at(now, 1, 10) }),
    item('chores', 'Return library books', now, { dueAt: at(now, 3, 0), allDay: true, dueBy: true }),
    item('chores', 'Garage clean-out', now, { subtasks: steps(['Sort the tools', 'Sweep the floor', 'Fix the light'], 1) }),
    item('chores', 'Cancel streaming trial', now, { dueAt: at(now, 9, 0), allDay: true, dueBy: true }),
    item('chores', 'Renew the car registration', now, { urgency: URGENCY.URGENT as Urgency, position: -now }),
    item('chores', 'Water the plants', now, done(0, now)),
    item('projects', 'Paint the guest room', now, {
      dueAt: at(now, 5, 9),
      subtasks: steps(['Pick a colour', 'Buy paint and rollers', 'Move the furniture', 'Tape the trim', 'First coat', 'Second coat', 'Put everything back'], 2),
    }),
    item('projects', 'Clean the gutters', now, { dueAt: at(now, 6, 0), allDay: true }),
    item('projects', 'Fix the squeaky gate', now),
    item('chores', 'Book the window cleaner', now, cancelled(1, now)),
  ];
}

let opened: Promise<Firestore> | null = null;

/**
 * The sample household's Firestore: its own Firebase app on a project that doesn't exist, memory
 * cache only, network off before the first write. Seeded once per page load.
 */
export function openDemo(now: number = Date.now()): Promise<Firestore> {
  opened ??= (async () => {
    const app = initializeApp({ apiKey: 'demo', projectId: 'demo-huishouden-tasks', appId: 'demo' }, 'demo');
    const db = initializeFirestore(app, { localCache: memoryLocalCache() });
    await disableNetwork(db);
    const col = (name: string) => collection(db, 'households', DEMO_HOUSEHOLD.id, name);
    const batch = writeBatch(db);
    batch.set(doc(db, 'households', DEMO_HOUSEHOLD.id), { name: DEMO_HOUSEHOLD.name, members: DEMO_HOUSEHOLD.members, joined: DEMO_HOUSEHOLD.joined, createdAt: now - 90 * DAY });
    // Every default list, as a real household has; Tasks shows the to-do ones.
    for (const list of [...DEFAULT_LISTS, DEMO_PROJECTS]) batch.set(doc(col('lists'), list.id), { ...list, createdAt: now - 90 * DAY });
    for (const i of demoItems(now)) {
      const { id, ...data } = i;
      batch.set(doc(col('items'), id), Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
    }
    // Never acknowledged (there is no server); the cache has it at once.
    void batch.commit();
    return db;
  })();
  return opened;
}

/** No one is signed in to the sample: Google services (Calendar, Google Tasks) never look. */
export const DEMO_AUTH = { currentUser: null, onAuthStateChanged: (cb: (user: null) => void) => (cb(null), () => {}) } as unknown as Auth;
