import { CATEGORIES, type Category, type ListIcon } from './model';

const C = CATEGORIES;

/**
 * Words and phrases per aisle. Single words are matched whole (after singularising), so "water"
 * no longer catches "watermelon" and "pay" no longer catches "papaya". Phrases win over words.
 */
const VOCABULARY: [Category, string[]][] = [
  [
    C.PRODUCE,
    [
      'apple', 'apricot', 'artichoke', 'arugula', 'asparagus', 'avocado', 'banana', 'basil', 'bean sprout', 'beet', 'bell pepper',
      'berry', 'blackberry', 'blueberry', 'bok choy', 'broccoli', 'broccolini', 'brussels sprout', 'cabbage', 'cantaloupe',
      'carrot', 'cauliflower', 'celery', 'chard', 'cherry', 'chive', 'cilantro', 'clementine', 'collard', 'corn', 'cranberry',
      'cucumber', 'date', 'dill', 'eggplant', 'endive', 'fennel', 'fig', 'fruit', 'garlic', 'ginger', 'grape', 'grapefruit',
      'green bean', 'green onion', 'greens', 'guava', 'herb', 'honeydew', 'jalapeno', 'kale', 'kiwi', 'leek', 'lemon',
      'lettuce', 'lime', 'mandarin', 'mango', 'melon', 'mint', 'mushroom', 'nectarine', 'okra', 'onion', 'orange', 'papaya',
      'parsley', 'parsnip', 'passion fruit', 'pea', 'peach', 'pear', 'pepper', 'persimmon', 'pineapple', 'plantain', 'plum',
      'pomegranate', 'potato', 'pumpkin', 'radish', 'raspberry', 'rhubarb', 'romaine', 'rosemary', 'salad', 'scallion',
      'shallot', 'snap pea', 'spinach', 'sprout', 'squash', 'strawberry', 'sweet potato', 'tangerine', 'thyme', 'tomatillo',
      'tomato', 'turnip', 'vegetable', 'veggie', 'watermelon', 'yam', 'zucchini',
    ],
  ],
  [
    C.MEAT_SEAFOOD,
    [
      'anchovy', 'bacon', 'beef', 'bratwurst', 'brisket', 'burger', 'catfish', 'chicken', 'chop', 'clam', 'cod', 'crab',
      'drumstick', 'duck', 'fillet', 'fish', 'flounder', 'ground beef', 'ground turkey', 'haddock', 'halibut', 'ham', 'hot dog',
      'kielbasa', 'lamb', 'lobster', 'mahi', 'meat', 'meatball', 'mussel', 'oyster', 'pork', 'prosciutto', 'rib', 'ribeye',
      'roast', 'salami', 'salmon', 'sausage', 'scallop', 'shrimp', 'sirloin', 'snapper', 'steak', 'swordfish', 'tenderloin',
      'thigh', 'tilapia', 'trout', 'tuna steak', 'turkey', 'veal', 'wing',
    ],
  ],
  [
    C.DAIRY_EGGS,
    [
      'almond milk', 'brie', 'butter', 'buttermilk', 'cheddar', 'cheese', 'cottage cheese', 'cream', 'cream cheese',
      'creamer', 'egg', 'feta', 'goat cheese', 'gouda', 'greek yogurt', 'half and half', 'heavy cream', 'kefir', 'margarine',
      'milk', 'mozzarella', 'oat milk', 'parmesan', 'provolone', 'ricotta', 'sour cream', 'string cheese', 'swiss',
      'whipped cream', 'yogurt',
    ],
  ],
  [
    C.BAKERY,
    [
      'bagel', 'baguette', 'bread', 'brioche', 'bun', 'cake', 'ciabatta', 'crepe', 'croissant', 'cupcake', 'danish',
      'donut', 'doughnut', 'english muffin', 'flatbread', 'muffin', 'naan', 'pastry', 'pie', 'pita', 'roll', 'rye',
      'sourdough', 'tortilla', 'wrap',
    ],
  ],
  [
    C.FROZEN,
    ['frozen', 'ice', 'ice cream', 'popsicle', 'gelato', 'sorbet', 'frozen pizza', 'pizza', 'tater tot', 'waffle', 'frozen yogurt'],
  ],
  [
    C.PANTRY,
    [
      'baking powder', 'baking soda', 'barbecue sauce', 'bean', 'black bean', 'black pepper', 'bouillon', 'broth', 'brown sugar', 'canned',
      'cereal', 'chickpea', 'cinnamon', 'cocoa', 'condensed milk', 'couscous', 'cumin', 'evaporated milk', 'flour', 'granola',
      'honey', 'hot sauce', 'jam', 'jelly', 'ketchup', 'lentil', 'maple syrup', 'marinara', 'mayo', 'mayonnaise', 'mustard',
      'noodle', 'nutmeg', 'oat', 'oatmeal', 'oil', 'olive oil', 'oregano', 'paprika', 'pasta', 'pasta sauce', 'peanut butter',
      'pepper flake', 'pickle', 'quinoa', 'ramen', 'rice', 'salsa', 'salt', 'sauce', 'seasoning', 'soup', 'soy sauce',
      'spaghetti', 'spice', 'stock', 'sugar', 'syrup', 'taco shell', 'tomato paste', 'tomato sauce', 'tuna', 'vanilla',
      'vinegar', 'yeast',
    ],
  ],
  [
    C.SNACKS,
    [
      'almond', 'bar', 'candy', 'cashew', 'chip', 'chocolate', 'cookie', 'cracker', 'dried fruit', 'fruit snack', 'goldfish',
      'granola bar', 'gum', 'jerky', 'nut', 'peanut', 'pistachio', 'popcorn', 'pretzel', 'raisin', 'snack', 'trail mix', 'walnut',
    ],
  ],
  [
    C.BEVERAGES,
    [
      'beer', 'coconut water', 'coffee', 'coffee bean', 'coffee pod', 'cold brew', 'drink', 'energy drink', 'espresso', 'gatorade', 'juice', 'kombucha',
      'lemonade', 'orange juice', 'seltzer', 'soda', 'sparkling water', 'tea', 'water', 'wine',
    ],
  ],
  [
    C.HOUSEHOLD,
    [
      'aluminum foil', 'bleach', 'cleaner', 'detergent', 'dish soap', 'dishwasher pod', 'dryer sheet', 'foil', 'garbage bag',
      'laundry', 'lysol', 'napkin', 'paper plate', 'paper towel', 'plastic wrap', 'sponge', 'swiffer', 'tissue',
      'toilet paper', 'trash bag', 'wipe', 'ziploc',
    ],
  ],
  [
    C.PERSONAL_CARE,
    [
      'baby wash', 'bandaid', 'body wash', 'conditioner', 'contact solution', 'cotton swab', 'deodorant', 'diaper', 'floss',
      'formula', 'lotion', 'medicine', 'mouthwash', 'pacifier', 'razor', 'shampoo', 'soap', 'sunscreen', 'tampon',
      'toothbrush', 'toothpaste', 'vitamin', 'baby wipe',
    ],
  ],
  [
    C.HARDWARE_HOME,
    [
      'air filter', 'battery', 'bulb', 'caulk', 'drill', 'extension cord', 'filter', 'glue', 'hook', 'light bulb', 'mulch',
      'nail', 'paint', 'screw', 'smoke detector', 'tape', 'tool',
    ],
  ],
];

