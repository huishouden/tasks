import { useEffect, useMemo, useState } from 'react';
import { syncAgenda, type AgendaInput } from '@huishouden/pwa-kit/agenda';
import { syncReminders, type ReminderInput } from '@huishouden/pwa-kit/reminders';
import { APP, agendaItems, reminderItems } from './publish';
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
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type Query,
  type QuerySnapshot,
} from 'firebase/firestore';
import { deleteDoc, increment, setDoc, updateDoc, writeBatch } from '@huishouden/pwa-kit/firestore';
import { watchFood, type FoodPreferences } from '@huishouden/pwa-kit/food';
import { watchHousehold } from '@huishouden/pwa-kit/household';
import { forgetSilentSignIn } from '@huishouden/pwa-kit/auth';
import { forgetGoogleToken } from '@huishouden/pwa-kit/google-token';
import { getFirebase } from '../lib/firebase';
import { mealKey, type FavoriteMeal, type Meal, type Menu } from './menus';
import type { GeoPoint, LearnedAisle, StoreLayout } from './stores';
import { guessCategory } from './categorize';
import { parseWhen } from './when';
import { planQuery, type PlannedMeal } from './mealPlan';
import type { Ymd } from '@huishouden/pwa-kit/time';
import {
  CATEGORIES,
  DEFAULT_LISTS,
  URGENCY,
  itemData,
  moveInOrder,
  toggleSubtask,
  positionBetween,
  stapleKey,
  type Category,
  type Household,
  type ListIcon,
  type ListItem,
  type ShoppingList,
  type Staple,
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

/** Starts a household with the default lists. One batch, so the household never exists without them
 * (the kit's createHousehold writes the household alone). */
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

export interface HouseholdData {
  lists: ShoppingList[];
  items: ListItem[];
  staples: Staple[];
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
  const [staples, setStaples] = useState<Staple[]>([]);
  const [pending, setPending] = useState({ lists: false, items: false });
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const col = (name: string) => collection(db, 'households', householdId, name);
    const errorFor = (key: string) => (message: string | null) => setErrors((e) => (e[key] === message ? e : { ...e, [key]: message }));
    const unsubs = [
      resilientSnapshot(
        col('lists'),
        (snap) => {
          setLists(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ShoppingList).sort((a, b) => a.sortOrder - b.sortOrder));
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
      resilientSnapshot(col('staples'), (snap) => setStaples(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Staple)), errorFor('staples')),
    ];
    return () => unsubs.forEach((u) => u());
  }, [db, householdId]);

  return {
    lists: lists ?? [],
    items: items ?? [],
    staples,
    loaded: lists !== null && items !== null,
    error: Object.values(errors).find((e) => e) ?? null,
    pendingWrites: pending.lists || pending.items,
  };
}

/** Learned aisles at one store, keyed like staples (normalised item name). */
export function useStoreAisles(db: Firestore, householdId: string, storeId: string | null): Map<string, string> {
  const [aisles, setAisles] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!storeId) {
      setAisles(new Map());
      return;
    }
    return resilientSnapshot(
      collection(db, 'households', householdId, 'stores', storeId, 'aisles'),
      (snap) => setAisles(new Map(snap.docs.map((d) => [d.id, (d.data() as LearnedAisle).aisle]))),
      () => {},
    );
  }, [db, householdId, storeId]);
  return aisles;
}

/**
 * The household's saved store layouts, alphabetical; null until the first snapshot, so "not loaded
 * yet" is not mistaken for "none saved".
 */
export function useStores(db: Firestore, householdId: string): StoreLayout[] | null {
  const [stores, setStores] = useState<StoreLayout[] | null>(null);
  useEffect(
    () =>
      resilientSnapshot(
        collection(db, 'households', householdId, 'stores'),
        (snap) => setStores(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StoreLayout).sort((a, b) => a.name.localeCompare(b.name))),
        () => {},
      ),
    [db, householdId],
  );
  return stores;
}

/**
 * The household's food preferences (people, diets, pantry) from the portal's settings, or null
 * until the first read. A failed read leaves null, and meal ideas then use the default pantry and
 * no diets, so they still work.
 */
export function useFood(db: Firestore, householdId: string): FoodPreferences | null {
  const [food, setFood] = useState<FoodPreferences | null>(null);
  useEffect(() => watchFood(db, householdId, setFood, () => {}), [db, householdId]);
  return food;
}

/** The household's meal plan for the given days (shared, live); null until the first snapshot. */
export function useMealPlan(db: Firestore, householdId: string, days: Ymd[]): PlannedMeal[] | null {
  const [plan, setPlan] = useState<PlannedMeal[] | null>(null);
  const from = days[0];
  const to = days[days.length - 1];
  useEffect(
    () =>
      resilientSnapshot(
        planQuery(db, householdId, from, to),
        (snap) => setPlan(snap.docs.map((d) => d.data() as PlannedMeal)),
        () => {},
      ),
    [db, householdId, from, to],
  );
  return plan;
}

