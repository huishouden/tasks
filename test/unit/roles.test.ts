import { describe, expect, it } from 'vitest';
import { itemData, mayChangeItem, type ListItem } from '../../src/data/model';

const ME = 'helper@example.com';

describe('who may change an item', () => {
  it('lets admins and members change anyone’s', () => {
    expect(mayChangeItem({ by: 'alex@example.com' }, 'admin', ME)).toBe(true);
    expect(mayChangeItem({}, 'member', ME)).toBe(true);
  });

  it('lets helpers and kids change only what they added, as the rules do', () => {
    expect(mayChangeItem({ by: ME }, 'helper', ME)).toBe(true);
    expect(mayChangeItem({ by: ME }, 'kid', ME)).toBe(true);
    expect(mayChangeItem({ by: 'alex@example.com' }, 'helper', ME)).toBe(false);
    // Items from before `by` was recorded belong to no helper.
    expect(mayChangeItem({}, 'helper', ME)).toBe(false);
    expect(mayChangeItem({ by: ME }, null, ME)).toBe(false);
  });

  it('keeps who added an item when it is restored after Undo', () => {
    const item = { id: 'i1', name: 'Milk', listId: 'groceries', by: ME, addedBy: 'Kitchen', completed: false } as ListItem;
    expect(itemData(item)).toMatchObject({ by: ME, addedBy: 'Kitchen' });
  });
});
