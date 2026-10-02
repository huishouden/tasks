import type { Diet, FoodPreferences } from '@huishouden/pwa-kit/food';
import type { Meal } from './menus';

/**
 * Checks a suggested meal against the household's diets in code, so a vegetarian household never
 * sees meat even if the model ignores the prompt. Word lists cover what ordinary home meals use;
 * they catch the plain cases, and the prompt (householdDietRules) carries the rest.
 *
 * Two kinds of diet:
 * - strict: beliefs, allergies and pregnancy safety. A meal that breaks one is dropped.
 * - gentle: GERD and low-sodium. Being strict there leaves only bland food (and many people manage
 *   reflux with medication), so meals stay and show how hot, acidic, rich and sweet they are.
 */

/** Diets that are preferences: meals are rated and ordered for them, not dropped. */
export const GENTLE_DIETS: readonly Diet[] = ['gerd', 'low-sodium'];
export const isStrict = (diet: Diet) => !GENTLE_DIETS.includes(diet);

type Rule = {
  /** Words or phrases that break the diet, matched as whole words (plurals too). */
  terms: string[];
  /** Phrases that contain a term but are fine ("peanut butter" is not dairy). */
  except?: string[];
};

const MEAT = ['beef', 'steak', 'pork', 'bacon', 'ham', 'sausage', 'chicken', 'turkey', 'lamb', 'veal', 'duck', 'prosciutto', 'pepperoni', 'salami', 'chorizo', 'hot dog', 'meatball', 'burger', 'jerky', 'gelatin', 'lard', 'bologna', 'pancetta', 'brisket', 'rib', 'venison'];
const FISH = ['fish', 'salmon', 'tuna', 'tilapia', 'cod', 'halibut', 'trout', 'sardine', 'anchovy', 'anchovies', 'mackerel', 'swordfish', 'mahi', 'catfish', 'snapper', 'bass', 'lox'];
const SHELLFISH = ['shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari'];
const DAIRY = ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'ghee', 'feta', 'parmesan', 'mozzarella', 'cheddar', 'ricotta', 'brie', 'kefir', 'custard'];
const PLANT_MILKS = ['coconut milk', 'almond milk', 'oat milk', 'soy milk', 'rice milk', 'peanut butter', 'almond butter', 'cashew butter', 'sunflower butter', 'cocoa butter', 'vegan cheese', 'cream of tartar', 'coconut cream'];
const ALCOHOL = ['wine', 'beer', 'rum', 'vodka', 'bourbon', 'whiskey', 'whisky', 'sake', 'mirin', 'liqueur', 'brandy', 'cocktail', 'mimosa', 'sangria', 'margarita', 'sherry', 'champagne', 'prosecco'];
const PORK = ['pork', 'bacon', 'ham', 'prosciutto', 'pepperoni', 'chorizo', 'lard', 'pancetta', 'salami'];

