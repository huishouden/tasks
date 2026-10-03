import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  URGENCY,
  firstName,
  TASK_DEFAULT_LISTS,
  formatListForSharing,
  isCancelled,
  isTaskList,
  moveInOrder,
  positionBetween,
  sortItems,
  type ListItem,
} from '../../src/data/model';
import { groceriesRedirect } from '../../src/lib/groceriesLink';

function item(overrides: Partial<ListItem>): ListItem {
  return {
    id: overrides.name ?? 'x',
    listId: 'chores',
    name: 'Thing',
    category: CATEGORIES.OTHER,
    quantity: '1',
    notes: '',
    addedBy: 'Alex',
    completed: false,
    urgency: URGENCY.NORMAL,
    createdAt: 0,
    updatedAt: 0,
    completedAt: null,
    ...overrides,
  };
}

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

describe('formatListForSharing', () => {
  it('lists what is left in order, with its due time and Need today, then what is done', () => {
    const now = new Date(2031, 0, 6, 9).getTime();
    const text = formatListForSharing(
      'Chores & Notes',
      [
        item({ name: 'Call the plumber', position: 2, dueAt: new Date(2031, 0, 6, 15).getTime() }),
        item({ name: 'Renew registration', position: 1, urgency: URGENCY.URGENT }),
        item({ name: 'Water the plants', completed: true }),
      ],
      now,
    );
    expect(text).toBe(['Chores & Notes', '', '- Renew registration [need today]', `- Call the plumber (Today · ${new Date(2031, 0, 6, 15).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})`, '', 'Already done (1): Water the plants'].join('\n'));
  });
});

describe('isCancelled', () => {
  it('a cancelled item reads as cancelled; open, done, or ticked again after the cancel, it does not', () => {
    const at = 1_900_000_000_000;
    expect(isCancelled(item({ completed: true, completedAt: at, cancelledAt: at, cancelledBy: 'sam@example.com' }))).toBe(true);
    expect(isCancelled(item({ completed: true, completedAt: at }))).toBe(false);
    // Un-ticked by a helper, who leaves the cancel fields on someone else's item, then ticked off.
    expect(isCancelled(item({ completed: false, completedAt: null, cancelledAt: at }))).toBe(false);
    expect(isCancelled(item({ completed: true, completedAt: at + 60_000, cancelledAt: at }))).toBe(false);
  });

  it('a shared list leaves cancelled items out of what is done', () => {
    const text = formatListForSharing('Chores & Notes', [
      item({ name: 'Water the plants', completed: true, completedAt: 5 }),
      item({ name: 'Book the window cleaner', completed: true, completedAt: 5, cancelledAt: 5 }),
    ]);
    expect(text).toBe('Chores & Notes\n\nEverything on this list is done.\nAlready done (1): Water the plants');
  });
});

describe('the split with Groceries', () => {
  it('Tasks has the to-do lists; its default lists are only those', () => {
    expect(isTaskList('chores')).toBe(true);
    expect(isTaskList('notes')).toBe(true);
    expect(isTaskList('grocery')).toBe(false);
    expect(TASK_DEFAULT_LISTS.map((l) => l.id)).toEqual(['chores']);
  });

  it('old links to Kitchen, Store, Meals or a shopping list go to Groceries, query kept', () => {
    expect(groceriesRedirect('?mode=meals')).toBe('/groceries/?mode=meals');
    expect(groceriesRedirect('?mode=hub')).toBe('/groceries/?mode=hub');
    expect(groceriesRedirect('?mode=lists')).toBeNull();
    expect(groceriesRedirect('?list=groceries&item=x', new Set(['groceries']))).toBe('/groceries/?list=groceries&item=x');
    expect(groceriesRedirect('?list=chores&item=x', new Set(['groceries']))).toBeNull();
    expect(groceriesRedirect('')).toBeNull();
  });
});

describe('firstName', () => {
  it('uses the first word of the Google display name', () => {
    expect(firstName('Alex Example', 'x@example.com')).toBe('Alex');
  });

  it('falls back to the email local part', () => {
    expect(firstName(null, 'someone@example.com')).toBe('someone');
  });
});
