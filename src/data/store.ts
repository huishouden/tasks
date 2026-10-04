import { useEffect, useMemo, useRef, useState } from 'react';
import { localizeAgenda, syncAgenda } from '@huishouden/pwa-kit/agenda';
import { localizeReminders, syncReminders } from '@huishouden/pwa-kit/reminders';
import { localizeTodos, syncTodos } from '@huishouden/pwa-kit/todos';
import { APP, agendaItems, reminderItems, todoItems } from './publish';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  type Firestore,
  type Query,
  type QuerySnapshot,
} from 'firebase/firestore';
import { deleteField, setDoc, updateDoc, writeBatch } from '@huishouden/pwa-kit/firestore';
import { watchHousehold } from '@huishouden/pwa-kit/household';
import { forgetSilentSignIn } from '@huishouden/pwa-kit/auth';
import { forgetGoogleToken } from '@huishouden/pwa-kit/google-token';
import { getFirebase } from '../lib/firebase';
import { parseWhen } from './when';
import {
  CATEGORIES,
  DEFAULT_LISTS,
  TASK_DEFAULT_LISTS,
  URGENCY,
  isTaskList,
  itemData,
  moveInOrder,
  toggleSubtask,
  positionBetween,
  type Household,
  type ListIcon,
  type ListItem,
  type ShoppingList,
  type Urgency,
} from './model';
import { track } from '@huishouden/pwa-kit/observability';

export type AuthState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: User; email: string; db: Firestore; auth: Auth };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  useEffect(() => {
    let unsub = () => {};
    getFirebase()
      .then(({ auth, db }) => {
        unsub = onAuthStateChanged(auth, (user) => {
          if (user?.email) {
            setState({ status: 'signed-in', user, email: user.email.toLowerCase(), db, auth });
          } else {
            setState({ status: 'signed-out' });
          }
        });
      })
      .catch((e: unknown) => setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => unsub();
  }, []);
  return state;
}

export async function signIn(): Promise<void> {
  const { auth } = await getFirebase();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    // Fall back to a full-page redirect only where popups are blocked outright.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
    throw e;
  }
}

/** Signs out here, stops silent sign-in from undoing it, and forgets this device's Google API tokens. */
export async function signOut(): Promise<void> {
  const { auth } = await getFirebase();
  await forgetSilentSignIn();
  forgetGoogleToken();
  await fbSignOut(auth);
}

export type HouseholdState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'error'; message: string }
  | { status: 'ready'; household: Household };

/**
 * The household this person belongs to, chosen the same way in every Huishouden app (the kit's
 * `watchHousehold`: the oldest, skipping one the server has not accepted yet).
 */
export function useHousehold(db: Firestore, email: string): HouseholdState {
  const [state, setState] = useState<HouseholdState>({ status: 'loading' });
  useEffect(
    () => watchHousehold(db, email, (next) => setState(next.status === 'error' ? { status: 'error', message: next.error.message } : next)),
    [db, email],
  );
  return state;
}

/** Starts a household with the default lists, Groceries' shopping lists included (one batch, so the
 * household never exists without them; the kit's createHousehold writes the household alone). */
export async function createHousehold(db: Firestore, email: string, name: string): Promise<void> {
  const ref = doc(collection(db, 'households'));
  const now = Date.now();
  // One batch, so the household never exists without its lists.
  const batch = writeBatch(db);
  batch.set(ref, { name, members: [email], roles: { [email]: 'admin' }, createdAt: now });
  for (const list of DEFAULT_LISTS) {
    batch.set(doc(db, 'households', ref.id, 'lists', list.id), { ...list, createdAt: now });
  }
  await batch.commit();
}

/**
 * The household's to-do lists and their items. Shopping lists share the same collections and belong
 * to Huishouden Groceries: they and their items are left out here (`isTaskList`).
 */
export interface HouseholdData {
  lists: ShoppingList[];
  items: ListItem[];
  /** The shopping lists, Groceries': named where Tasks points there (Google Tasks links, old links). */
  otherLists: ShoppingList[];
  loaded: boolean;
  /** Set while a subscription is failing; it keeps retrying in the background. */
  error: string | null;
  /** True while local writes have not reached the server yet (offline or in flight). */
  pendingWrites: boolean;
}

