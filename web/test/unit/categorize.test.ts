import { describe, expect, it } from 'vitest';
import { closeEnough, editDistance, guessCategory } from '../../src/data/categorize';
import { CATEGORIES as C } from '../../src/data/model';

describe('guessCategory', () => {
  it.each([
    // What the household actually typed.
    ['watermelon', C.PRODUCE],
    ['papaya', C.PRODUCE],
    ['asparagus', C.PRODUCE],
    ['mushrooms', C.PRODUCE],
    ['pears', C.PRODUCE],
    ['zucchini', C.PRODUCE],
    ['3 avocados', C.PRODUCE],
    ['tilapia', C.MEAT_SEAFOOD],
    ['chicken tenderloins', C.MEAT_SEAFOOD],
    ['steaks', C.MEAT_SEAFOOD],
    ['Crepes', C.BAKERY],
    ['brioche bread', C.BAKERY],
    ['condensed milk', C.PANTRY],
    ['cheese sticks', C.DAIRY_EGGS],
    ['greek yogurt', C.DAIRY_EGGS],
    ['sour cream', C.DAIRY_EGGS],
    // Phrases and modifiers.
    ['sparkling water', C.BEVERAGES],
    ['orange juice', C.BEVERAGES],
    ['coffee beans', C.BEVERAGES],
    ['peanut butter', C.PANTRY],
    ['sweet potatoes', C.PRODUCE],
    ['ice cream', C.FROZEN],
    ['frozen peas', C.FROZEN],
    ['chocolate chip cookies', C.SNACKS],
    ['tortilla chips', C.SNACKS],
    ['flour tortillas', C.BAKERY],
    ['paper towels', C.HOUSEHOLD],
    ['diapers', C.PERSONAL_CARE],
    ['AA batteries', C.HARDWARE_HOME],
    ['black pepper', C.PANTRY],
    ['berries', C.PRODUCE],
    ['get milk', C.DAIRY_EGGS],
    // To-dos on a shopping list.
    ['call plumber', C.CHORES],
    ['renew registration', C.CHORES],
    ['birthday card', C.OTHER],
  ])('%s → %s', (name, expected) => {
    expect(guessCategory(name)).toBe(expected);
  });

  it.each([
    ['zuchini', C.PRODUCE],
    ['brocoli', C.PRODUCE],
    ['tilapa', C.MEAT_SEAFOOD],
    ['aspargus', C.PRODUCE],
    ['bananna', C.PRODUCE],
    ['yoghurt', C.DAIRY_EGGS],
    ['tomatos', C.PRODUCE],
    ['strawbery', C.PRODUCE],
  ])('tolerates the typo %s → %s', (name, expected) => {
    expect(guessCategory(name)).toBe(expected);
  });

  it('does not stretch short words into others', () => {
    // "pie" is one letter from "pea" and "tie"; short words need an exact match.
    expect(guessCategory('tie')).toBe(C.OTHER);
  });

  it('files everything on a chores or notes list as a task', () => {
    expect(guessCategory('Wash the car', 'chores')).toBe(C.CHORES);
    expect(guessCategory('Note for the dog sitter', 'notes')).toBe(C.CHORES);
  });

  it('falls back to Hardware on a hardware list', () => {
    expect(guessCategory('weatherstrip', 'hardware')).toBe(C.HARDWARE_HOME);
    expect(guessCategory('light bulbs', 'hardware')).toBe(C.HARDWARE_HOME);
  });
});

describe('editDistance', () => {
  it('counts a swap of neighbouring letters as one edit', () => {
    expect(editDistance('tilapai', 'tilapia', 2)).toBe(1);
    expect(editDistance('zuchini', 'zucchini', 2)).toBe(1);
    expect(editDistance('apple', 'zebra', 1)).toBe(2);
  });
});

describe('closeEnough', () => {
  it('matches a misspelled query to a saved item', () => {
    expect(closeEnough('zuchini', 'Zucchini')).toBe(true);
    expect(closeEnough('strawbery', 'Strawberries')).toBe(true);
    expect(closeEnough('mil', 'Milk')).toBe(false);
  });
});
