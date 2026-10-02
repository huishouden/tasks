import { describe, expect, it } from 'vitest';
import { ingredientSource, kitchenInventory, mealIngredients, mealKey, menuPrompt, menuSystemInstruction, plannedGroceries, validateMeals } from '../../src/data/menus';
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

const PANTRY = ['salt', 'black pepper', 'common dried herbs and spices', 'cooking oil', 'cooking spray', 'butter'];
const nobody = { people: [] };

describe('plannedGroceries', () => {
  it('lists unchecked items on food lists only, once per name', () => {
    const lists = [list('groceries', 'grocery'), list('costco', 'bulk'), list('hardware', 'hardware')];
    const items = [bought('Zucchini', null), bought('zucchini', null, 'costco'), bought('Feta', 2), bought('Light bulbs', null, 'hardware')];
    expect(plannedGroceries(items, lists)).toEqual(['Zucchini']);
  });
});

describe('ingredientSource', () => {
  const ctx = { have: ['chicken tenderloins', 'potatoes', 'string cheese'], onList: ['zucchini', 'rice'], pantry: PANTRY };

  it.each([
    ['chicken', 'have'],
    ['Potatoes', 'have'],
    ['cheese', 'have'],
    ['zucchini', 'list'],
    ['rice', 'list'],
    ['olive oil', 'basic'],
    ['salt', 'basic'],
    ['black pepper', 'basic'],
    ['cooking spray', 'basic'],
    ['cumin', 'basic'],
    ['dried oregano', 'basic'],
    ['butter', 'basic'],
    ['bell pepper', null],
    ['peanut butter', null],
    ['garlic', null],
    ['gochujang', null],
    ['fresh basil', null],
    ['soy sauce', null],
  ])('%s -> %s', (ingredient, expected) => {
    expect(ingredientSource(ingredient, ctx)).toBe(expected);
  });

  it('spices are basics only when the pantry includes them', () => {
    expect(ingredientSource('cumin', { have: [], onList: [], pantry: ['salt'] })).toBeNull();
  });
});

