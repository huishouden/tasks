import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  URGENCY,
  firstName,
  formatListForSharing,
  groupByAisle,
  matchSuggestions,
  moveInOrder,
  positionBetween,
  sortItems,
  stapleKey,
  type ListItem,
  type Staple,
} from '../../src/data/model';
import { topStaples } from '../../src/components/StaplesShelf';

function item(overrides: Partial<ListItem>): ListItem {
  return {
    id: overrides.name ?? 'x',
    listId: 'groceries',
    name: 'Thing',
    category: CATEGORIES.OTHER,
    quantity: '1',
    notes: '',
    addedBy: 'Caleb',
    completed: false,
    urgency: URGENCY.NORMAL,
    createdAt: 0,
    updatedAt: 0,
    completedAt: null,
    ...overrides,
  };
}

function staple(displayName: string, timesAdded: number, lastAddedAt = 0): Staple {
  return { id: stapleKey(displayName), displayName, category: CATEGORIES.OTHER, defaultQuantity: '1', timesAdded, timesCompleted: 0, lastAddedAt };
}

describe('stapleKey', () => {
  it('normalizes case and spacing so "Milk" and " milk " share history', () => {
    expect(stapleKey('  Whole   Milk ')).toBe('whole milk');
  });

  it('removes slashes, which Firestore document IDs cannot contain', () => {
    expect(stapleKey('50/50 creamer')).toBe('50-50 creamer');
  });
});

describe('sortItems', () => {
  it('follows the manual position, falling back to creation time for older items', () => {
    const sorted = sortItems([
      item({ name: 'second', position: 2000 }),
      item({ name: 'legacy', createdAt: 1500 }),
      item({ name: 'first', position: 1000 }),
      item({ name: 'urgent', position: -5 }),
    ]);
    expect(sorted.map((i) => i.name)).toEqual(['urgent', 'first', 'legacy', 'second']);
  });
});

describe('positionBetween', () => {
  it('splits the gap between neighbours', () => {
    expect(positionBetween(item({ position: 1000 }), item({ position: 2000 }))).toBe(1500);
  });

  it('extends past either end', () => {
    expect(positionBetween(item({ position: 1000 }), undefined)).toBe(2000);
    expect(positionBetween(undefined, item({ position: 1000 }))).toBe(0);
  });

  it('reports when two positions are too close to split', () => {
    const a = 1_780_000_000_000;
    const b = a + 2 ** -12; // the next representable number after a timestamp-sized value
    expect(positionBetween(item({ position: a }), item({ position: b }))).toBeNull();
  });
});

describe('moveInOrder', () => {
  it('moves an item down and up', () => {
    expect(moveInOrder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveInOrder(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });
});

describe('groupByAisle', () => {
  it('orders groups by store walking order, not insertion order', () => {
    const groups = groupByAisle([
      item({ name: 'ice cream', category: CATEGORIES.FROZEN }),
      item({ name: 'apples', category: CATEGORIES.PRODUCE }),
      item({ name: 'milk', category: CATEGORIES.DAIRY_EGGS }),
    ]);
    expect(groups.map(([c]) => c)).toEqual([CATEGORIES.PRODUCE, CATEGORIES.DAIRY_EGGS, CATEGORIES.FROZEN]);
  });
});

describe('matchSuggestions', () => {
  const staples = [staple('Oat milk', 3), staple('Milk', 9), staple('Almond milk', 12), staple('Eggs', 20)];

  it('ranks prefix matches above substring matches, then by frequency', () => {
    expect(matchSuggestions(staples, 'mi').map((s) => s.displayName)).toEqual(['Milk', 'Almond milk', 'Oat milk']);
  });

  it('returns nothing for a blank query', () => {
    expect(matchSuggestions(staples, '  ')).toEqual([]);
  });
});

describe('topStaples', () => {
  it('skips one-off items and anything already on the list', () => {
    const shown = topStaples(
      [staple('Eggs', 5), staple('Milk', 4), staple('Birthday candles', 1)],
      [item({ name: 'Milk' })],
      10,
    );
    expect(shown.map((s) => s.displayName)).toEqual(['Eggs']);
  });

  it('shows an item again once it has been checked off', () => {
    const shown = topStaples([staple('Milk', 4)], [item({ name: 'Milk', completed: true })], 10);
    expect(shown.map((s) => s.displayName)).toEqual(['Milk']);
  });
});

describe('formatListForSharing', () => {
  it('groups by aisle and flags urgent items', () => {
    const text = formatListForSharing('Groceries', [
      item({ name: 'Eggs', category: CATEGORIES.DAIRY_EGGS, quantity: '2 dozen' }),
      item({ name: 'Bananas', category: CATEGORIES.PRODUCE, urgency: URGENCY.URGENT }),
      item({ name: 'Bread', category: CATEGORIES.BAKERY, completed: true }),
    ]);
    expect(text).toBe(
      ['Groceries', '', 'Produce & Greens:', '- Bananas [need today]', '', 'Dairy & Eggs:', '- Eggs (2 dozen)', '', 'Already done (1): Bread'].join('\n'),
    );
  });
});

describe('firstName', () => {
  it('uses the first word of the Google display name', () => {
    expect(firstName('Caleb Piekstra', 'x@example.com')).toBe('Caleb');
  });

  it('falls back to the email local part', () => {
    expect(firstName(null, 'someone@example.com')).toBe('someone');
  });
});
