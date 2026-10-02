import { DEFAULT_PANTRY, DIET_GUIDANCE, DIET_LABELS, householdDietRules, pantryText, type FoodPreferences } from '@huishouden/pwa-kit/food';
import { GENTLE_DIETS, avoidCaffeine, dietProblems, isStrict, levelScore, mealLevels, type MealLevels } from './diet';
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
  /** Up to MAX_EXTRAS ingredients neither bought nor on a list, worth getting for this meal. */
  extras?: string[];
  /** How hot, acidic, rich and sweet it is (0–3 each), for gentle diets such as GERD. */
  levels?: MealLevels;
}

/** At most this many ingredients a meal may add beyond what is bought or listed. */
export const MAX_EXTRAS = 3;

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

/** What the model may use and what the household may eat. */
export interface MealContext {
  /** Bought recently (checked off on a food list in the last 10 days). */
  have: string[];
  /** Still on a food list, not bought yet: lets a week be planned before shopping. */
  onList: string[];
  /** Kitchen basics a recipe may assume (the household's food settings). */
  pantry: readonly string[];
  /** The household's people and diets; diets are rules, not hints. */
  food: Pick<FoodPreferences, 'people'>;
}

export type IngredientSource = 'basic' | 'have' | 'list' | 'extra';

/** Dried spices and seasonings any kitchen has when the pantry includes "common dried herbs and spices". */
const DRIED_SPICES = [
  'oregano', 'thyme', 'cumin', 'paprika', 'smoked paprika', 'cinnamon', 'nutmeg', 'turmeric', 'bay leaf', 'garlic powder', 'onion powder',
  'italian seasoning', 'ground ginger', 'ground coriander', 'coriander', 'allspice', 'cloves', 'chili powder', 'curry powder', 'herbes de provence',
  'dried basil', 'dried parsley', 'dried dill', 'dried rosemary', 'dried oregano', 'dried thyme', 'seasoning', 'seasoning salt', 'lemon pepper',
];

/** Always assumed, whatever the settings say. */
const ALWAYS = ['water', 'ice'];

/** Spellings of the pantry's words the model tends to use. */
const PANTRY_ALIASES: Record<string, string[]> = {
  salt: ['salt', 'sea salt', 'kosher salt', 'table salt'],
  'black pepper': ['pepper', 'black pepper', 'ground pepper', 'salt and pepper', 'ground black pepper'],
  'cooking oil': ['oil', 'cooking oil', 'vegetable oil', 'canola oil', 'olive oil', 'extra virgin olive oil', 'avocado oil'],
  'cooking spray': ['cooking spray', 'nonstick spray', 'oil spray'],
};

function basicsFor(pantry: readonly string[]): Set<string> {
  const names = new Set<string>(ALWAYS.map(normalize));
  for (const item of pantry) {
    names.add(normalize(item));
    for (const alias of PANTRY_ALIASES[item.toLowerCase()] ?? []) names.add(normalize(alias));
    if (/spice|herb|seasoning/i.test(item)) for (const sp of DRIED_SPICES) names.add(normalize(sp));
  }
  return names;
}

/**
 * Exact names only: partial matching would treat "bell pepper", "garlic" and "peanut butter" as
 * basics. Specialty seasonings (gochujang, za'atar, saffron) are not basics, so they count.
 */
export function isPantryBasic(ingredient: string, pantry: readonly string[]): boolean {
  return basicsFor(pantry).has(normalize(ingredient));
}

function matchesOne(ingredient: string, candidate: string): boolean {
  const a = normalize(ingredient);
  const b = normalize(candidate);
  if (!a || !b) return false;
  return a === b || ` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `);
}

function matchesAny(ingredient: string, names: string[]): boolean {
  return names.some((n) => matchesOne(ingredient, n));
}

/** Where an ingredient comes from, or null when it is neither bought, listed, basic nor a declared extra. */
export function ingredientSource(ingredient: string, ctx: Pick<MealContext, 'have' | 'onList' | 'pantry'>, extras: string[] = []): IngredientSource | null {
  if (!normalize(ingredient)) return 'basic';
  if (isPantryBasic(ingredient, ctx.pantry)) return 'basic';
  if (matchesAny(ingredient, ctx.have)) return 'have';
  if (matchesAny(ingredient, ctx.onList)) return 'list';
  if (extras.some((e) => normalize(e) === normalize(ingredient))) return 'extra';
  return null;
}

