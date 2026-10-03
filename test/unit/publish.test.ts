import { describe, expect, it } from 'vitest';
import { allDayStart } from '@huishouden/pwa-kit/agenda';
import { agendaItems, itemAgenda, itemReminder, itemUrl, reminderItems, LEAD_MS } from '../../src/data/publish';
import { CATEGORIES, URGENCY, type ListItem, type ShoppingList } from '../../src/data/model';

const at = (y: number, m: number, d: number, hh = 0, mm = 0) => new Date(y, m - 1, d, hh, mm).getTime();
const chores: ShoppingList = { id: 'chores', name: 'Chores & Notes', description: '', icon: 'chores', color: '#8a6f9e', sortOrder: 4, createdAt: 0 };

function item(overrides: Partial<ListItem>): ListItem {
  return {
    id: 'i1', listId: 'chores', name: 'Drop off dry cleaning', category: CATEGORIES.CHORES, quantity: '1', notes: '', addedBy: 'Alex',
    completed: false, urgency: URGENCY.NORMAL, createdAt: 0, updatedAt: 0, completedAt: null, ...overrides,
  };
}

describe('itemAgenda', () => {
  it('a time is an appointment; a deadline says "By"; both link to the item', () => {
    expect(itemAgenda(item({ dueAt: at(2031, 1, 6, 15), location: 'Example Cleaners' }), chores)).toEqual({
      ref: 'item:i1', kind: 'appointment', title: 'Drop off dry cleaning', start: at(2031, 1, 6, 15), allDay: false,
      detail: 'Example Cleaners · Chores & Notes', url: 'https://huishouden-piekstra.web.app/tasks/?list=chores&item=i1', status: 'upcoming',
    });
    expect(itemAgenda(item({ dueAt: at(2031, 1, 6, 18), dueBy: true }), chores)).toMatchObject({ kind: 'task', detail: expect.stringMatching(/^By 6:00\s?PM · Chores & Notes$/) });
  });

  it('an all-day item starts at the day, and a checklist says how far along it is', () => {
    const steps = [{ id: 'a', text: 'Sort tools', done: true }, { id: 'b', text: 'Sweep', done: false }];
    expect(itemAgenda(item({ dueAt: at(2031, 1, 20), allDay: true, dueBy: true, subtasks: steps }), chores)).toMatchObject({
      kind: 'task', start: allDayStart('2031-01-20'), allDay: true, detail: '1 of 2 steps done · Chores & Notes',
    });
  });

  it('done items stay, marked done; undated or unnamed ones are left out', () => {
    expect(itemAgenda(item({ dueAt: at(2031, 1, 6, 15), completed: true }), chores)?.status).toBe('done');
    expect(itemAgenda(item({}), chores)).toBeNull();
    expect(itemAgenda(item({ dueAt: at(2031, 1, 6), name: '  ' }), chores)).toBeNull();
  });

  it('agendaItems has the dated to-dos only (planned dinners are Groceries\')', () => {
    const all = agendaItems([item({ dueAt: at(2031, 1, 6, 15) }), item({ id: 'i2' })], [chores]);
    expect(all.map((a) => a.title)).toEqual(['Drop off dry cleaning']);
  });
});

describe('itemReminder', () => {
  it('an hour before a time, with what kind of time it is', () => {
    expect(itemReminder(item({ dueAt: at(2031, 1, 6, 18), dueBy: true, location: 'Example Cleaners' }))).toEqual({
      app: 'tasks', ref: 'tasks:item:i1', title: 'Drop off dry cleaning', body: expect.stringMatching(/^By 6:00\s?PM · Example Cleaners$/),
      at: at(2031, 1, 6, 18) - LEAD_MS, url: itemUrl({ id: 'i1', listId: 'chores' }),
    });
    expect(itemReminder(item({ dueAt: at(2031, 1, 6, 15) }))?.body).toMatch(/^At 3:00\s?PM$/);
  });

  it('at 9 on the morning of an all-day item', () => {
    expect(itemReminder(item({ dueAt: at(2031, 1, 20), allDay: true, dueBy: true }))).toMatchObject({ at: at(2031, 1, 20, 9), body: 'Due today' });
    expect(itemReminder(item({ dueAt: at(2031, 1, 20), allDay: true }))).toMatchObject({ body: 'Today' });
  });

  it('none once done or without a date', () => {
    expect(itemReminder(item({ dueAt: at(2031, 1, 6, 15), completed: true }))).toBeNull();
    expect(reminderItems([item({}), item({ id: 'i2', dueAt: at(2031, 1, 6, 15) })]).map((r) => r.ref)).toEqual(['tasks:item:i2']);
  });
});