const RULES: Partial<Record<Diet, Rule>> = {
  vegan: { terms: [...MEAT, ...FISH, ...SHELLFISH, ...DAIRY, 'egg', 'honey', 'mayonnaise', 'fish sauce'], except: [...PLANT_MILKS, 'veggie burger', 'vegan', 'eggplant'] },
  vegetarian: { terms: [...MEAT, ...FISH, ...SHELLFISH, 'fish sauce'], except: ['veggie burger', 'vegetarian'] },
  pescatarian: { terms: MEAT, except: ['veggie burger', 'fish sauce'] },
  'gluten-free': {
    terms: ['bread', 'pasta', 'spaghetti', 'penne', 'macaroni', 'noodle', 'wheat', 'barley', 'rye', 'couscous', 'bagel', 'pita', 'croissant', 'breadcrumb', 'flour tortilla', 'soy sauce', 'toast', 'cracker', 'muffin', 'pancake', 'waffle', 'bun', 'pizza'],
    except: ['gluten-free', 'gluten free', 'rice noodle', 'corn tortilla'],
  },
  'dairy-free': { terms: DAIRY, except: [...PLANT_MILKS, 'dairy-free', 'dairy free'] },
  'nut allergy': { terms: ['peanut', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'pine nut', 'pesto', 'satay', 'nut butter', 'praline', 'marzipan', 'nutella'] },
  'shellfish allergy': { terms: SHELLFISH },
  pregnant: {
    terms: [
      'sushi', 'sashimi', 'ceviche', 'poke', 'tartare', 'carpaccio', 'raw', 'rare', 'runny', 'soft-boiled', 'over easy', 'sunny side up', 'oyster',
      'swordfish', 'shark', 'king mackerel', 'tilefish', 'bigeye tuna', 'marlin', 'orange roughy',
      'unpasteurized', 'unpasteurised', 'raw milk', 'smoked salmon', 'lox',
      ...ALCOHOL,
    ],
    except: ['raw vegetables', 'raw veggies', 'well-done', 'fully cooked', 'cooked through'],
  },
  halal: { terms: [...PORK, 'gelatin', ...ALCOHOL] },
  kosher: { terms: [...PORK, ...SHELLFISH] },
};

/** Cold deli meat is fine in pregnancy only when heated until steaming. */
const DELI = ['deli', 'cold cut', 'hot dog', 'bologna', 'salami', 'pepperoni', 'prosciutto', 'turkey slices', 'sliced turkey', 'sliced ham', 'lunch meat'];
const HEATED = /\b(heat|heated|until steaming|steaming|warmed|toasted|grilled|baked|pan[- ]fried|seared|cooked|melted|hot)\b/;

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9ñé\s-]/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Removes allowed phrases (whole words, every occurrence, even back to back). */
function strip(text: string, phrases: string[] | undefined): string {
  let out = text;
  for (const p of phrases ?? []) out = out.replace(new RegExp(`(?<= )${escape(normalize(p).trim())}(?= )`, 'g'), ' ');
  return out;
}

/** The first term found, as a whole word, allowing a plural ("eggs", "anchovies"). */
function find(text: string, terms: string[]): string | null {
  for (const t of terms) {
    if (new RegExp(` ${escape(t.toLowerCase())}(s|es)? `).test(text)) return t;
  }
  return null;
}

export interface DietProblem {
  /** "Sam (vegetarian)" or "Sam avoids olives". */
  who: string;
  /** The word that broke it: "steak". */
  term: string;
}

/**
 * Why a meal does not fit the household, or [] when it fits. Checks the name, ingredients and prep
 * of every part against each person's diets and avoid list.
 */
export function dietProblems(meal: Meal, food: Pick<FoodPreferences, 'people'>): DietProblem[] {
  const whole = normalize([meal.name, ...meal.parts.flatMap((p) => [...p.ingredients, p.prep]), ...(meal.extras ?? [])].join(' . '));
  const problems: DietProblem[] = [];
  for (const person of food.people) {
    for (const diet of person.diets.filter(isStrict)) {
      const rule = RULES[diet];
      if (rule) {
        const term = find(strip(whole, rule.except), rule.terms);
        if (term) problems.push({ who: `${person.name} (${diet})`, term });
      }
      if (diet === 'kosher') {
        const text = strip(whole, PLANT_MILKS);
        const meat = find(text, MEAT);
        const dairy = find(text, DAIRY);
        if (meat && dairy) problems.push({ who: `${person.name} (kosher)`, term: `${meat} with ${dairy}` });
      }
      if (diet === 'pregnant') {
        for (const part of meal.parts) {
          const text = normalize([...part.ingredients, part.prep].join(' . '));
          const deli = find(text, DELI);
          if (deli && !HEATED.test(part.prep.toLowerCase())) problems.push({ who: `${person.name} (pregnant)`, term: `${deli}, not heated` });
        }
      }
    }
    const avoided = find(whole, person.avoid);
    if (avoided) problems.push({ who: `${person.name} avoids ${avoided}`, term: avoided });
  }
  return problems;
}

