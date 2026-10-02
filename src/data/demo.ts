import { initializeApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { collection, disableNetwork, doc, initializeFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';
// On a Firestore that didn't come from initFirestore the kit's writes are Firestore's own (no outbox).
import { writeBatch } from '@huishouden/pwa-kit/firestore';
import { addDays, toYmd } from '@huishouden/pwa-kit/time';
import { CATEGORIES, DEFAULT_LISTS, URGENCY, type Category, type Household, type ListItem, type Subtask, type Urgency } from './model';
import { validateMeals, type FavoriteMeal, type Meal, type MealContext, type Menu, type ValidatedMeals } from './menus';
import type { PlannedMeal } from './mealPlan';
import type { StoreLayout } from './stores';

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

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const at = (now: number, days: number, hour: number, minute = 0) => {
  const d = new Date(startOfDay(now) + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
};

let seq = 0;
function item(listId: string, name: string, category: Category, now: number, extra: Partial<ListItem> = {}): ListItem {
  seq += 1;
  const created = now - (40 - seq) * HOUR;
  return {
    id: `demo-${seq}`,
    listId,
    name,
    category,
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

const bought = (daysAgo: number, now: number): Partial<ListItem> => ({ completed: true, completedAt: now - daysAgo * DAY - 2 * HOUR });
const steps = (texts: string[], done: number): Subtask[] => texts.map((text, i) => ({ id: `s${i}`, text, done: i < done }));

/** The sample household's items, dated from `now` so it always looks current. */
export function demoItems(now: number): ListItem[] {
  seq = 0;
  const { PRODUCE, DAIRY_EGGS, BAKERY, MEAT_SEAFOOD, PANTRY, BEVERAGES, SNACKS, HOUSEHOLD, HARDWARE_HOME, CHORES, FROZEN } = CATEGORIES;
  return [
    item('groceries', 'Eggs', DAIRY_EGGS, now, { quantity: 'a dozen', urgency: URGENCY.URGENT, position: -now }),
    item('groceries', 'Whole milk', DAIRY_EGGS, now),
    item('groceries', 'Bananas', PRODUCE, now),
    item('groceries', 'Baby spinach', PRODUCE, now),
    item('groceries', 'Sourdough bread', BAKERY, now),
    item('groceries', 'Chicken thighs', MEAT_SEAFOOD, now, { quantity: '2 lbs' }),
    item('groceries', 'Greek yogurt', DAIRY_EGGS, now),
    item('groceries', 'Coffee beans', BEVERAGES, now, { notes: 'Medium roast' }),
    item('groceries', 'Frozen peas', FROZEN, now),
    // Bought this week: what Meals plans from.
    item('groceries', 'Salmon', MEAT_SEAFOOD, now, bought(1, now)),
    item('groceries', 'Zucchini', PRODUCE, now, bought(1, now)),
    item('groceries', 'Bell peppers', PRODUCE, now, bought(2, now)),
    item('costco', 'Rice', PANTRY, now, bought(3, now)),
    item('costco', 'Potatoes', PRODUCE, now, bought(3, now)),
    item('costco', 'Paper towels', HOUSEHOLD, now),
    item('costco', 'Trail mix', SNACKS, now),
    item('pantry', 'Olive oil', PANTRY, now),
    item('pantry', 'Black beans', PANTRY, now, { quantity: '3 cans' }),
    item('hardware', 'Furnace filter 16x25', HARDWARE_HOME, now),
    item('hardware', 'Light bulbs', HARDWARE_HOME, now, { quantity: '4', notes: 'Soft white' }),
    item('chores', 'Drop off dry cleaning', CHORES, now, { dueAt: at(now, 0, 18), dueBy: true, location: 'Example Cleaners, 12 Main St' }),
    item('chores', 'Call the plumber about the kitchen sink', CHORES, now, { dueAt: at(now, 1, 10) }),
    item('chores', 'Return library books', CHORES, now, { dueAt: at(now, 3, 0), allDay: true, dueBy: true }),
    item('chores', 'Garage clean-out', CHORES, now, { subtasks: steps(['Sort the tools', 'Sweep the floor', 'Fix the light'], 1) }),
    item('chores', 'Cancel streaming trial', CHORES, now, { dueAt: at(now, 9, 0), allDay: true, dueBy: true }),
    item('chores', 'Water the plants', CHORES, now, bought(0, now)),
  ];
}

const meal = (type: Meal['type'], name: string, parts: [string[], string][], levels: Meal['levels'], extras?: string[]): Meal => ({
  type,
  name,
  parts: parts.map(([ingredients, prep]) => ({ ingredients, prep })),
  ...(extras ? { extras } : {}),
  levels,
});

export function demoMeals(): Meal[] {
  return [
    meal('breakfast', 'Spinach and egg scramble on toast', [[['Eggs', 'Baby spinach'], 'Scrambled in a little butter'], [['Sourdough bread'], 'Toasted']], { heat: 0, acidity: 0, richness: 1, sweetness: 0 }),
    meal('lunch', 'Rice bowl with peppers and black beans', [[['Rice'], 'Cooked in a pot'], [['Bell peppers', 'Black beans'], 'Sautéed with a little oil and cumin']], { heat: 1, acidity: 1, richness: 1, sweetness: 0 }),
    meal('dinner', 'Baked salmon with zucchini and potatoes', [[['Salmon'], 'Baked with a little oil, salt and garlic powder'], [['Zucchini', 'Potatoes'], 'Roasted with oil and salt']], { heat: 0, acidity: 0, richness: 1, sweetness: 0 }, ['Fresh dill']),
    meal('dinner', 'Chicken thighs with peas and rice', [[['Chicken thighs'], 'Roasted with paprika'], [['Frozen peas', 'Rice'], 'Steamed']], { heat: 0, acidity: 0, richness: 2, sweetness: 0 }),
    meal('snack', 'Greek yogurt with banana', [[['Greek yogurt', 'Bananas'], 'Sliced over the top']], { heat: 0, acidity: 1, richness: 1, sweetness: 1 }),
  ];
}

export function demoStore(): Omit<StoreLayout, 'id'> {
  return { name: 'Example Market', categoryOrder: [], aisleLabels: { [CATEGORIES.PRODUCE]: 'Front', [CATEGORIES.DAIRY_EGGS]: 'Back wall' }, location: null, osmId: null, address: '', createdAt: 0 };
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
    for (const list of DEFAULT_LISTS) batch.set(doc(col('lists'), list.id), { ...list, createdAt: now - 90 * DAY });
    for (const i of demoItems(now)) {
      const { id, ...data } = i;
      batch.set(doc(col('items'), id), Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
    }
    const meals = demoMeals();
    batch.set(doc(col('menus'), 'demo-menu'), { createdAt: now - 3 * HOUR, createdBy: 'Sam', ingredients: ['Salmon', 'Zucchini', 'Rice'], meals } satisfies Omit<Menu, 'id'>);
    batch.set(doc(col('favorites'), 'baked-salmon-with-zucchini-and-potatoes'), { meal: meals[2], savedAt: now - DAY, savedBy: 'Alex' } satisfies Omit<FavoriteMeal, 'id'>);
    const tomorrow = addDays(toYmd(now), 1);
    batch.set(doc(col('mealPlan'), `${tomorrow}_dinner`), { day: tomorrow, type: 'dinner', name: meals[2].name, meal: meals[2], by: DEMO_EMAIL, updatedAt: now } satisfies PlannedMeal);
    batch.set(doc(col('stores'), 'demo-store'), demoStore());
    // Never acknowledged (there is no server); the cache has it at once.
    void batch.commit();
    return db;
  })();
  return opened;
}

/** Meal ideas for the sample household: the sample meals, checked like real ones, after a short pause. */
export async function suggestDemoMeals(ctx: MealContext): Promise<ValidatedMeals> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return validateMeals({ meals: demoMeals().map((m) => ({ ...m, ...m.levels })) }, ctx);
}

/** No one is signed in to the sample: Google services (Calendar, Google Tasks) never look. */
export const DEMO_AUTH = { currentUser: null, onAuthStateChanged: (cb: (user: null) => void) => (cb(null), () => {}) } as unknown as Auth;