describe('validateMeals', () => {
  const ctx = { have: ['eggs', 'mushrooms', 'steak'], onList: ['rice', 'zucchini'], pantry: PANTRY, food: nobody };

  it('keeps meals made from what is bought or listed, plus basics', () => {
    const { meals } = validateMeals(
      {
        meals: [
          {
            type: 'dinner',
            name: 'Steak with rice and zucchini',
            parts: [
              { ingredients: ['steak', 'butter'], prep: 'Pan-seared in butter with salt and pepper' },
              { ingredients: ['rice'], prep: 'Cooked in a rice cooker' },
              { ingredients: ['zucchini'], prep: 'Sliced and sautéed in oil with garlic powder' },
            ],
            extras: [],
          },
        ],
      },
      ctx,
    );
    expect(meals.map((m) => m.name)).toEqual(['Steak with rice and zucchini']);
    expect(meals[0].extras).toBeUndefined();
  });

  it('allows up to three declared extras and records them', () => {
    const { meals } = validateMeals(
      { meals: [{ type: 'breakfast', name: 'Mushroom and feta omelet', parts: [{ ingredients: ['eggs', 'mushrooms', 'feta', 'chives'], prep: 'Folded' }], extras: ['feta', 'chives', 'salt'] }] },
      ctx,
    );
    expect(meals).toHaveLength(1);
    expect(meals[0].extras).toEqual(['feta', 'chives']);
    expect(mealIngredients(meals[0], ctx)).toEqual({ have: ['Eggs', 'Mushrooms'], list: [], extra: ['Feta', 'Chives'] });
  });

  it('counts an extra named only in extras, not in the parts', () => {
    const { meals } = validateMeals(
      { meals: [{ type: 'lunch', name: 'Spinach toast', parts: [{ ingredients: ['eggs', 'spinach'], prep: 'Sautéed' }], extras: ['feta cheese'] }] },
      { ...ctx, onList: ['spinach'] },
    );
    expect(meals[0].extras).toEqual(['feta cheese']);
    expect(mealIngredients(meals[0], { ...ctx, onList: ['spinach'] }).extra).toEqual(['Feta cheese']);
  });

  it('drops meals with undeclared or too many extras, of an unknown type, or malformed', () => {
    const result = validateMeals(
      {
        meals: [
          { type: 'breakfast', name: 'Eggs Benedict', parts: [{ ingredients: ['eggs', 'english muffin'], prep: 'Poached' }], extras: [] },
          { type: 'dinner', name: 'Loaded steak', parts: [{ ingredients: ['steak', 'feta', 'olives', 'capers', 'pesto'], prep: 'Grilled' }], extras: ['feta', 'olives', 'capers', 'pesto'] },
          { type: 'brunch', name: 'Mushroom eggs', parts: [{ ingredients: ['eggs', 'mushrooms'], prep: 'Scrambled' }] },
          { type: 'lunch', name: 'Rice bowl', parts: [{ ingredients: 'rice', prep: 'Cooked' }] },
          { type: 'lunch', name: '', parts: [{ ingredients: ['rice'], prep: 'Cooked' }] },
          { type: 'breakfast', name: 'Mushroom omelet', parts: [{ ingredients: ['eggs', 'mushrooms'], prep: 'Folded over sautéed mushrooms' }] },
        ],
      },
      ctx,
    );
    expect(result.meals.map((m) => m.name)).toEqual(['Mushroom omelet']);
    expect(result.droppedUnlisted).toBe(2);
  });

  it('drops meals that break a diet, saying why', () => {
    const food = { people: [{ id: 'a', name: 'Sam', diets: ['vegetarian' as const], avoid: [] }] };
    const result = validateMeals(
      {
        meals: [
          { type: 'dinner', name: 'Steak and rice', parts: [{ ingredients: ['steak', 'rice'], prep: 'Seared' }], extras: [] },
          { type: 'dinner', name: 'Mushroom rice', parts: [{ ingredients: ['mushrooms', 'rice'], prep: 'Sautéed' }], extras: [] },
        ],
      },
      { ...ctx, food },
    );
    expect(result.meals.map((m) => m.name)).toEqual(['Mushroom rice']);
    expect(result.droppedDiet).toEqual([{ name: 'Steak and rice', reason: 'steak (Sam (vegetarian))' }]);
  });

  it('returns nothing for a response without meals', () => {
    expect(validateMeals({ text: 'sorry' }, ctx).meals).toEqual([]);
    expect(validateMeals(null, ctx).meals).toEqual([]);
  });
});

describe('the prompt', () => {
  it('names what is had and listed, the pantry, and the household rules as requirements', () => {
    const food = { people: [{ id: 'a', name: 'Sam', diets: ['gerd' as const, 'pregnant' as const], avoid: ['olives'] }] };
    const prompt = menuPrompt({ have: ['eggs'], onList: ['rice'], pantry: PANTRY, food });
    expect(prompt).toContain('HAVE: eggs');
    expect(prompt).toContain('ON THE LIST: rice');
    expect(prompt).toContain('PANTRY: Assume the kitchen already has salt');
    expect(prompt).toContain('HOUSEHOLD RULES (must all hold for every meal):');
    expect(prompt).toContain('Sam is pregnant');
    expect(prompt).toContain('Sam avoids olives');
    // GERD is a preference, not a rule.
    expect(prompt).toContain('HOUSEHOLD PREFERENCES (most meals, not all):');
    expect(prompt.split('HOUSEHOLD PREFERENCES')[0]).not.toContain('GERD');
    expect(prompt.split('HOUSEHOLD PREFERENCES')[1]).toContain('Sam has GERD (reflux): most meals, not every one, should follow this');
  });

  it('only pushes coffee at breakfast when nobody avoids caffeine', () => {
    expect(menuSystemInstruction(nobody)).toContain('Include coffee as the drink');
    const gerd = { people: [{ id: 'a', name: 'Sam', diets: ['gerd' as const], avoid: [] }] };
    expect(menuSystemInstruction(gerd)).not.toContain('Include coffee');
    expect(menuSystemInstruction(gerd)).toContain('Do not suggest coffee');
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