/** Whether anyone in the household limits caffeine or avoids coffee, so breakfasts should not push it. */
export function avoidCaffeine(food: Pick<FoodPreferences, 'people'>): boolean {
  return food.people.some((p) => p.diets.includes('gerd') || p.diets.includes('pregnant'));
}

/** How hot, acidic, rich (fatty or fried) and sweet a meal is, each 0 (none) to 3 (very). */
export interface MealLevels {
  heat: number;
  acidity: number;
  richness: number;
  sweetness: number;
}

export const LEVEL_KEYS = ['heat', 'acidity', 'richness', 'sweetness'] as const;

/** Words that set a lowest level, whatever the model says: a meal with jalapeño is at least 2 hot. */
const FLOORS: Record<keyof MealLevels, [number, string[]][]> = {
  heat: [
    [3, ['habanero', 'ghost pepper', 'scotch bonnet', 'extra spicy', 'very spicy', 'vindaloo']],
    [2, ['spicy', 'jalapeno', 'jalapeño', 'chipotle', 'sriracha', 'hot sauce', 'cayenne', 'red pepper flakes', 'buffalo', 'gochujang', 'chili crisp', 'serrano']],
    [1, ['chili', 'chilli', 'chili powder', 'curry', 'harissa', 'black pepper crusted']],
  ],
  acidity: [
    [2, ['tomato sauce', 'marinara', 'salsa', 'pizza sauce', 'tomato soup', 'bolognese', 'shakshuka', 'arrabbiata', 'grapefruit', 'orange juice', 'lemonade']],
    [1, ['tomato', 'lemon', 'lime', 'orange', 'vinegar', 'citrus', 'pickled', 'pineapple']],
  ],
  richness: [
    [3, ['deep-fried', 'deep fried', 'fried chicken', 'fries', 'battered', 'onion rings']],
    [2, ['fried', 'bacon', 'sausage', 'alfredo', 'cream sauce', 'cheese sauce', 'carbonara', 'pepperoni', 'ribeye', 'pork belly']],
  ],
  sweetness: [
    [2, ['chocolate', 'syrup', 'cake', 'cookie', 'brownie', 'candy', 'dessert', 'ice cream', 'pastry', 'donut']],
    [1, ['honey', 'jam', 'sugar', 'sweetened', 'maple']],
  ],
};

const clampLevel = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0);

/** The model's levels, raised to what the meal's words show. */
export function mealLevels(meal: Meal, fromModel?: Partial<MealLevels>): MealLevels {
  const text = strip(normalize([meal.name, ...meal.parts.flatMap((p) => [...p.ingredients, p.prep]), ...(meal.extras ?? [])].join(' . ')), [
    'sweet orange pepper', 'orange bell pepper', 'orange pepper', 'stir-fried', 'stir fried', 'pan-fried', 'pan fried', 'sweet potato',
  ]);
  const out = {} as MealLevels;
  for (const key of LEVEL_KEYS) {
    const floor = FLOORS[key].find(([, terms]) => find(text, terms))?.[0] ?? 0;
    out[key] = Math.max(clampLevel(fromModel?.[key]), floor);
  }
  return out;
}

/** Easy on reflux: not hot, at most a little acidic, rich or sweet. */
export function gentleOnReflux(l: MealLevels): boolean {
  return l.heat === 0 && l.acidity <= 1 && l.richness <= 1 && l.sweetness <= 1;
}

/** For ordering: lower is gentler. */
export const levelScore = (l: MealLevels) => l.heat * 2 + l.acidity + l.richness + l.sweetness;

/** Labels a menu would print: "Vegan" or "Vegetarian", when the meal qualifies. */
export function dietTags(meal: Meal): string[] {
  const as = (diet: Diet) => dietProblems(meal, { people: [{ id: 't', name: 't', diets: [diet], avoid: [] }] }).length === 0;
  if (as('vegan')) return ['Vegan'];
  if (as('vegetarian')) return ['Vegetarian'];
  return [];
}
