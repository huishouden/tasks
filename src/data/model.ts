import { can, type Role } from '@huishouden/pwa-kit/roles';
import { DAY, HOUR, formatTime, startOfDay } from '@huishouden/pwa-kit/time';
import { getLocale } from '@huishouden/pwa-kit/i18n';
import { t } from '../i18n';
export const CATEGORIES = {
  PRODUCE: 'Produce & Greens',
  DAIRY_EGGS: 'Dairy & Eggs',
  BAKERY: 'Bakery & Bread',
  MEAT_SEAFOOD: 'Meat & Seafood',
  PANTRY: 'Pantry & Dry Goods',
  FROZEN: 'Frozen Foods',
  BEVERAGES: 'Beverages & Coffee',
  SNACKS: 'Snacks & Sweets',
  HOUSEHOLD: 'Household & Cleaning',
  PERSONAL_CARE: 'Personal Care',
  HARDWARE_HOME: 'Hardware & Tools',
  CHORES: 'Chores & Tasks',
  OTHER: 'Other',
} as const;

export type Category = (typeof CATEGORIES)[keyof typeof CATEGORIES];

/** Categories are stored in English (every device groups the same); shown in the reader's language. */
const CATEGORY_KEYS = {
  'Produce & Greens': 'category.produce',
  'Dairy & Eggs': 'category.dairy',
  'Bakery & Bread': 'category.bakery',
  'Meat & Seafood': 'category.meat',
  'Pantry & Dry Goods': 'category.pantry',
  'Frozen Foods': 'category.frozen',
  'Beverages & Coffee': 'category.beverages',
  'Snacks & Sweets': 'category.snacks',
  'Household & Cleaning': 'category.household',
  'Personal Care': 'category.personalCare',
  'Hardware & Tools': 'category.hardware',
  'Chores & Tasks': 'category.chores',
  Other: 'category.other',
} as const satisfies Record<Category, string>;

/** "Produce & Greens" / "Frutas y verduras" / "Groente en fruit"; anything else as stored. */
export function categoryLabel(category: string): string {
  const key = CATEGORY_KEYS[category as Category];
  return key ? t(key) : category;
}


export const URGENCY = {
  NORMAL: 'Standard',
  URGENT: 'Need Today',
  WHENEVER: 'Whenever',
} as const;

export type Urgency = (typeof URGENCY)[keyof typeof URGENCY];

export const ALL_URGENCIES: Urgency[] = [URGENCY.NORMAL, URGENCY.URGENT, URGENCY.WHENEVER];

const URGENCY_KEYS = { Standard: 'urgency.standard', 'Need Today': 'urgency.today', Whenever: 'urgency.whenever' } as const satisfies Record<Urgency, string>;

/** An urgency (stored in English) in the reader's language. */
export function urgencyLabel(urgency: Urgency): string {
  return URGENCY_KEYS[urgency] ? t(URGENCY_KEYS[urgency]) : urgency;
}


export type ListIcon = 'grocery' | 'pantry' | 'bulk' | 'hardware' | 'notes' | 'chores';

/**
 * Lists of to-dos and errands rather than things to buy. Tasks shows these; Huishouden Groceries
 * (huishouden/groceries) shows the rest, from the same `lists` and `items` collections.
 */
export function isTaskList(icon: ListIcon | undefined): boolean {
  return icon === 'chores' || icon === 'notes';
}

export interface ShoppingList {
  id: string;
  name: string;
  description: string;
  icon: ListIcon;
  color: string;
  sortOrder: number;
  createdAt: number;
}

export interface ListItem {
  id: string;
  listId: string;
  name: string;
  category: Category;
  quantity: string;
  notes: string;
  addedBy: string;
  /** Email of whoever added it: helpers and kids change and delete only their own (the rules check it). */
  by?: string;
  completed: boolean;
  urgency: Urgency;
  /** Manual order within the list; lower comes first. Older items without one use createdAt. */
  position?: number;
  /** When it is due or scheduled, in ms since the epoch. With `allDay`, only the date matters. */
  dueAt?: number | null;
  allDay?: boolean;
  /** A deadline ("by 6 PM", typed as "before 6") rather than an appointment ("at 6 PM"). */
  dueBy?: boolean;
  location?: string;
  /** The place chosen with Find nearby, so the app can mention the errand when you are near it. */
  place?: ItemPlace | null;
  /** A link to open from the item, such as the appointment's Google Calendar event. */
  link?: string;
  /** Steps ticked off one at a time; the item completes when the last one is done. */
  subtasks?: Subtask[];
  /** Brought in from this Google task (@huishouden/pwa-kit/google-tasks). */
  googleTaskId?: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  /** Closed as not needed rather than done (when, and by whose email); it sits in Done marked "Cancelled". */
  cancelledAt?: number | null;
  cancelledBy?: string | null;
}

