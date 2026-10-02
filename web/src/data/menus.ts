import type { ListItem, ShoppingList } from './model';

export const MENU_MODEL = 'gemini-3.8-flash';
/** Used when the main model is overloaded, which happens on the free tier at busy times. */
export const MENU_FALLBACK_MODEL = 'gemini-3.5-flash-lite';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export interface MealPart {
  /** What goes into this part, named as on the grocery list or from the basics. */
  ingredients: string[];
  /** One line on how it is made: method, fat and seasoning. No times or temperatures. */
  prep: string;
}

export interface Meal {
  type: MealType;
  name: string;
  parts: MealPart[];
}

export interface Menu {
  id: string;
  createdAt: number;
  createdBy: string;
  ingredients: string[];
  meals: Meal[];
}

export interface FavoriteMeal {
  id: string;
  meal: Meal;
  savedAt: number;
  savedBy: string;
}

/** Stable ID for a meal, so starring the same idea twice keeps one favorite. */
export function mealKey(meal: Pick<Meal, 'name'>): string {
  return meal.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'meal';
}

export interface IngredientChoice {
  name: string;
  /** Pre-ticked when it is neither already on the list nor bought recently. */
  selected: boolean;
  note: 'on list' | 'bought recently' | null;
}

/** A meal's shoppable ingredients (no kitchen basics), with what to suggest adding. */
export function ingredientChoices(meal: Meal, onList: string[], recentlyBought: string[]): IngredientChoice[] {
  const seen = new Set<string>();
  const out: IngredientChoice[] = [];
  for (const raw of meal.parts.flatMap((p) => p.ingredients)) {
    const name = raw.trim();
    const key = normalize(name);
    if (!key || seen.has(key) || isKitchenBasic(name)) continue;
    seen.add(key);
    const listed = onList.some((n) => matchesOne(name, n));
    const bought = recentlyBought.some((n) => matchesOne(name, n));
    out.push({ name: name.charAt(0).toUpperCase() + name.slice(1), selected: !listed && !bought, note: listed ? 'on list' : bought ? 'bought recently' : null });
  }
  return out;
}

function matchesOne(ingredient: string, candidate: string): boolean {
  const a = normalize(ingredient);
  const b = normalize(candidate);
  if (!a || !b) return false;
  return a === b || ` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `);
}

/**
 * Exact names only: the partial matching used elsewhere would treat "bell pepper", "garlic" and
 * "peanut butter" as basics and hide them from the shopping choices.
 */
function isKitchenBasic(ingredient: string): boolean {
  return BASIC_NAMES.has(normalize(ingredient));
}

/** Assumed to be in any kitchen, so a meal may use them without them being bought. */
export const KITCHEN_BASICS = [
  'salt',
  'pepper',
  'oil',
  'olive oil',
  'butter',
  'seasoning',
  'garlic powder',
  'onion powder',
  'paprika',
  'italian seasoning',
  'chili flakes',
  'soy sauce',
  'vinegar',
  'honey',
  'sugar',
  'flour',
  'ketchup',
  'mustard',
  'mayonnaise',
  'water',
  'coffee',
  'tea',
];

const BASIC_NAMES = new Set(
  [...KITCHEN_BASICS, 'black pepper', 'salt and pepper', 'sea salt', 'kosher salt', 'vegetable oil', 'canola oil', 'cooking oil', 'cooking spray', 'extra virgin olive oil']
    .map((b) => normalize(b)),
);

/** Lists whose checked-off items count as food now in the kitchen. */
const FOOD_LIST_ICONS = new Set(['grocery', 'pantry', 'bulk']);

/** Food checked off (bought) in the last `days`, newest first, one entry per name. */
export function kitchenInventory(items: ListItem[], lists: ShoppingList[], now: number, days = 10): string[] {
  const foodLists = new Set(lists.filter((l) => FOOD_LIST_ICONS.has(l.icon)).map((l) => l.id));
  const since = now - days * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of [...items].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))) {
    if (!item.completed || !item.completedAt || item.completedAt < since || !foodLists.has(item.listId)) continue;
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(item.name.trim());
  }
  return names;
}

