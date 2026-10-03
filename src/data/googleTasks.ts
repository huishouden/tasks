import { doc, onSnapshot, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { arrayUnion, setDoc } from '@huishouden/pwa-kit/firestore';
import type { GoogleTask } from '@huishouden/pwa-kit/google-tasks';
import { ymdToTime } from '@huishouden/pwa-kit/time';
import type { ListIcon } from './model';
import type { NewItem } from './store';

// Google Tasks into household lists: "remind me to call the plumber" told to the Gemini app lands in
// Google Tasks, and Tasks offers it for a to-do list. Which Google list feeds which household list is
// a household setting (`households/{id}/settings/tasks`, huishouden/rules), so every member's device
// follows it. Groceries keeps its shopping lists' links in the same document: each app changes only
// the links to its own lists and writes the rest back as they were.

/** What happens to new tasks in one Google list: added straight to a list, or offered for one. */
export type GoogleTasksMode = 'add' | 'suggest';

export interface GoogleTasksLink {
  googleListId: string;
  /** The Google list's name when it was chosen ("My Tasks"). */
  title: string;
  /** The household list it feeds. */
  listId: string;
  mode: GoogleTasksMode;
}

export interface TasksSettings {
  googleTasks: GoogleTasksLink[];
  /** Google task ids already taken in, newest last, so one cleared from a list is not brought back. */
  handled: string[];
}

export const MAX_LINKS = 10;
export const MAX_HANDLED = 500;

const settingsDoc = (db: Firestore, householdId: string) => doc(db, 'households', householdId, 'settings', 'tasks');

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** The settings document, read defensively. */
export function toTasksSettings(data: Record<string, unknown> | undefined): TasksSettings {
  const links = Array.isArray(data?.googleTasks) ? data.googleTasks : [];
  return {
    googleTasks: links
      .map((l: Record<string, unknown>) => ({
        googleListId: str(l?.googleListId, 200),
        title: str(l?.title, 100),
        listId: str(l?.listId, 100),
        mode: (l?.mode === 'add' ? 'add' : 'suggest') as GoogleTasksMode,
      }))
      .filter((l) => l.googleListId && l.listId)
      .slice(0, MAX_LINKS),
    handled: Array.isArray(data?.handled) ? data.handled.filter((id): id is string => typeof id === 'string') : [],
  };
}

/** The household's Google Tasks settings, live; null until the first read. */
export function watchTasksSettings(db: Firestore, householdId: string, onChange: (s: TasksSettings) => void): Unsubscribe {
  return onSnapshot(
    settingsDoc(db, householdId),
    (snap) => onChange(toTasksSettings(snap.data())),
    () => onChange(toTasksSettings(undefined)),
  );
}

/** Saves which Google lists feed which household list. */
export function saveGoogleTasksLinks(db: Firestore, householdId: string, links: GoogleTasksLink[], by: string): Promise<void> {
  const googleTasks = links.slice(0, MAX_LINKS).map((l) => ({ googleListId: l.googleListId.slice(0, 200), title: l.title.slice(0, 100), listId: l.listId.slice(0, 100), mode: l.mode }));
  return setDoc(settingsDoc(db, householdId), { googleTasks, updatedAt: Date.now(), by }, { merge: true });
}

/**
 * Records Google tasks as taken in. Added to the stored list (so two devices at once both count),
 * and when it nears `MAX_HANDLED`, rewritten as the latest ones.
 */
export function markHandled(db: Firestore, householdId: string, settings: TasksSettings, ids: string[], by: string): Promise<void> {
  const full = settings.handled.length + ids.length > MAX_HANDLED - 50;
  const handled = full ? [...settings.handled.filter((id) => !ids.includes(id)), ...ids].slice(-(MAX_HANDLED - 100)) : arrayUnion(...ids);
  return setDoc(settingsDoc(db, householdId), { googleTasks: settings.googleTasks, handled, updatedAt: Date.now(), by }, { merge: true });
}

/** The item a Google task becomes on a household list: its title, notes and day; a stable id so two devices never add it twice. */
export function googleTaskItem(task: GoogleTask, link: Pick<GoogleTasksLink, 'listId'>, listIcon: ListIcon | undefined, addedBy: string): NewItem {
  return {
    id: googleTaskItemId(task.id),
    listId: link.listId,
    listIcon,
    name: task.title,
    notes: task.notes.slice(0, 500),
    addedBy,
    googleTaskId: task.id,
    ...(task.due ? { due: ymdToTime(task.due) } : {}),
  };
}

/** Firestore-safe, the same on every device. */
export const googleTaskItemId = (taskId: string) => `gt-${taskId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200)}`;