/**
 * onSnapshot that resubscribes after an error instead of going silent. Firestore ends a listener
 * permanently on its first error, and a transient permission-denied (membership not yet visible
 * to the server) would otherwise leave the screen loading forever.
 */
function resilientSnapshot(
  ref: Query,
  onData: (snap: QuerySnapshot) => void,
  onError: (message: string | null) => void,
): () => void {
  let unsub = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let stopped = false;
  const start = () => {
    unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        attempt = 0;
        onError(null);
        onData(snap);
      },
      (e) => {
        onError(e.message);
        if (stopped) return;
        timer = setTimeout(start, Math.min(30_000, 1000 * 2 ** attempt++));
      },
    );
  };
  start();
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsub();
  };
}

export function useHouseholdData(db: Firestore, householdId: string): HouseholdData {
  const [lists, setLists] = useState<ShoppingList[] | null>(null);
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [otherLists, setOtherLists] = useState<ShoppingList[]>([]);
  const [pending, setPending] = useState({ lists: false, items: false });
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const col = (name: string) => collection(db, 'households', householdId, name);
    const errorFor = (key: string) => (message: string | null) => setErrors((e) => (e[key] === message ? e : { ...e, [key]: message }));
    const unsubs = [
      resilientSnapshot(
        col('lists'),
        (snap) => {
          const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ShoppingList).sort((a, b) => a.sortOrder - b.sortOrder);
          setLists(all.filter((l) => isTaskList(l.icon)));
          setOtherLists(all.filter((l) => !isTaskList(l.icon)));
          setPending((p) => ({ ...p, lists: snap.metadata.hasPendingWrites }));
        },
        errorFor('lists'),
      ),
      resilientSnapshot(
        col('items'),
        (snap) => {
          setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ListItem));
          setPending((p) => ({ ...p, items: snap.metadata.hasPendingWrites }));
        },
        errorFor('items'),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [db, householdId]);

  const ownItems = useMemo(() => {
    if (!lists || !items) return [];
    const ids = new Set(lists.map((l) => l.id));
    return items.filter((i) => ids.has(i.listId));
  }, [lists, items]);

  return {
    lists: lists ?? [],
    items: ownItems,
    otherLists,
    loaded: lists !== null && items !== null,
    error: Object.values(errors).find((e) => e) ?? null,
    pendingWrites: pending.lists || pending.items,
  };
}

export interface NewItem {
  listId: string;
  /** The list's kind (to-do lists only here; kept so Google Tasks items say where they go). */
  listIcon?: ListIcon;
  name: string;
  notes?: string;
  urgency?: Urgency;
  addedBy: string;
  /** A stable id (an item brought in from Google Tasks), so adding it twice writes one item. */
  id?: string;
  /** The Google task it came from. */
  googleTaskId?: string;
  /** A day it is due (local midnight, ms), used when the name has no date of its own. */
  due?: number;
  /** The adder's email, recorded as `by`: helpers and kids change and delete only their own. */
  by?: string;
}

/**
 * A write the caller waits for. On the sample household's offline Firestore the server never
 * acknowledges anything, so there it counts as done once it is in the local cache (at once).
 */
export function settled(write: Promise<void>, local: boolean): Promise<void> {
  if (!local) return write;
  write.catch(() => {});
  return Promise.resolve();
}

export class HouseholdRepo {
  constructor(
    private readonly db: Firestore,
    private readonly householdId: string,
    /** The signed-out sample household: nothing is ever acknowledged by a server. */
    private readonly local = false,
  ) {}

  /** Usage counts come from real households only, not from someone trying the sample. */
  private track(action: string): void {
    if (!this.local) track(action);
  }

  private col(name: 'lists' | 'items') {
    return collection(this.db, 'households', this.householdId, name);
  }

