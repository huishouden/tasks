import { describe, expect, it } from 'vitest';
import { allDayStart } from '@huishouden/pwa-kit/agenda';
import { applyOps } from '@huishouden/pwa-kit/store';
import { resolveOps, todoOpsAllowed } from '@huishouden/pwa-kit/todos';
import { agendaDoc, agendaOpsAllowed, canEdit, fillEditOps } from '@huishouden/pwa-kit/agenda';
import { agendaItems, cancelAction, doneAction, itemAgenda, itemEdit, itemReminder, itemTodo, itemUrl, reminderItems, todoItems, LEAD_MS } from '../../src/data/publish';
import { CATEGORIES, URGENCY, isCancelled, type ListItem, type ShoppingList } from '../../src/data/model';
import { SUITE_ORIGIN } from '@huishouden/pwa-kit/site';

const at = (y: number, m: number, d: number, hh = 0, mm = 0) => new Date(y, m - 1, d, hh, mm).getTime();
const chores: ShoppingList = { id: 'chores', name: 'Chores & Notes', description: '', icon: 'chores', color: '#8a6f9e', sortOrder: 4, createdAt: 0 };

function item(overrides: Partial<ListItem>): ListItem {
  return {
    id: 'i1', listId: 'chores', name: 'Drop off dry cleaning', category: CATEGORIES.CHORES, quantity: '1', notes: '', addedBy: 'Alex',
    completed: false, urgency: URGENCY.NORMAL, createdAt: 0, updatedAt: 0, completedAt: null, ...overrides,
  };
}

describe('itemEdit: changes from a person\'s own Google Calendar', () => {
  it('moves, renames and re-notes the item in items/{id}, writing only those fields', () => {
    const edit = itemEdit(item({ by: 'Kim@Example.com' }));
    for (const kind of ['reschedule', 'rename', 'notes'] as const) expect(agendaOpsAllowed('tasks', edit[kind]!.ops)).toBe(true);
    const [move] = resolveOps(fillEditOps(edit.reschedule!.ops, { start: at(2031, 1, 7, 9) }), { now: 5, me: 'kim@example.com' });
    expect(move).toEqual({ col: 'items', id: 'i1', data: { dueAt: at(2031, 1, 7, 9), updatedAt: 5 }, merge: true });
    const [rename] = resolveOps(fillEditOps(edit.rename!.ops, { title: 'Pick up dry cleaning' }), { now: 5, me: 'kim@example.com' });
    expect(rename.data).toEqual({ name: 'Pick up dry cleaning', updatedAt: 5 });
    const [notes] = resolveOps(fillEditOps(edit.notes!.ops, { notes: 'Ticket 42' }), { now: 5, me: 'kim@example.com' });
    expect(notes.data).toEqual({ notes: 'Ticket 42', updatedAt: 5 });
  });

  it('admins and members on any item; helpers and kids only on their own, as the rules allow', () => {
    const own = { app: 'tasks', edit: itemEdit(item({ by: 'kim@example.com' })) };
    expect(canEdit(own, 'reschedule', 'member', 'sam@example.com')).toBe(true);
    expect(canEdit(own, 'reschedule', 'kid', 'kim@example.com')).toBe(true);
    expect(canEdit(own, 'reschedule', 'helper', 'helen@example.com')).toBe(false);
    expect(canEdit({ app: 'tasks', edit: itemEdit(item({})) }, 'rename', 'kid', 'kim@example.com')).toBe(false);
  });

  it('the published agenda item carries them, as the kit stores it', () => {
    const entry = itemAgenda(item({ dueAt: at(2031, 1, 6, 15), by: 'kim@example.com' }), chores)!;
    expect(agendaDoc('tasks', entry, 'kim@example.com', 1).edit?.reschedule?.emails).toEqual(['kim@example.com']);
  });
});