/** JSON schema for Gemini's structured output (the OpenAPI subset the API accepts). */
export const MENU_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    meals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...MEAL_TYPES] },
          name: { type: 'string', description: 'Short, plain meal name, e.g. "Seared steak with rice and zucchini"' },
          parts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ingredients: { type: 'array', items: { type: 'string' } },
                prep: { type: 'string' },
              },
              required: ['ingredients', 'prep'],
            },
          },
        },
        required: ['type', 'name', 'parts'],
      },
    },
  },
  required: ['meals'],
} as const;

export const MENU_SYSTEM_INSTRUCTION = `You suggest simple, ordinary home meals built from groceries a household just bought.

Ingredients
- Use only ingredients from the AVAILABLE list, plus these kitchen basics: ${KITCHEN_BASICS.join(', ')}.
- Write each ingredient exactly as it appears in AVAILABLE (or as the basic's name).
- Each meal uses 2 to 5 AVAILABLE ingredients; basics do not count toward that.
- A meal's name mentions only foods that appear in its parts (no "toast" unless bread is an ingredient).

Meal types: keep them conventional for a US household
- breakfast: eggs, breakfast fruit, yogurt, toast or bread, oats or cereal, cheese, juice. Include coffee as the drink in at least one breakfast. Never fish, steak or other dinner proteins.
- lunch: lighter plates, sandwiches, bowls, salads or leftovers-style plates; a protein is optional.
- dinner: a main protein with a starch and/or a vegetable.
- snack: 1 or 2 ready-to-eat items, no cooking.

Each meal is made of parts (for example the steak, the rice, the zucchini, the drink). For each part give a one-line prep that says the method and the fat and seasoning, like "Sliced and pan-fried in oil with salt, pepper and garlic powder" or "Cooked in a pot or rice cooker". No cooking times, temperatures or step-by-step instructions.

Vary the meals: do not use the same main protein in more than two meals. Prefer combinations people commonly eat together; avoid novelty pairings.`;

export function menuPrompt(available: string[], perType = 3): string {
  return `AVAILABLE: ${available.join(', ')}

Suggest ${perType} breakfasts, ${perType} lunches, ${perType} dinners and 2 snacks.`;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith('es') && /(ch|sh|x|ss|o)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}

/**
 * True when `ingredient` names something bought (allowing plurals and partial names, "chicken" for
 * "chicken tenderloins") or is a kitchen basic by its exact name. Basics never match partially, so
 * "bell pepper", "peanut butter" and "garlic" are not let through by "pepper", "butter" and "garlic powder".
 */
export function ingredientAvailable(ingredient: string, available: string[]): boolean {
  const n = normalize(ingredient);
  if (!n) return true;
  if (isKitchenBasic(ingredient)) return true;
  return available.map(normalize).some((a) => a === n || ` ${a} `.includes(` ${n} `) || ` ${n} `.includes(` ${a} `));
}

/**
 * Keeps only well-formed meals whose every ingredient was bought or is a basic. This is the guard
 * against the model inventing ingredients; it is code, so it cannot be talked out of it.
 */
export function validateMeals(raw: unknown, available: string[]): Meal[] {
  const meals = (raw as { meals?: unknown })?.meals;
  if (!Array.isArray(meals)) return [];
  const out: Meal[] = [];
  for (const m of meals) {
    if (!m || typeof m !== 'object') continue;
    const { type, name, parts } = m as Partial<Meal>;
    if (!MEAL_TYPES.includes(type as MealType) || typeof name !== 'string' || !name.trim() || !Array.isArray(parts) || parts.length === 0) continue;
    const cleanParts = parts.filter(
      (p): p is MealPart => !!p && Array.isArray(p.ingredients) && p.ingredients.every((i) => typeof i === 'string') && typeof p.prep === 'string',
    );
    if (cleanParts.length !== parts.length) continue;
    const ingredients = cleanParts.flatMap((p) => p.ingredients);
    if (ingredients.length === 0 || !ingredients.every((i) => ingredientAvailable(i, available))) continue;
    out.push({ type: type as MealType, name: name.trim(), parts: cleanParts.map((p) => ({ ingredients: p.ingredients.map((i) => i.trim()), prep: p.prep.trim() })) });
  }
  return out;
}

export function groupMeals(meals: Meal[]): [MealType, Meal[]][] {
  return MEAL_TYPES.map((t) => [t, meals.filter((m) => m.type === t)] as [MealType, Meal[]]).filter(([, ms]) => ms.length > 0);
}
