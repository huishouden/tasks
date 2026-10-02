import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  URGENCY,
  formatDue,
  googleCalendarLink,
  isOverdue,
  splitIntoChecklist,
  toggleSubtask,
  upcomingItems,
  type ListItem,
} from '../../src/data/model';

// Local times, so the tests hold in any time zone.
const at = (y: number, m: number, d: number, hh = 0, mm = 0) => new Date(y, m - 1, d, hh, mm).getTime();
const NOW = at(2026, 10, 2, 9, 0); // Friday 9:00

function item(overrides: Partial<ListItem>): ListItem {
  return {
    id: overrides.name ?? 'x',
    listId: 'chores',
    name: 'Thing',
    category: CATEGORIES.CHORES,
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

describe('formatDue', () => {
  it('says Today and Tomorrow, with the time unless all-day', () => {
    expect(formatDue({ dueAt: at(2026, 10, 2, 14, 30) }, NOW)).toMatch(/^Today · 2:30\s?PM$/);
    expect(formatDue({ dueAt: at(2026, 10, 3), allDay: true }, NOW)).toBe('Tomorrow');
  });

  it('says "By" for an all-day deadline', () => {
    expect(formatDue({ dueAt: at(2026, 10, 4), allDay: true, dueBy: true }, NOW)).toMatch(/^By Sun, Oct 4$/);
    expect(formatDue({ dueAt: at(2026, 10, 3), allDay: true, dueBy: true }, NOW)).toBe('By tomorrow');
  });

  it('uses a short date further out', () => {
    expect(formatDue({ dueAt: at(2026, 10, 14), allDay: true }, NOW)).toMatch(/Oct 14/);
  });
});

describe('isOverdue', () => {
  it('is overdue after the time for timed items, after the day for all-day items', () => {
    expect(isOverdue({ dueAt: at(2026, 10, 2, 8, 0), completed: false }, NOW)).toBe(true);
    expect(isOverdue({ dueAt: at(2026, 10, 2), allDay: true, completed: false }, NOW)).toBe(false);
    expect(isOverdue({ dueAt: at(2026, 10, 1), allDay: true, completed: false }, NOW)).toBe(true);
  });

  it('is never overdue once done', () => {
    expect(isOverdue({ dueAt: at(2026, 9, 1), completed: true }, NOW)).toBe(false);
  });
});

describe('upcomingItems', () => {
  it('includes overdue and the next two weeks, soonest first, skipping done and undated', () => {
    const items = [
      item({ name: 'later', dueAt: at(2026, 10, 30) }),
      item({ name: 'soon', dueAt: at(2026, 10, 5) }),
      item({ name: 'overdue', dueAt: at(2026, 9, 30) }),
      item({ name: 'done', dueAt: at(2026, 10, 3), completed: true }),
      item({ name: 'undated' }),
    ];
    expect(upcomingItems(items, NOW).map((i) => i.name)).toEqual(['overdue', 'soon']);
  });
});

describe('googleCalendarLink', () => {
  it('prefills a one-hour event with place and notes', () => {
    const url = new URL(
      googleCalendarLink(
        { name: 'Car inspection', notes: 'Bring registration', dueAt: Date.UTC(2026, 9, 14, 14, 0), allDay: false, location: 'Service center' },
        'Weekend Projects',
      ),
    );
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Car inspection');
    expect(url.searchParams.get('dates')).toBe('20261014T140000Z/20261014T150000Z');
    expect(url.searchParams.get('location')).toBe('Service center');
    expect(url.searchParams.get('details')).toBe('Bring registration\nFrom Huishouden Tasks: Weekend Projects');
  });

  it('uses date-only stamps for all-day items', () => {
    const url = new URL(googleCalendarLink({ name: 'Bin day', notes: '', dueAt: at(2026, 10, 14), allDay: true }, 'Chores'));
    expect(url.searchParams.get('dates')).toBe('20261014/20261015');
  });
});

describe('splitIntoChecklist', () => {
  it('splits "Title: a, b, c" into a title and capitalised steps', () => {
    expect(
      splitIntoChecklist('Garage cleanout: sort tools, sweep the floor, donate old bikes, fix the light'),
    ).toEqual({
      title: 'Garage cleanout',
      steps: ['Sort tools', 'Sweep the floor', 'Donate old bikes', 'Fix the light'],
    });
  });

  it('is not offered without a colon or with a single part', () => {
    expect(splitIntoChecklist('Milk, eggs, bread')).toBeNull();
    expect(splitIntoChecklist('Note: call the plumber')).toBeNull();
  });
});

describe('toggleSubtask', () => {
  const steps = [
    { id: 'a', text: 'A', done: true },
    { id: 'b', text: 'B', done: false },
  ];

  it('reports when the last step is done, and when it is undone', () => {
    const done = toggleSubtask(steps, 'b');
    expect(done.allDone).toBe(true);
    expect(toggleSubtask(done.subtasks, 'a').allDone).toBe(false);
  });
});