/** A meal's ingredients by where they come from, each once, basics left out. */
export function mealIngredients(meal: Meal, ctx: Pick<MealContext, 'have' | 'onList' | 'pantry'>): Record<'have' | 'list' | 'extra', string[]> {
  const out = { have: [] as string[], list: [] as string[], extra: [] as string[] };
  const seen = new Set<string>();
  for (const raw of [...meal.parts.flatMap((p) => p.ingredients), ...(meal.extras ?? [])]) {
    const name = raw.trim();
    const key = normalize(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const source = ingredientSource(name, ctx, meal.extras);
    // Saved before extras existed: anything unmatched now is simply something to get.
    const bucket = source === 'basic' ? null : (source ?? 'extra');
    if (bucket) out[bucket].push(name.charAt(0).toUpperCase() + name.slice(1));
  }
  return out;
}

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

/** Food still to buy: unchecked items on food lists, one entry per name. */
export function plannedGroceries(items: ListItem[], lists: ShoppingList[]): string[] {
  const foodLists = new Set(lists.filter((l) => FOOD_LIST_ICONS.has(l.icon)).map((l) => l.id));
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of items) {
    if (item.completed || !foodLists.has(item.listId)) continue;
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
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
          name: { type: 'string', description: 'Short, plain meal name, e.g. "Baked salmon with rice and zucchini"' },
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
          heat: { type: 'integer', minimum: 0, maximum: 3, description: '0 not spicy, 1 a little, 2 spicy, 3 very spicy' },
          acidity: { type: 'integer', minimum: 0, maximum: 3, description: 'tomato, citrus and vinegar: 0 none, 1 a little, 2 noticeable, 3 very acidic' },
          richness: { type: 'integer', minimum: 0, maximum: 3, description: 'fat and frying: 0 light, 1 some butter or cheese, 2 rich or pan-fried, 3 deep-fried or greasy' },
          sweetness: { type: 'integer', minimum: 0, maximum: 3, description: 'added sugar: 0 none, 1 a little, 2 sweet, 3 a dessert' },
          extras: {
            type: 'array',
            items: { type: 'string' },
            description: `Ingredients this meal adds that are in neither HAVE nor ON THE LIST, at most ${MAX_EXTRAS}; also list them in the parts. Empty when none`,
          },
        },
        required: ['type', 'name', 'parts', 'extras', 'heat', 'acidity', 'richness', 'sweetness'],
      },
    },
  },
  required: ['meals'],
} as const;

/** The standing instructions; `food` decides the drink advice and is repeated as rules in the prompt. */
export function menuSystemInstruction(food: Pick<FoodPreferences, 'people'>): string {
  const drink = avoidCaffeine(food)
    ? 'Do not suggest coffee, black tea or other caffeinated drinks; water, milk or a mild herbal tea are fine.'
    : 'Include coffee as the drink in at least one breakfast.';
  return `You suggest simple, ordinary home meals for one household, from groceries it has and groceries it plans to buy.

Household rules and preferences
- The HOUSEHOLD RULES in the request are requirements. Never suggest a meal that breaks any of them, even partly (an ingredient, a sauce, a garnish, a drink or the cooking method). If unsure, leave the meal out.
- HOUSEHOLD PREFERENCES are not rules: lean most meals that way, but a varied, tasty week matters too, so a few meals may be bolder. Rate every meal honestly for heat, acidity, richness and sweetness so the household can choose.

Ingredients
- Build meals from HAVE (bought recently) and ON THE LIST (to be bought), plus the PANTRY basics, which are never listed as ingredients to get.
- Write each ingredient exactly as it appears in HAVE or ON THE LIST.
- To keep meals interesting, about one meal in three should add 1 or 2 ingredients that are in neither list (a fresh herb, a cheese, a vegetable, a sauce), and no meal more than ${MAX_EXTRAS}. Pick ones that clearly lift the meal and are easy to find in an ordinary supermarket. List each of them in the meal's extras as well as in its parts. Specialty seasonings (for example gochujang, za'atar, saffron, fresh herbs) count as extras; salt, pepper, common dried spices, cooking oil and cooking spray never do.
- Each meal uses 2 to 5 ingredients from HAVE or ON THE LIST; basics do not count toward that.
- A meal's name mentions only foods that appear in its parts (no "toast" unless bread is an ingredient).

Meal types: keep them conventional for a US household
- breakfast: eggs, breakfast fruit, yogurt, toast or bread, oats or cereal, cheese, juice. ${drink} Never fish, steak or other dinner proteins.
- lunch: lighter plates, sandwiches, bowls, salads or leftovers-style plates; a protein is optional.
- dinner: a main protein with a starch and/or a vegetable.
- snack: 1 or 2 ready-to-eat items, no cooking.

Each meal is made of parts (for example the salmon, the rice, the zucchini, the drink). For each part give a one-line prep that says the method and the fat and seasoning, like "Baked with a little oil, salt and garlic powder" or "Cooked in a pot or rice cooker". Prefer baking, roasting, steaming and sautéing with a little oil to frying. No cooking times, temperatures or step-by-step instructions.

Vary the meals: do not use the same main protein in more than two meals. Prefer combinations people commonly eat together; avoid novelty pairings.`;
}