export interface ItemPlace {
  name: string;
  lat: number;
  lon: number;
  /** Business hours as OpenStreetMap writes them, when the map has them. */
  hours?: string;
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Household {
  id: string;
  name: string;
  members: string[];
  /** Members who have signed in at least once; the rest are invited but not yet seen. */
  joined?: string[];
  /** Roles written out (`@huishouden/pwa-kit/roles`); anyone missing is a member, the creator an admin. */
  roles?: Record<string, Role>;
  createdAt: number;
}

/**
 * The lists a new household starts with, shopping and to-do alike: Tasks and Groceries both create
 * all of them, so whichever app starts the household sets up the other too.
 */
export const DEFAULT_LISTS: Omit<ShoppingList, 'createdAt'>[] = [
  { id: 'groceries', name: 'Groceries', description: 'Weekly supermarket and fresh market run', icon: 'grocery', color: '#2d6a4f', sortOrder: 0 },
  { id: 'pantry', name: 'Pantry Restock', description: 'Dry goods, spices and kitchen essentials', icon: 'pantry', color: '#b08d57', sortOrder: 1 },
  { id: 'costco', name: 'Costco & Bulk', description: 'Paper goods, snacks and bulk supplies', icon: 'bulk', color: '#5b7a99', sortOrder: 2 },
  { id: 'hardware', name: 'Hardware & Home', description: 'Repairs, tools, filters and garden', icon: 'hardware', color: '#a8735a', sortOrder: 3 },
  { id: 'chores', name: 'Chores & Notes', description: 'Reminders, repairs and weekend to-dos', icon: 'chores', color: '#8a6f9e', sortOrder: 4 },
];

const DEFAULT_LIST_KEYS: Record<string, { name: 'defaultList.groceries' | 'defaultList.pantry' | 'defaultList.costco' | 'defaultList.hardware' | 'defaultList.chores'; description: 'defaultList.groceriesDescription' | 'defaultList.pantryDescription' | 'defaultList.costcoDescription' | 'defaultList.hardwareDescription' | 'defaultList.choresDescription' }> = {
  groceries: { name: 'defaultList.groceries', description: 'defaultList.groceriesDescription' },
  pantry: { name: 'defaultList.pantry', description: 'defaultList.pantryDescription' },
  costco: { name: 'defaultList.costco', description: 'defaultList.costcoDescription' },
  hardware: { name: 'defaultList.hardware', description: 'defaultList.hardwareDescription' },
  chores: { name: 'defaultList.chores', description: 'defaultList.choresDescription' },
};

/**
 * A list's name as shown: the default lists are stored with their English names; while a household
 * keeps that name, it reads in the reader's language. A renamed list shows its own name.
 */
export function listName(list: Pick<ShoppingList, 'id' | 'name'>): string {
  const keys = DEFAULT_LIST_KEYS[list.id];
  const stock = DEFAULT_LISTS.find((l) => l.id === list.id);
  return keys && stock && stock.name === list.name ? t(keys.name) : list.name;
}

/** A list's description as shown, the same way as `listName`. */
export function listDescription(list: Pick<ShoppingList, 'id' | 'description'>): string {
  const keys = DEFAULT_LIST_KEYS[list.id];
  const stock = DEFAULT_LISTS.find((l) => l.id === list.id);
  return keys && stock && stock.description === list.description ? t(keys.description) : list.description;
}


/** Tasks' own default lists (to-dos), what "Add the default lists" brings back. */
export const TASK_DEFAULT_LISTS = DEFAULT_LISTS.filter((l) => isTaskList(l.icon));

/** Huishouden Groceries, on the suite's one site: shopping lists, stores and meals (pwa-kit docs/one-site.md). */
export const GROCERIES_PATH = '/groceries/';

/** The suite's muted categorical set (DESIGN.md), in its order. */
export const LIST_COLORS = ['#2d6a4f', '#c86d51', '#b08d57', '#5b7a99', '#8a6f9e', '#6f8f72', '#a8735a', '#78716c'];

export function itemPosition(item: ListItem): number {
  return item.position ?? item.createdAt;
}

/** The household's own order, set by dragging; new items land at the bottom, urgent ones at the top. */
export function sortItems(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => itemPosition(a) - itemPosition(b));
}