  // Writes are not awaited by callers: Firestore applies them to the local cache
  // immediately and syncs when online, so the UI never blocks on the network.
  /** Adds the item and returns its id, or null when the name is blank. */
  addItem(input: NewItem): string | null {
    this.track('add item');
    const typed = input.name.trim();
    if (!typed) return null;
    const now = Date.now();
    // "Drycleaners dropoff before 6" is saved as "Drycleaners dropoff", due today by 6 PM.
    const when = parseWhen(typed, now);
    const name = when?.rest ?? typed;
    // An explicit Need today stays; rows show the due time instead of the badge.
    const urgency = input.urgency ?? URGENCY.NORMAL;
    const ref = input.id ? doc(this.col('items'), input.id) : doc(this.col('items'));
    const batch = writeBatch(this.db);
    batch.set(ref, {
      listId: input.listId,
      name,
      // One document shape for both apps: Groceries files items by section, Tasks' are chores.
      category: CATEGORIES.CHORES,
      quantity: '1',
      notes: input.notes?.trim() ?? '',
      addedBy: input.addedBy,
      ...(input.by ? { by: input.by } : {}),
      completed: false,
      urgency,
      position: urgency === URGENCY.URGENT ? -now : now,
      ...(when ? { dueAt: when.dueAt, allDay: when.allDay, dueBy: when.by } : input.due ? { dueAt: input.due, allDay: true, dueBy: false } : {}),
      ...(input.googleTaskId ? { googleTaskId: input.googleTaskId } : {}),
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    } satisfies Omit<ListItem, 'id'>);
    void batch.commit();
    return ref.id;
  }

  /**
   * Ticks the item off or back on. Un-ticking a cancelled item reopens it and, for someone who may
   * change the item (`mayChange`), drops the cancel; helpers and kids change only the tick fields on
   * others' items, and a later tick then reads as done (`isCancelled`).
   */
  toggleCompleted(item: ListItem, mayChange = true): void {
    this.track('check item');
    const now = Date.now();
    const completed = !item.completed;
    void updateDoc(doc(this.col('items'), item.id), {
      completed,
      completedAt: completed ? now : null,
      updatedAt: now,
      ...(mayChange && item.cancelledAt != null ? { cancelledAt: deleteField(), cancelledBy: deleteField() } : {}),
    });
  }

  /** Closes the item as not needed: it moves to Done marked "Cancelled". Restore it with `restoreItems`. */
  cancelItem(item: ListItem, by: string): void {
    this.track('cancel item');
    const now = Date.now();
    void updateDoc(doc(this.col('items'), item.id), { completed: true, completedAt: now, cancelledAt: now, cancelledBy: by, updatedAt: now });
  }

  updateItem(id: string, changes: Partial<Pick<ListItem, 'name' | 'notes' | 'urgency' | 'addedBy' | 'listId' | 'position' | 'dueAt' | 'allDay' | 'dueBy' | 'location' | 'place' | 'link' | 'subtasks'>>): void {
    void updateDoc(doc(this.col('items'), id), { ...changes, updatedAt: Date.now() });
  }

  /**
   * Moves one item within an ordered list. Usually a single write to the moved item; when its
   * neighbours' positions are too close to split, the whole list is renumbered in one batch.
   */
  toggleSubtask(item: ListItem, subtaskId: string, mayChange = true): void {
    const { subtasks, allDone } = toggleSubtask(item.subtasks ?? [], subtaskId);
    const now = Date.now();
    void updateDoc(doc(this.col('items'), item.id), {
      subtasks,
      completed: allDone,
      completedAt: allDone ? (item.completed ? item.completedAt : now) : null,
      updatedAt: now,
      // A step ticked on a cancelled item takes it back up.
      ...(mayChange && item.cancelledAt != null ? { cancelledAt: deleteField(), cancelledBy: deleteField() } : {}),
    });
  }

  moveItem(ordered: ListItem[], from: number, to: number): void {
    if (from === to) return;
    const next = moveInOrder(ordered, from, to);
    const position = positionBetween(next[to - 1], next[to + 1]);
    if (position !== null) {
      void updateDoc(doc(this.col('items'), ordered[from].id), { position, updatedAt: Date.now() });
      return;
    }
    // Small numbers keep new items (positioned by timestamp) after the list and urgent ones before it.
    const batch = writeBatch(this.db);
    next.forEach((item, i) => batch.update(doc(this.col('items'), item.id), { position: (i + 1) * 1000 }));
    void batch.commit();
  }

  deleteItem(item: ListItem): void {
    const batch = writeBatch(this.db);
    batch.delete(doc(this.col('items'), item.id));
    void batch.commit();
  }