export function menuPrompt(ctx: MealContext, perType = 3): string {
  // Strict diets are rules; gentle ones (GERD, low-sodium) are preferences.
  const strict = { people: ctx.food.people.map((p) => ({ ...p, diets: p.diets.filter(isStrict) })) };
  const rules = householdDietRules(strict);
  const prefs = ctx.food.people.flatMap((p) =>
    p.diets.filter((d) => GENTLE_DIETS.includes(d)).map((d) => `${p.name}: ${DIET_LABELS[d]}. Lean towards meals that ${DIET_GUIDANCE[d].replace(/^avoid /, 'go easy on ')}.`),
  );
  return [
    `HAVE: ${ctx.have.join(', ') || '(nothing yet)'}`,
    `ON THE LIST: ${ctx.onList.join(', ') || '(nothing)'}`,
    `PANTRY: ${pantryText({ pantryAssumed: [...ctx.pantry] }) || 'Assume salt, pepper and cooking oil.'}`,
    rules.length ? `HOUSEHOLD RULES (must all hold for every meal):\n${rules.map((r) => `- ${r}`).join('\n')}` : '',
    prefs.length ? `HOUSEHOLD PREFERENCES (most meals, not all):\n${prefs.map((r) => `- ${r}`).join('\n')}` : '',
    `Suggest ${perType} breakfasts, ${perType} lunches, ${perType} dinners and 2 snacks. At least ${perType} of the meals should each add 1 or 2 extras.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** What a meal-ideas run kept and why it dropped the rest. */
export interface ValidatedMeals {
  meals: Meal[];
  /** Used something neither bought, listed, basic nor a declared extra (or too many extras). */
  droppedUnlisted: number;
  /** Broke a household diet; the first reason each, for the screen. */
  droppedDiet: { name: string; reason: string }[];
}

/**
 * Keeps only well-formed meals that use what the household has or plans to buy (plus up to
 * MAX_EXTRAS declared extras) and fit every diet. This is the guard against the model inventing
 * ingredients or ignoring a diet; it is code, so it cannot be talked out of it.
 */
export function validateMeals(raw: unknown, ctx: MealContext): ValidatedMeals {
  const result: ValidatedMeals = { meals: [], droppedUnlisted: 0, droppedDiet: [] };
  const meals = (raw as { meals?: unknown })?.meals;
  if (!Array.isArray(meals)) return result;
  for (const m of meals) {
    if (!m || typeof m !== 'object') continue;
    const { type, name, parts, extras } = m as Partial<Meal>;
    const rated = m as Partial<MealLevels>;
    if (!MEAL_TYPES.includes(type as MealType) || typeof name !== 'string' || !name.trim() || !Array.isArray(parts) || parts.length === 0) continue;
    const cleanParts = parts.filter(
      (p): p is MealPart => !!p && Array.isArray(p.ingredients) && p.ingredients.every((i) => typeof i === 'string') && typeof p.prep === 'string',
    );
    if (cleanParts.length !== parts.length) continue;
    const ingredients = cleanParts.flatMap((p) => p.ingredients.map((i) => i.trim())).filter(Boolean);
    if (ingredients.length === 0) continue;
    // Declared extras that really are extras (not basics, not bought or listed). Models often name
    // them only here, not in the parts, so a declared extra counts wherever it appears.
    const declared = (Array.isArray(extras) ? extras : []).filter((e): e is string => typeof e === 'string').map((e) => e.trim()).filter(Boolean);
    const realExtras = [...new Map(declared.filter((e) => ingredientSource(e, ctx) === null).map((e) => [normalize(e), e])).values()];
    if (realExtras.length > MAX_EXTRAS || !ingredients.every((i) => ingredientSource(i, ctx, realExtras) !== null)) {
      result.droppedUnlisted++;
      continue;
    }
    const meal: Meal = {
      type: type as MealType,
      name: name.trim(),
      parts: cleanParts.map((p) => ({ ingredients: p.ingredients.map((i) => i.trim()).filter(Boolean), prep: p.prep.trim() })),
      ...(realExtras.length ? { extras: realExtras } : {}),
    };
    meal.levels = mealLevels(meal, rated);
    const problems = dietProblems(meal, ctx.food);
    if (problems.length) {
      result.droppedDiet.push({ name: meal.name, reason: `${problems[0].term} (${problems[0].who})` });
      continue;
    }
    result.meals.push(meal);
  }
  return result;
}

/** The household's pantry, or the kit's default before any settings are saved. */
export function pantryOf(food: Pick<FoodPreferences, 'pantryAssumed'> | null): readonly string[] {
  return food?.pantryAssumed.length ? food.pantryAssumed : DEFAULT_PANTRY;
}

/** Meals by type; with `gentleFirst` (someone has GERD), the gentlest of each type comes first. */
export function groupMeals(meals: Meal[], gentleFirst = false): [MealType, Meal[]][] {
  const order = (ms: Meal[]) => (gentleFirst ? [...ms].sort((a, b) => levelScore(a.levels ?? mealLevels(a)) - levelScore(b.levels ?? mealLevels(b))) : ms);
  return MEAL_TYPES.map((t) => [t, order(meals.filter((m) => m.type === t))] as [MealType, Meal[]]).filter(([, ms]) => ms.length > 0);
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