/** Task-like openings that mark a to-do rather than something to buy. */
const TASK_VERBS = [
  'book', 'call', 'cancel', 'check', 'clean', 'confirm', 'create', 'email', 'fix', 'install', 'leave', 'mow', 'organize',
  'pack', 'pay', 'prep', 'renew', 'return', 'schedule', 'sterilize', 'text', 'wash',
];

/** Lists whose items are to-dos, not shopping, so a guess there should not be a store aisle. */
const TASK_LIST_ICONS: ListIcon[] = ['chores', 'notes'];

function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(ch|sh|x|ss|o)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1);
  return word;
}

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singular);
}

const PHRASES: [string, Category][] = [];
const WORDS = new Map<string, Category>();
for (const [category, entries] of VOCABULARY) {
  for (const entry of entries) {
    // Registered as written and as its plural would singularise ("cookie", "cookies" → "cooky").
    for (const w of [words(entry), words(`${entry}s`)]) {
      if (w.length > 1) {
        if (!PHRASES.some(([p]) => p === w.join(' '))) PHRASES.push([w.join(' '), category]);
      } else if (!WORDS.has(w[0])) {
        WORDS.set(w[0], category);
      }
    }
  }
}
// Longer phrases first, so "sweet potato" wins over "potato" and "peanut butter" over "butter".
PHRASES.sort((a, b) => b[0].split(' ').length - a[0].split(' ').length || b[0].length - a[0].length);

/** Edit distance allowing one swap of neighbouring letters ("tilapai" → "tilapia" is 1). */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Typos allowed for a word of this length: none for short words, where a slip lands on another word. */
function allowedTypos(word: string): number {
  return word.length >= 8 ? 2 : word.length >= 5 ? 1 : 0;
}

/** The vocabulary word a misspelling most likely meant, if exactly one is close enough. */
function fuzzyWord(word: string): Category | null {
  const max = allowedTypos(word);
  if (max === 0) return null;
  let best: { category: Category; distance: number } | null = null;
  let tie = false;
  for (const [known, category] of WORDS) {
    const distance = editDistance(word, known, max);
    if (distance > max) continue;
    if (!best || distance < best.distance) {
      best = { category, distance };
      tie = false;
    } else if (distance === best.distance && category !== best.category) {
      tie = true;
    }
  }
  return best && !tie ? best.category : null;
}

/**
 * Best-effort aisle from the item's name, tolerant of plurals and typos. Returns OTHER when unsure,
 * which is the signal to ask Gemini. Items on chores or notes lists are always Chores & Tasks.
 */
export function guessCategory(name: string, listIcon?: ListIcon): Category {
  if (listIcon && TASK_LIST_ICONS.includes(listIcon)) return C.CHORES;
  const w = words(name);
  if (w.length === 0) return listIcon === 'hardware' ? C.HARDWARE_HOME : C.OTHER;
  const joined = ` ${w.join(' ')} `;
  if (w.includes('frozen')) return C.FROZEN;
  const first = w[0];
  if (TASK_VERBS.some((v) => joined.startsWith(` ${v} `)) && !WORDS.has(first)) return C.CHORES;
  for (const [phrase, category] of PHRASES) if (joined.includes(` ${phrase} `)) return category;
  // The last word is usually the thing itself ("chicken broth" aside, handled as a phrase).
  for (let i = w.length - 1; i >= 0; i--) {
    const hit = WORDS.get(w[i]);
    if (hit) return hit;
  }
  for (let i = w.length - 1; i >= 0; i--) {
    const hit = fuzzyWord(w[i]);
    if (hit) return hit;
  }
  return listIcon === 'hardware' ? C.HARDWARE_HOME : C.OTHER;
}

/** Ranking key for fuzzy suggestion matching in the add bar. */
export function closeEnough(query: string, candidate: string): boolean {
  const q = words(query).join(' ');
  if (q.length < 4) return false;
  return words(candidate).some((w) => editDistance(q, w, allowedTypos(q)) <= allowedTypos(q));
}