/** Position that puts an item between its new neighbours, or null when they are too close to split. */
export function positionBetween(before: ListItem | undefined, after: ListItem | undefined): number | null {
  if (before && after) {
    const mid = (itemPosition(before) + itemPosition(after)) / 2;
    return mid > itemPosition(before) && mid < itemPosition(after) ? mid : null;
  }
  if (before) return itemPosition(before) + 1000;
  if (after) return itemPosition(after) - 1000;
  return Date.now();
}

/** The list after moving the item at `from` to index `to`. */
export function moveInOrder<T>(ordered: T[], from: number, to: number): T[] {
  const next = ordered.filter((_, i) => i !== from);
  next.splice(to, 0, ordered[from]);
  return next;
}

export function formatListForSharing(listName: string, items: ListItem[], now: number = Date.now()): string {
  const active = sortItems(items.filter((i) => !i.completed));
  const done = items.filter((i) => i.completed && !isCancelled(i));
  const lines = [`${listName}`, ''];
  if (active.length === 0) {
    lines.push(t('share.allDone'));
  } else {
    for (const item of active) {
      let line = `- ${item.name}`;
      const due = formatDue(item, now);
      if (due) line += ` (${due})`;
      if (item.notes) line += `, ${item.notes}`;
      if (item.urgency === URGENCY.URGENT && !item.dueAt) line += ` ${t('share.needToday')}`;
      lines.push(line);
    }
    lines.push('');
  }
  if (done.length > 0) {
    lines.push(t('share.alreadyDone', { count: done.length, items: done.map((i) => i.name).join(', ') }));
  }
  return lines.join('\n').trimEnd();
}

export function firstName(displayName: string | null | undefined, email: string): string {
  const fromName = displayName?.trim().split(/\s+/)[0];
  return fromName || email.split('@')[0];
}

/**
 * "Today · 10:00 AM", "Today · by 6:00 PM", "Tomorrow", "Tue, Oct 14 · 2:30 PM", and for an all-day
 * deadline "By Sun, Oct 4" or "By tomorrow", in the device's locale and time zone.
 */
export function formatDue(item: Pick<ListItem, 'dueAt' | 'allDay' | 'dueBy'>, now: number): string {
  if (!item.dueAt) return '';
  const days = Math.round((startOfDay(item.dueAt) - startOfDay(now)) / DAY);
  const relative = days === 0 ? t('due.today') : days === 1 ? t('due.tomorrow') : days === -1 ? t('due.yesterday') : undefined;
  const date =
    relative ??
    new Date(item.dueAt).toLocaleDateString(getLocale(), {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(Math.abs(days) > 300 ? { year: 'numeric' } : {}),
    });
  if (item.allDay) return item.dueBy ? t('due.by', { date: relative ? relative.toLocaleLowerCase(getLocale()) : date }) : date;
  const time = formatTime(item.dueAt);
  return item.dueBy ? t('due.dateByTime', { date, time }) : t('due.dateTime', { date, time });
}

/**
 * Whether the item was closed by cancelling it. A later tick (Done from a helper, who can't clear
 * the cancel fields on someone else's item) completes it again after `cancelledAt`, so it reads as done.
 */
export function isCancelled(item: Pick<ListItem, 'completed' | 'completedAt' | 'cancelledAt'>): boolean {
  return item.completed && !!item.cancelledAt && (item.completedAt ?? 0) <= item.cancelledAt;
}

/** Past its date (or, for all-day items, past the end of that day) and not done. */
export function isOverdue(item: Pick<ListItem, 'dueAt' | 'allDay' | 'completed'>, now: number): boolean {
  if (!item.dueAt || item.completed) return false;
  return item.allDay ? startOfDay(item.dueAt) + DAY <= now : item.dueAt < now;
}

