import { allDayStart, type AgendaInput } from '@huishouden/pwa-kit/agenda';
import type { ReminderInput } from '@huishouden/pwa-kit/reminders';
import type { Role } from '@huishouden/pwa-kit/roles';
import type { TodoAction, TodoInput } from '@huishouden/pwa-kit/todos';
import { toYmd } from '@huishouden/pwa-kit/time';
import { appLink } from '../lib/appLink';
import { isTaskList, type ListItem, type ShoppingList } from './model';

// What Tasks shares with the rest of Huishouden: dated items on the household agenda (the portal's
// Calendar and Today), reminders the shared sender pushes, and open items on the household to-do list
// (the portal's To-do tab). Both are worked out from the items
// themselves, so any device can publish them and they always match the lists.

export const APP = 'tasks';
/** The app's address on the suite's one site, ending in `/tasks/`. */
export const APP_URL = appLink();

/** The link that opens an item in its list; `app` is the app's address, ending in `/`. */
export function itemUrl(item: Pick<ListItem, 'id' | 'listId'>, app = APP_URL): string {
  return `${app}?list=${encodeURIComponent(item.listId)}&item=${encodeURIComponent(item.id)}`;
}

export const itemRef = (id: string) => `item:${id}`;

/** "2 of 5 steps done" for a checklist. */
export function stepsDone(item: Pick<ListItem, 'subtasks'>): string | null {
  const steps = item.subtasks ?? [];
  if (steps.length === 0) return null;
  return `${steps.filter((s) => s.done).length} of ${steps.length} steps done`;
}

function clock(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * A dated item as the household calendar shows it: an appointment when it is at a time, a task when
 * it is a deadline or a day. Done items stay, marked done, until they are cleared.
 */
export function itemAgenda(item: ListItem, list: Pick<ShoppingList, 'name'> | undefined, app = APP_URL): AgendaInput | null {
  if (!item.dueAt || !item.name.trim()) return null;
  const allDay = !!item.allDay;
  const detail = [item.dueBy && !allDay ? `By ${clock(item.dueAt)}` : null, item.location?.trim() || null, stepsDone(item), list?.name ?? null]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 200);
  return {
    ref: itemRef(item.id),
    kind: !allDay && !item.dueBy ? 'appointment' : 'task',
    title: item.name.trim().slice(0, 120),
    start: allDay ? allDayStart(toYmd(item.dueAt)) : item.dueAt,
    allDay,
    ...(detail ? { detail } : {}),
    url: itemUrl(item, app),
    status: item.completed ? 'done' : 'upcoming',
  };
}

/**
 * Everything Tasks puts on the household agenda: its dated to-dos. (Planned dinners are Groceries',
 * published under its own app name.)
 */
export function agendaItems(items: ListItem[], lists: ShoppingList[], app = APP_URL): AgendaInput[] {
  const listOf = new Map(lists.map((l) => [l.id, l]));
  return items.flatMap((i) => {
    const entry = itemAgenda(i, listOf.get(i.listId), app);
    return entry ? [entry] : [];
  });
}

/** An hour ahead of something at or by a time. */
export const LEAD_MS = 60 * 60 * 1000;
/** All-day items remind at 9 in the morning of their day. */
export const MORNING_HOUR = 9;

/**
 * The push reminder for a dated, unfinished item: an hour before a time ("Drop off dry cleaning",
 * "By 6:00 PM"), or 9 in the morning of a day ("Due today"). None once it is done.
 */
export function itemReminder(item: ListItem, app = APP_URL): ReminderInput | null {
  if (!item.dueAt || item.completed || !item.name.trim()) return null;
  const ref = `${APP}:${itemRef(item.id)}`;
  const steps = stepsDone(item);
  if (item.allDay) {
    const morning = new Date(item.dueAt);
    morning.setHours(MORNING_HOUR, 0, 0, 0);
    const body = [item.dueBy ? 'Due today' : 'Today', item.location?.trim(), steps].filter(Boolean).join(' · ');
    return { app: APP, ref, title: item.name.trim(), body, at: morning.getTime(), url: itemUrl(item, app) };
  }
  const body = [item.dueBy ? `By ${clock(item.dueAt)}` : `At ${clock(item.dueAt)}`, item.location?.trim(), steps].filter(Boolean).join(' · ');
  return { app: APP, ref, title: item.name.trim(), body, at: item.dueAt - LEAD_MS, url: itemUrl(item, app) };
}

/** Every reminder Tasks wants scheduled; the kit drops the ones already past. */
export function reminderItems(items: ListItem[], app = APP_URL): ReminderInput[] {
  return items.flatMap((i) => {
    const r = itemReminder(i, app);
    return r ? [r] : [];
  });
}

/** The Firestore collection Tasks' to-do actions write (`TODO_COLLECTIONS.tasks`). */
const ITEMS = 'items';
const EVERYONE: Role[] = ['admin', 'member', 'helper', 'kid'];

/** Ticks the item off, as its checkbox does: tick fields only, so helpers and kids may on anyone's. */
export function doneAction(id: string): TodoAction {
  return {
    label: 'Done',
    ops: [{ col: ITEMS, id, data: { completed: true, completedAt: '$now', updatedAt: '$now' }, merge: true }],
    roles: EVERYONE,
  };
}

/** Closes the item as not needed: it moves to Done marked "Cancelled". Admins, members and whoever added it. */
export function cancelAction(id: string): TodoAction {
  return {
    label: 'Cancel',
    ops: [{ col: ITEMS, id, data: { completed: true, completedAt: '$now', cancelledAt: '$now', cancelledBy: '$me', updatedAt: '$now' }, merge: true }],
    roles: ['admin', 'member'],
    owner: true,
  };
}

/**
 * An open item on a to-do list as the household to-do list shows it, with Done and Cancel. Null once
 * it is done or cancelled, or when it is not on one of Tasks' lists (shopping lists are Groceries',
 * which publishes its own summary line).
 */
export function itemTodo(item: ListItem, list: Pick<ShoppingList, 'name' | 'icon'> | undefined, app = APP_URL): TodoInput | null {
  if (item.completed || !item.name.trim() || !list || !isTaskList(list.icon)) return null;
  const detail = [list.name, stepsDone(item)].filter(Boolean).join(' · ').slice(0, 200);
  return {
    ref: itemRef(item.id),
    title: item.name.trim().slice(0, 120),
    ...(detail ? { detail } : {}),
    createdAt: item.createdAt,
    ...(item.dueAt ? { due: item.allDay ? allDayStart(toYmd(item.dueAt)) : item.dueAt } : {}),
    url: itemUrl(item, app),
    ...(item.by ? { owner: item.by } : {}),
    private: false,
    done: doneAction(item.id),
    cancel: cancelAction(item.id),
  };
}

/** Everything Tasks puts on the household to-do list: every open item on its to-do lists. */
export function todoItems(items: ListItem[], lists: ShoppingList[], app = APP_URL): TodoInput[] {
  const listOf = new Map(lists.map((l) => [l.id, l]));
  return items.flatMap((i) => {
    const todo = itemTodo(i, listOf.get(i.listId), app);
    return todo ? [todo] : [];
  });
}