describe('itemAgenda', () => {
  it('a time is an appointment; a deadline says "By"; both link to the item', () => {
    expect(itemAgenda(item({ dueAt: at(2031, 1, 6, 15), location: 'Example Cleaners' }), chores)).toEqual({
      ref: 'item:i1', kind: 'appointment', title: 'Drop off dry cleaning', start: at(2031, 1, 6, 15), allDay: false,
      detail: 'Example Cleaners · Chores & Notes', url: `${SUITE_ORIGIN}/tasks/?list=chores&item=i1`, status: 'upcoming',
      edit: expect.any(Object),
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

describe('todoItems', () => {
  const projects: ShoppingList = { id: 'projects', name: 'Weekend Projects', description: '', icon: 'notes', color: '#6f8f72', sortOrder: 5, createdAt: 0 };
  const groceries: ShoppingList = { id: 'groceries', name: 'Groceries', description: '', icon: 'grocery', color: '#2d6a4f', sortOrder: 0, createdAt: 0 };
  const lists = [chores, projects, groceries];
  const ME = 'sam@example.com';
  const NOW = at(2031, 1, 8, 9, 30);
  const ctx = { now: NOW, me: ME };
  const store = (items: ListItem[]) => ({ items });

  it('an open item is a to-do: its list, steps, when it was added, its due day, a link and its owner', () => {
    const steps = [{ id: 'a', text: 'Sort tools', done: true }, { id: 'b', text: 'Sweep', done: false }];
    const todo = itemTodo(item({ createdAt: at(2031, 1, 2, 8), dueAt: at(2031, 1, 20), allDay: true, dueBy: true, subtasks: steps, by: 'alex@example.com' }), chores);
    expect(todo).toEqual({
      ref: 'item:i1', title: 'Drop off dry cleaning', detail: 'Chores & Notes · 1 of 2 steps done', createdAt: at(2031, 1, 2, 8),
      due: allDayStart('2031-01-20'), url: `${SUITE_ORIGIN}/tasks/?list=chores&item=i1`, owner: 'alex@example.com', private: false,
      done: doneAction('i1'), cancel: cancelAction('i1'),
    });
    // At a time, it is due then; undated, it has no due and no owner when no one signed it.
    expect(itemTodo(item({ dueAt: at(2031, 1, 6, 15) }), chores)?.due).toBe(at(2031, 1, 6, 15));
    const plain = itemTodo(item({}), projects);
    expect(plain).not.toHaveProperty('due');
    expect(plain).not.toHaveProperty('owner');
    expect(plain?.detail).toBe('Weekend Projects');
  });

  it('done, cancelled, unnamed and shopping-list items are left out', () => {
    const all = todoItems(
      [
        item({ id: 'open' }),
        item({ id: 'done', completed: true, completedAt: NOW }),
        item({ id: 'cancelled', completed: true, completedAt: NOW, cancelledAt: NOW, cancelledBy: ME }),
        item({ id: 'blank', name: '  ' }),
        item({ id: 'milk', listId: 'groceries', name: 'Milk' }),
        item({ id: 'orphan', listId: 'gone' }),
        item({ id: 'project', listId: 'projects', name: 'Fix the squeaky gate' }),
      ],
      lists,
    );
    expect(all.map((t) => t.ref)).toEqual(['item:open', 'item:project']);
  });

  it('Done ticks it off for anyone; Cancel is for admins, members and whoever added it', () => {
    expect(doneAction('i1')).toEqual({
      label: 'Done', roles: ['admin', 'member', 'helper', 'kid'],
      ops: [{ col: 'items', id: 'i1', data: { completed: true, completedAt: '$now', updatedAt: '$now' }, merge: true }],
    });
    expect(cancelAction('i1')).toEqual({
      label: 'Cancel', roles: ['admin', 'member'], owner: true,
      ops: [{ col: 'items', id: 'i1', data: { completed: true, completedAt: '$now', cancelledAt: '$now', cancelledBy: '$me', updatedAt: '$now' }, merge: true }],
    });
    expect(todoOpsAllowed('tasks', doneAction('i1').ops)).toBe(true);
    expect(todoOpsAllowed('tasks', cancelAction('i1').ops)).toBe(true);
  });

  it('run from the portal, Done and Cancel leave the item as the app would, and it stops being published', () => {
    const open = item({ by: 'alex@example.com', createdAt: at(2031, 1, 2) });
    const todo = itemTodo(open, chores)!;

    const done = applyOps(store([open]), resolveOps(todo.done!.ops, ctx)).items[0];
    expect(done).toEqual({ ...open, completed: true, completedAt: NOW, updatedAt: NOW });
    expect(isCancelled(done)).toBe(false);
    expect(todoItems([done], lists)).toEqual([]);

    const cancelled = applyOps(store([open]), resolveOps(todo.cancel!.ops, ctx)).items[0];
    expect(cancelled).toEqual({ ...open, completed: true, completedAt: NOW, cancelledAt: NOW, cancelledBy: ME, updatedAt: NOW });
    expect(isCancelled(cancelled)).toBe(true);
    expect(todoItems([cancelled], lists)).toEqual([]);
  });
});
