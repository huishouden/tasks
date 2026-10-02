import { describe, expect, it } from 'vitest';
import { CATEGORIES, URGENCY, itemData, removedMessage, type ListItem } from '../../src/data/model';

function item(overrides: Partial<ListItem>): ListItem {
  return {
    id: 'abc123',
    listId: 'groceries',
    name: 'Eggs',
    category: CATEGORIES.DAIRY_EGGS,
    quantity: '1',
    notes: '',
    addedBy: 'Caleb',
    completed: false,
    urgency: URGENCY.NORMAL,
    createdAt: 1,
    updatedAt: 2,
    completedAt: null,
    ...overrides,
  };
}

describe('itemData', () => {
  it('keeps every stored field and drops the id', () => {
    const full = item({
      quantity: '2 dozen',
      notes: 'free range',
      position: 1500,
      dueAt: 1_800_000_000_000,
      allDay: true,
      location: 'Market',
      link: 'https://example.com',
      subtasks: [{ id: 's1', text: 'Check date', done: true }],
      completed: true,
      completedAt: 3,
    });
    const { id, ...rest } = full;
    expect(id).toBe('abc123');
    expect(itemData(full)).toEqual(rest);
    expect(itemData(full)).not.toHaveProperty('id');
  });

  it('keeps nulls but omits undefined fields, which Firestore rejects', () => {
    const data = itemData(item({ dueAt: null, location: undefined }));
    expect(data).toHaveProperty('dueAt', null);
    expect(data).toHaveProperty('completedAt', null);
    expect(data).not.toHaveProperty('location');
  });
});

describe('removedMessage', () => {
  it.each([
    ['Deleted "Eggs"', [item({})], 'deleted'],
    ['Deleted 2 items', [item({}), item({ id: 'b', name: 'Milk' })], 'deleted'],
    ['Cleared 1 done item', [item({})], 'cleared'],
    ['Cleared 4 done items', [item({}), item({ id: 'b' }), item({ id: 'c' }), item({ id: 'd' })], 'cleared'],
  ] as const)('%s', (expected, items, how) => {
    expect(removedMessage([...items], how)).toBe(expected);
  });
});