export interface NeedsDoing {
  /** Past its date or time and not done. */
  overdue: ListItem[];
  /** Due later today. */
  today: ListItem[];
  /** Marked "Need today", with no date. */
  urgent: ListItem[];
}

/** What the household has to get to today, from every list: overdue first, then today's, then "Need today". */
export function needsDoing(items: ListItem[], now: number): NeedsDoing {
  const endOfToday = startOfDay(now) + DAY;
  const open = items.filter((i) => !i.completed);
  const dated = open.filter((i) => i.dueAt).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  return {
    overdue: dated.filter((i) => isOverdue(i, now)),
    today: dated.filter((i) => !isOverdue(i, now) && (i.dueAt ?? 0) < endOfToday),
    urgent: sortItems(open.filter((i) => !i.dueAt && i.urgency === URGENCY.URGENT)),
  };
}

/** Dated, unfinished items from every list due within `days`, overdue ones included, soonest first. */
export function upcomingItems(items: ListItem[], now: number, days = 14): ListItem[] {
  const until = startOfDay(now) + (days + 1) * DAY;
  return items.filter((i) => !i.completed && i.dueAt && i.dueAt < until).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
}

function calendarStamp(t: number, allDay: boolean): string {
  const d = new Date(t);
  if (allDay) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** A Google Calendar "new event" link prefilled from the item; timed events default to one hour. */
export function googleCalendarLink(item: Pick<ListItem, 'name' | 'notes' | 'dueAt' | 'allDay' | 'location'>, listName: string): string {
  if (!item.dueAt) return '';
  const start = item.allDay ? startOfDay(item.dueAt) : item.dueAt;
  const end = item.allDay ? start + DAY : start + HOUR;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.name,
    dates: `${calendarStamp(start, !!item.allDay)}/${calendarStamp(end, !!item.allDay)}`,
    details: [item.notes, t('calendar.from', { list: listName })].filter(Boolean).join('\n'),
  });
  if (item.location) params.set('location', item.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Turns "Garage cleanout: sort tools, sweep the floor, fix the light" into a title and steps.
 * Only offered when there is a colon and at least two comma-separated parts after it.
 */
export function splitIntoChecklist(name: string): { title: string; steps: string[] } | null {
  const colon = name.indexOf(':');
  if (colon <= 0) return null;
  const title = name.slice(0, colon).trim();
  const steps = name
    .slice(colon + 1)
    .split(/,|;|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!title || steps.length < 2) return null;
  return { title, steps: steps.map((s) => s.charAt(0).toUpperCase() + s.slice(1)) };
}

/** The stored document for an item: every field but the id, which is the document's key. */
export function itemData(item: ListItem): Omit<ListItem, 'id'> {
  // Firestore rejects undefined field values, which an item built in code can carry.
  return Object.fromEntries(Object.entries(item).filter(([k, v]) => k !== 'id' && v !== undefined)) as Omit<ListItem, 'id'>;
}

/** What the undo bar says after items are removed. */
export function removedMessage(items: ListItem[], how: 'deleted' | 'cleared'): string {
  const n = items.length;
  if (how === 'cleared') return t('undo.cleared', { count: n });
  return n === 1 ? t('undo.deletedOne', { name: items[0].name }) : t('undo.deletedMany', { count: n });
}

export function newSubtask(text: string, id = Math.random().toString(36).slice(2, 10)): Subtask {
  return { id, text: text.trim(), done: false };
}

/** Flips one step; the item's completion follows the checklist (all done ⇔ completed). */
export function toggleSubtask(subtasks: Subtask[], id: string): { subtasks: Subtask[]; allDone: boolean } {
  const next = subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
  return { subtasks: next, allDone: next.length > 0 && next.every((s) => s.done) };
}

/**
 * Whether someone may change or delete an item (ticking it off is open to everyone): admins and
 * members any, helpers and kids only those they added. Matches the household rules.
 */
export function mayChangeItem(item: Pick<ListItem, 'by'>, role: Role | null, email: string): boolean {
  return can(role, 'edit-others') || (!!role && !!item.by && item.by === email);
}