/** Saved meal ideas, newest first. */
export function useMenus(db: Firestore, householdId: string): Menu[] {
  const [menus, setMenus] = useState<Menu[]>([]);
  useEffect(
    () =>
      resilientSnapshot(
        query(collection(db, 'households', householdId, 'menus'), orderBy('createdAt', 'desc'), limit(20)),
        (snap) => setMenus(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Menu)),
        () => {},
      ),
    [db, householdId],
  );
  return menus;
}

/** Meals the household starred, newest first. */
export function useFavorites(db: Firestore, householdId: string): FavoriteMeal[] {
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
  useEffect(
    () =>
      resilientSnapshot(
        query(collection(db, 'households', householdId, 'favorites'), orderBy('savedAt', 'desc')),
        (snap) => setFavorites(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FavoriteMeal)),
        () => {},
      ),
    [db, householdId],
  );
  return favorites;
}

export interface NewItem {
  listId: string;
  /** The list's kind, so a to-do on a chores list is not guessed into a store aisle. */
  listIcon?: ListIcon;
  name: string;
  category?: Category;
  quantity?: string;
  notes?: string;
  urgency?: Urgency;
  addedBy: string;
<<<<<<< HEAD
  /** A stable id (an item brought in from Google Tasks), so adding it twice writes one item. */
  id?: string;
  /** The Google task it came from. */
  googleTaskId?: string;
  /** A day it is due (local midnight, ms), used when the name has no date of its own. */
  due?: number;
=======
  /** The adder's email, recorded as `by`: helpers and kids change and delete only their own. */
  by?: string;
>>>>>>> 6d280fc (feat(roles): helpers and kids tick anyone's items and change only their own; settings for admins and members)
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

  private col(name: 'lists' | 'items' | 'staples' | 'menus' | 'stores' | 'favorites') {
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
    const category =
      input.category && input.category !== CATEGORIES.OTHER ? input.category : guessCategory(name, input.listIcon);
    const quantity = input.quantity?.trim() || '1';
    const ref = input.id ? doc(this.col('items'), input.id) : doc(this.col('items'));
    const batch = writeBatch(this.db);
    batch.set(ref, {
      listId: input.listId,
      name,
      category,
      quantity,
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
    batch.set(
      doc(this.col('staples'), stapleKey(name)),
      { displayName: name, category, defaultQuantity: quantity, timesAdded: increment(1), lastAddedAt: now },
      { merge: true },
    );
    void batch.commit();
    return ref.id;
  }

  /** Remembers an aisle for an item name, so the next time it is added it lands there. */
  setStapleCategory(name: string, category: Category): void {
    void setDoc(doc(this.col('staples'), stapleKey(name)), { displayName: name.trim(), category }, { merge: true });
  }

  toggleCompleted(item: ListItem): void {
    this.track('check item');
    const now = Date.now();
    const completed = !item.completed;
    const batch = writeBatch(this.db);
    batch.update(doc(this.col('items'), item.id), { completed, completedAt: completed ? now : null, updatedAt: now });
    if (completed) {
      batch.set(
        doc(this.col('staples'), stapleKey(item.name)),
        { displayName: item.name, category: item.category, timesCompleted: increment(1) },
        { merge: true },
      );
    }
    void batch.commit();
  }

  updateItem(id: string, changes: Partial<Pick<ListItem, 'name' | 'category' | 'quantity' | 'notes' | 'urgency' | 'addedBy' | 'listId' | 'position' | 'dueAt' | 'allDay' | 'dueBy' | 'location' | 'place' | 'link' | 'subtasks'>>): void {
    void updateDoc(doc(this.col('items'), id), { ...changes, updatedAt: Date.now() });
  }

  /**
   * Moves one item within an ordered list. Usually a single write to the moved item; when its
   * neighbours' positions are too close to split, the whole list is renumbered in one batch.
   */
  toggleSubtask(item: ListItem, subtaskId: string): void {
    const { subtasks, allDone } = toggleSubtask(item.subtasks ?? [], subtaskId);
    const now = Date.now();
    void updateDoc(doc(this.col('items'), item.id), {
      subtasks,
      completed: allDone,
      completedAt: allDone ? (item.completed ? item.completedAt : now) : null,
      updatedAt: now,
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

  restoreDefaultLists(): void {
    const batch = writeBatch(this.db);
    const now = Date.now();
    for (const list of DEFAULT_LISTS) batch.set(doc(this.col('lists'), list.id), { ...list, createdAt: now });
    void batch.commit();
  }

  createStore(name: string, categoryOrder: StoreLayout['categoryOrder'], found?: { location: GeoPoint; osmId: string; address: string }): string {
    this.track('add store');
    const ref = doc(this.col('stores'));
    void setDoc(ref, {
      name: name.trim(),
      categoryOrder,
      aisleLabels: {},
      location: found?.location ?? null,
      osmId: found?.osmId ?? null,
      address: found?.address ?? '',
      createdAt: Date.now(),
    } satisfies Omit<StoreLayout, 'id'>);
    return ref.id;
  }

  /** Records where an item is in a store; a blank aisle forgets it. */
  setAisle(storeId: string, itemName: string, aisle: string, by: string): void {
    this.track('note aisle');
    const ref = doc(this.db, 'households', this.householdId, 'stores', storeId, 'aisles', stapleKey(itemName));
    const value = aisle.trim();
    if (!value) {
      const batch = writeBatch(this.db);
      batch.delete(ref);
      void batch.commit();
      return;
    }
    void setDoc(ref, { aisle: value.slice(0, 24), name: itemName.trim(), updatedAt: Date.now(), updatedBy: by } satisfies Omit<LearnedAisle, 'id'>);
  }

  updateStore(id: string, changes: Partial<Pick<StoreLayout, 'name' | 'categoryOrder' | 'aisleLabels'>> & { location?: GeoPoint | null }): void {
    void updateDoc(doc(this.col('stores'), id), changes);
  }

  deleteStore(id: string): void {
    const batch = writeBatch(this.db);
    batch.delete(doc(this.col('stores'), id));
    void batch.commit();
  }

  async saveMenu(ingredients: string[], meals: Meal[], createdBy: string): Promise<string> {
    this.track('save meal ideas');
    const ref = doc(this.col('menus'));
    await settled(setDoc(ref, { createdAt: Date.now(), createdBy, ingredients, meals } satisfies Omit<Menu, 'id'>), this.local);
    return ref.id;
  }

  /** Puts a deleted batch of ideas back under its old id (for Undo). */
  async restoreMenu(menu: Menu): Promise<void> {
    const { id, ...data } = menu;
    await settled(setDoc(doc(this.col('menus'), id), data), this.local);
  }

  deleteMenu(id: string): void {
    const batch = writeBatch(this.db);
    batch.delete(doc(this.col('menus'), id));
    void batch.commit();
  }

  /**
   * Keyed by the meal's name, so starring the same idea from two menus keeps one favorite. The
   * promise settles only when the server answers (never while offline); the local cache shows
   * the change immediately, so callers should not wait on it.
   */
  saveFavorite(meal: Meal, savedBy: string): Promise<void> {
    this.track('save favorite meal');
    return settled(setDoc(doc(this.col('favorites'), mealKey(meal)), { meal, savedAt: Date.now(), savedBy } satisfies Omit<FavoriteMeal, 'id'>), this.local);
  }

  removeFavorite(id: string): Promise<void> {
    return settled(deleteDoc(doc(this.col('favorites'), id)), this.local);
  }

  forgetStaple(id: string): void {
    const batch = writeBatch(this.db);
    batch.delete(doc(this.col('staples'), id));
    void batch.commit();
  }
}

/** How long the lists stay still before the agenda and reminders are brought in step. */
const PUBLISH_DELAY_MS = 3000;

/**
 * Keeps the household agenda and the push reminders in step with the lists and the meal plan, from
 * whichever device has Tasks open: a few seconds after the last change, and once on open. The kit
 * writes only what changed, so devices doing the same work cost a read each and no writes.
 */
export function usePublish(db: Firestore, householdId: string, by: string, data: HouseholdData, plan: PlannedMeal[] | null, enabled = true, restricted = false): void {
  const ready = enabled && data.loaded && plan !== null;
  const agenda = useMemo(() => (ready ? agendaItems(data.items, data.lists, plan) : null), [ready, data.items, data.lists, plan]);
  const reminders = useMemo(() => (ready ? reminderItems(data.items) : null), [ready, data.items]);
  const agendaKey = agenda ? JSON.stringify(agenda) : null;
  const remindersKey = reminders ? JSON.stringify(reminders) : null;
  useEffect(() => {
    if (!agendaKey) return;
    const timer = setTimeout(() => void syncAgenda(db, householdId, APP, JSON.parse(agendaKey) as AgendaInput[], { by, restricted }).catch(() => {}), PUBLISH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [db, householdId, by, agendaKey, restricted]);
  useEffect(() => {
    if (!remindersKey) return;
    const timer = setTimeout(() => void syncReminders(db, householdId, APP, JSON.parse(remindersKey) as ReminderInput[], by, undefined, { restricted }).catch(() => {}), PUBLISH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [db, householdId, by, remindersKey, restricted]);
}
