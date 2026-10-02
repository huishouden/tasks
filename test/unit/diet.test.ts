import { describe, expect, it } from 'vitest';
import type { Diet } from '@huishouden/pwa-kit/food';
import { dietProblems, dietTags, gentleOnReflux, mealLevels } from '../../src/data/diet';
import type { Meal } from '../../src/data/menus';

const meal = (name: string, ingredients: string[], prep = 'Cooked', extras: string[] = []): Meal => ({ type: 'dinner', name, parts: [{ ingredients, prep }], extras });
const household = (diets: Diet[], avoid: string[] = []) => ({ people: [{ id: 'a', name: 'Sam', diets, avoid }] });
const terms = (m: Meal, diets: Diet[], avoid: string[] = []) => dietProblems(m, household(diets, avoid)).map((p) => p.term);

describe('dietProblems', () => {
  it('never lets meat or fish through for a vegetarian', () => {
    expect(terms(meal('Chicken stir-fry', ['chicken thighs', 'broccoli']), ['vegetarian'])).toEqual(['chicken']);
    expect(terms(meal('Caesar salad', ['romaine', 'anchovies']), ['vegetarian'])).toEqual(['anchovies']);
    expect(terms(meal('Veggie burger', ['veggie burger', 'bun']), ['vegetarian'])).toEqual([]);
    expect(terms(meal('Eggplant parmesan', ['eggplant', 'mozzarella']), ['vegetarian'])).toEqual([]);
  });

  it('vegan also rules out dairy, eggs and honey, but not plant milks or eggplant', () => {
    expect(terms(meal('Oatmeal', ['oats', 'milk']), ['vegan'])).toEqual(['milk']);
    expect(terms(meal('Oatmeal', ['oats', 'oat milk', 'peanut butter']), ['vegan'])).toEqual([]);
    expect(terms(meal('Roast eggplant', ['eggplant']), ['vegan'])).toEqual([]);
    expect(terms(meal('Scramble', ['eggs']), ['vegan'])).toEqual(['egg']);
  });

  it('GERD is a preference, never a reason to drop a meal', () => {
    expect(terms(meal('Spicy shrimp marinara', ['shrimp', 'jalapeño', 'marinara']), ['gerd'])).toEqual([]);
  });

  it('pregnancy: no raw fish, high-mercury fish, alcohol or unheated deli meat', () => {
    expect(terms(meal('Salmon sushi', ['salmon', 'rice']), ['pregnant'])).toEqual(['sushi']);
    expect(terms(meal('Grilled swordfish', ['swordfish']), ['pregnant'])).toEqual(['swordfish']);
    expect(terms(meal('Mussels in wine', ['mussels', 'white wine']), ['pregnant'])).toEqual(['wine']);
    expect(terms(meal('Turkey sandwich', ['deli turkey', 'bread'], 'Assembled cold'), ['pregnant'])).toEqual(['deli, not heated']);
    expect(terms(meal('Hot turkey melt', ['deli turkey', 'bread'], 'Heated in a pan until steaming'), ['pregnant'])).toEqual([]);
    expect(terms(meal('Baked salmon', ['salmon'], 'Baked until cooked through'), ['pregnant'])).toEqual([]);
  });

  it('allergies, kosher and avoid lists', () => {
    expect(terms(meal('Pesto pasta', ['pasta', 'pesto']), ['nut allergy'])).toEqual(['pesto']);
    expect(terms(meal('Cheeseburger', ['beef patty', 'cheddar']), ['kosher'])).toEqual(['beef with cheddar']);
    expect(terms(meal('Greek salad', ['cucumber', 'olives']), [], ['olives'])).toEqual(['olives']);
  });

  it('checks declared extras too', () => {
    expect(terms(meal('Rice bowl', ['rice', 'bacon'], 'Cooked', ['bacon']), ['halal'])).toEqual(['bacon']);
  });
});

describe('meal levels', () => {
  it("words raise the model's rating, never lower it", () => {
    expect(mealLevels(meal('Spicy shrimp', ['shrimp', 'jalapeño']), { heat: 0 })).toMatchObject({ heat: 2 });
    expect(mealLevels(meal('Rice', ['rice']), { heat: 3 })).toMatchObject({ heat: 3 });
    expect(mealLevels(meal('Pasta marinara', ['pasta', 'marinara']))).toMatchObject({ acidity: 2, heat: 0 });
    expect(mealLevels(meal('Fried chicken', ['chicken'], 'Deep-fried'))).toMatchObject({ richness: 3 });
    expect(mealLevels(meal('Pan-fried zucchini', ['zucchini'], 'Pan-fried in a little oil'))).toMatchObject({ richness: 0 });
    expect(mealLevels(meal('Sweet potato mash', ['sweet potatoes']))).toMatchObject({ sweetness: 0 });
    expect(mealLevels(meal('Yogurt with honey', ['greek yogurt', 'honey']))).toMatchObject({ sweetness: 1 });
  });

  it('gentle on reflux means no heat and at most a little of the rest', () => {
    expect(gentleOnReflux({ heat: 0, acidity: 1, richness: 1, sweetness: 0 })).toBe(true);
    expect(gentleOnReflux({ heat: 1, acidity: 0, richness: 0, sweetness: 0 })).toBe(false);
    expect(gentleOnReflux({ heat: 0, acidity: 2, richness: 0, sweetness: 0 })).toBe(false);
  });

  it('tags vegan and vegetarian meals as a menu would', () => {
    expect(dietTags(meal('Bean bowl', ['black beans', 'rice']))).toEqual(['Vegan']);
    expect(dietTags(meal('Omelet', ['eggs', 'spinach']))).toEqual(['Vegetarian']);
    expect(dietTags(meal('Steak', ['steak']))).toEqual([]);
  });
});