  /** Deletes the done items among `items` and returns them, so they can be restored. */
  clearCompleted(items: ListItem[]): ListItem[] {
    this.track('clear completed');
    const done = items.filter((i) => i.completed);
    if (done.length === 0) return done;
    const batch = writeBatch(this.db);
    for (const item of done) batch.delete(doc(this.col('items'), item.id));
    void batch.commit();
    return done;
  }

  /** Writes deleted items back under their old ids, exactly as they were. */
  restoreItems(items: ListItem[]): void {
    if (items.length === 0) return;
    const batch = writeBatch(this.db);
    for (const item of items) batch.set(doc(this.col('items'), item.id), itemData(item));
    void batch.commit();
  }

  createList(name: string, icon: ListIcon, color: string, sortOrder: number): string {
    this.track('create list');
    const ref = doc(this.col('lists'));
    void setDoc(ref, { name: name.trim(), description: '', icon, color, sortOrder, createdAt: Date.now() });
    return ref.id;
  }

  /** Saves a new list order; one batch so every device sees the same order at once. */
  reorderLists(orderedIds: string[]): void {
    const batch = writeBatch(this.db);
    orderedIds.forEach((id, i) => batch.update(doc(this.col('lists'), id), { sortOrder: i }));
    void batch.commit();
  }

  async deleteList(listId: string): Promise<void> {
    const items = await getDocs(query(this.col('items'), where('listId', '==', listId)));
    const batch = writeBatch(this.db);
    items.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(this.col('lists'), listId));
    await settled(batch.commit(), this.local);
  }

  /** Brings back Tasks' own default lists; the shopping ones are Groceries' to restore. */
  restoreDefaultLists(): void {
    const batch = writeBatch(this.db);
    const now = Date.now();
    for (const list of TASK_DEFAULT_LISTS) batch.set(doc(this.col('lists'), list.id), { ...list, createdAt: now });
    void batch.commit();
  }
}

/** How long the lists stay still before the agenda and reminders are brought in step. */
const PUBLISH_DELAY_MS = 3000;

/**
 * Keeps the household agenda, the household to-do list and the push reminders in step with the to-do
 * lists (planned dinners are Groceries' to publish), from whichever device has Tasks open: a few
 * seconds after the last change, and once on open. The kit writes only what changed, so devices doing
 * the same work cost a read each and no writes.
 */
export function usePublish(db: Firestore, householdId: string, by: string, data: HouseholdData, enabled = true, restricted = false): void {
  const ready = enabled && data.loaded;
  const agenda = useMemo(() => (ready ? agendaItems(data.items, data.lists) : null), [ready, data.items, data.lists]);
  const reminders = useMemo(() => (ready ? reminderItems(data.items) : null), [ready, data.items]);
  const todos = useMemo(() => (ready ? todoItems(data.items, data.lists) : null), [ready, data.items, data.lists]);
  const agendaKey = agenda ? JSON.stringify(agenda) : null;
  const todosKey = todos ? JSON.stringify(todos) : null;
  const remindersKey = reminders ? JSON.stringify(reminders) : null;
  // The keys notice a change; each write builds the records again in every language, so every
  // member's device reads its own (docs/i18n.md step 8).
  const latest = useRef(data);
  latest.current = data;
  useEffect(() => {
    if (!agendaKey) return;
    const timer = setTimeout(() => {
      const { items, lists } = latest.current;
      void localizeAgenda(() => agendaItems(items, lists))
        .then((records) => syncAgenda(db, householdId, APP, records, { by, restricted }))
        .catch(() => {});
    }, PUBLISH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [db, householdId, by, agendaKey, restricted]);
  useEffect(() => {
    if (!todosKey) return;
    const timer = setTimeout(() => {
      const { items, lists } = latest.current;
      void localizeTodos(() => todoItems(items, lists))
        .then((records) => syncTodos(db, householdId, APP, records, { by, restricted }))
        .catch(() => {});
    }, PUBLISH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [db, householdId, by, todosKey, restricted]);
  useEffect(() => {
    if (!remindersKey) return;
    const timer = setTimeout(() => {
      const { items } = latest.current;
      void localizeReminders(() => reminderItems(items))
        .then((records) => syncReminders(db, householdId, APP, records, by, undefined, { restricted }))
        .catch(() => {});
    }, PUBLISH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [db, householdId, by, remindersKey, restricted]);
}
