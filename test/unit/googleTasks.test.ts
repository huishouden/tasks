import { describe, expect, it } from 'vitest';
import { googleTaskItem, googleTaskItemId, toTasksSettings } from '../../src/data/googleTasks';

const task = { id: 'dGFzay1lZ2dz', listId: 'g1', title: 'Call the dentist', notes: 'Ask about Tuesday', due: '2031-05-16', updated: 0, completed: false };

describe('Google Tasks settings', () => {
  it('reads links and handled ids defensively', () => {
    expect(
      toTasksSettings({
        googleTasks: [
          { googleListId: 'g1', title: 'My Tasks', listId: 'chores', mode: 'suggest' },
          { googleListId: 'g2', title: 'Groceries', listId: 'groceries', mode: 'add' },
          { googleListId: '', listId: 'x' },
          { googleListId: 'g3', title: 'Odd', listId: 'chores', mode: 'shout' },
          'nonsense',
        ],
        handled: ['a', 7, 'b'],
      }),
    ).toEqual({
      googleTasks: [
        { googleListId: 'g1', title: 'My Tasks', listId: 'chores', mode: 'suggest' },
        { googleListId: 'g2', title: 'Groceries', listId: 'groceries', mode: 'add' },
        { googleListId: 'g3', title: 'Odd', listId: 'chores', mode: 'suggest' },
      ],
      handled: ['a', 'b'],
    });
    expect(toTasksSettings(undefined)).toEqual({ googleTasks: [], handled: [] });
  });
});

describe('a Google task on a list', () => {
  it('keeps its title, notes and day, under a fixed id', () => {
    expect(googleTaskItem(task, { listId: 'chores' }, 'chores', 'Alex')).toEqual({
      id: 'gt-dGFzay1lZ2dz',
      listId: 'chores',
      listIcon: 'chores',
      name: 'Call the dentist',
      notes: 'Ask about Tuesday',
      addedBy: 'Alex',
      googleTaskId: 'dGFzay1lZ2dz',
      due: new Date(2031, 4, 16).getTime(),
    });
    expect(googleTaskItemId('a/b c')).toBe('gt-a_b_c');
  });
});
