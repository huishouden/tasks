import { describe, expect, it } from 'vitest';
import { ingredientAvailable, ingredientChoices, kitchenInventory, mealKey, validateMeals, type Meal } from '../../src/data/menus';
import { CATEGORIES, URGENCY, type ListItem, type ShoppingList } from '../../src/data/model';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_780_000_000_000;

function list(id: string, icon: ShoppingList['icon']): ShoppingList {
  return { id, name: id, description: '', icon, color: '#000', sortOrder: 0, createdAt: 0 };
}

function bought(name: string, daysAgo: number | null, listId = 'groceries'): ListItem {
  return {
    id: `${name}-${listId}-${daysAgo}`,
    listId,
    name,
    category: CATEGORIES.OTHER,
    quantity: '1',
    notes: '',
    addedBy: 'Alex',
    completed: daysAgo !== null,
    urgency: URGENCY.NORMAL,
    createdAt: 0,
    updatedAt: 0,
    completedAt: daysAgo === null ? null : NOW - daysAgo * DAY,
  };
}

describe('kitchenInventory', () => {
  const lists = [list('groceries', 'grocery'), list('costco', 'bulk'), list('hardware', 'hardware')];

  it('lists food checked off in the last 10 days, newest first, once per name', () => {
    const items = [
      bought('Eggs', 3),
      bought('Steak', 1),
      bought('eggs', 9, 'costco'),
      bought('Rice', 12),
      bought('Pears', null),
      bought('Light bulbs', 1, 'hardware'),
    ];
    expect(kitchenInventory(items, lists, NOW)).toEqual(['Steak', 'Eggs']);
  });
});

describe('ingredientAvailable', () => {
  const available = ['chicken tenderloins', 'potatoes', 'string cheese', 'orange juice', 'berries'];

  it.each([
    ['chicken tenderloins', true],
    ['chicken', true],
    ['potato', true],
    ['Potatoes', true],
    ['berry', true],
    ['olive oil', true],
    ['salt', true],
    ['salmon', false],
    ['bread', false],
    ['cheese', true],
    ['black pepper', true],
    ['bell pepper', false],
    ['peanut butter', false],
    ['garlic', false],
  ])('%s -> %s', (ingredient, expected) => {
    expect(ingredientAvailable(ingredient, available)).toBe(expected);
  });
});

describe('validateMeals', () => {
  const available = ['eggs', 'mushrooms', 'steak', 'rice', 'zucchini'];

  it('keeps meals made from what was bought plus basics', () => {
    const meals = validateMeals(
      {
        meals: [
          {
            type: 'dinner',
            name: 'Steak with rice and zucchini',
            parts: [
              { ingredients: ['steak', 'butter'], prep: 'Pan-seared in butter with salt and pepper' },
              { ingredients: ['rice'], prep: 'Cooked in a rice cooker' },
              { ingredients: ['zucchini'], prep: 'Sliced and pan-fried in oil with seasoning' },
            ],
          },
        ],
      },
      available,
    );
    expect(meals.map((m) => m.name)).toEqual(['Steak with rice and zucchini']);
  });

  it('drops meals that use something not bought, of an unknown type, or malformed', () => {
    const meals = validateMeals(
      {
        meals: [
          { type: 'breakfast', name: 'Eggs Benedict', parts: [{ ingredients: ['eggs', 'english muffin'], prep: 'Poached' }] },
          { type: 'brunch', name: 'Mushroom eggs', parts: [{ ingredients: ['eggs', 'mushrooms'], prep: 'Scrambled' }] },
          { type: 'lunch', name: 'Rice bowl', parts: [{ ingredients: 'rice', prep: 'Cooked' }] },
          { type: 'lunch', name: '', parts: [{ ingredients: ['rice'], prep: 'Cooked' }] },
          { type: 'breakfast', name: 'Mushroom omelet', parts: [{ ingredients: ['eggs', 'mushrooms'], prep: 'Folded over sautéed mushrooms' }] },
        ],
      },
      available,
    );
    expect(meals.map((m) => m.name)).toEqual(['Mushroom omelet']);
  });

  it('returns nothing for a response without meals', () => {
    expect(validateMeals({ text: 'sorry' }, available)).toEqual([]);
    expect(validateMeals(null, available)).toEqual([]);
  });
});

describe('mealKey', () => {
  it('is the same for names that differ only in case, spacing and punctuation', () => {
    expect(mealKey({ name: 'Seared Steak with Rice' })).toBe('seared-steak-with-rice');
    expect(mealKey({ name: '  seared steak, with rice! ' })).toBe('seared-steak-with-rice');
  });

  it('never returns an empty ID', () => {
    expect(mealKey({ name: '!!!' })).toBe('meal');
  });

  it('stays within a reasonable document ID length', () => {
    expect(mealKey({ name: 'a'.repeat(500) })).toHaveLength(120);
  });
});

describe('ingredientChoices', () => {
  const meal: Meal = {
    type: 'dinner',
    name: 'Steak fajitas',
    parts: [
      { ingredients: ['steak', 'bell pepper', 'olive oil', 'salt'], prep: 'Seared in olive oil with salt' },
      { ingredients: ['tortillas', 'Steak', 'garlic', 'sour cream'], prep: 'Warmed in a pan' },
      { ingredients: ['peanut butter', 'black pepper', ' '], prep: 'On the side' },
    ],
  };

  it('ticks everything that is neither on the list nor bought recently', () => {
    expect(ingredientChoices(meal, [], [])).toEqual([
      { name: 'Steak', selected: true, note: null },
      { name: 'Bell pepper', selected: true, note: null },
      { name: 'Tortillas', selected: true, note: null },
      { name: 'Garlic', selected: true, note: null },
      { name: 'Sour cream', selected: true, note: null },
      { name: 'Peanut butter', selected: true, note: null },
    ]);
  });

  it('unticks what is already on the list, allowing plurals and partial names', () => {
    const choices = ingredientChoices(meal, ['Tortilla', 'Sour cream (light)', 'Milk'], []);
    expect(choices.filter((c) => !c.selected)).toEqual([
      { name: 'Tortillas', selected: false, note: 'on list' },
      { name: 'Sour cream', selected: false, note: 'on list' },
    ]);
  });

  it('unticks what was bought recently, and prefers "on list" when both apply', () => {
    const choices = ingredientChoices(meal, ['Garlic'], ['Steak', 'garlic']);
    expect(choices.find((c) => c.name === 'Steak')).toEqual({ name: 'Steak', selected: false, note: 'bought recently' });
    expect(choices.find((c) => c.name === 'Garlic')).toEqual({ name: 'Garlic', selected: false, note: 'on list' });
    expect(choices.find((c) => c.name === 'Bell pepper')?.selected).toBe(true);
  });

  it('skips kitchen basics but keeps groceries whose names contain a basic', () => {
    const names = ingredientChoices(meal, [], []).map((c) => c.name);
    expect(names).not.toContain('Olive oil');
    expect(names).not.toContain('Salt');
    expect(names).not.toContain('Black pepper');
    expect(names).toEqual(expect.arrayContaining(['Bell pepper', 'Garlic', 'Peanut butter']));
  });

  it('collapses duplicates across parts, including case and plural differences', () => {
    const doubled: Meal = {
      type: 'breakfast',
      name: 'Eggs two ways',
      parts: [
        { ingredients: ['eggs', 'toast'], prep: 'Fried' },
        { ingredients: ['Egg', 'EGGS'], prep: 'Boiled' },
      ],
    };
    expect(ingredientChoices(doubled, [], []).map((c) => c.name)).toEqual(['Eggs', 'Toast']);
  });
});
