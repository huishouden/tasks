import { afterEach, describe, expect, it } from 'vitest';
import { localizeReminders } from '@huishouden/pwa-kit/reminders';
import { localizeTodos } from '@huishouden/pwa-kit/todos';
import { setLangForTests } from '@huishouden/pwa-kit/i18n';
import '../../src/i18n';
import { CATEGORIES, URGENCY, formatDue, listName, type ListItem, type ShoppingList } from '../../src/data/model';
import { itemReminder, itemTodo, reminderItems, todoItems } from '../../src/data/publish';

// Back to English, keeping the app's catalogue for the other test files.
afterEach(() => setLangForTests('en'));

const at = (y: number, m: number, d: number, hh = 0, mm = 0) => new Date(y, m - 1, d, hh, mm).getTime();
const NOW = at(2031, 1, 6, 9);
const chores: ShoppingList = { id: 'chores', name: 'Chores & Notes', description: '', icon: 'chores', color: '#8a6f9e', sortOrder: 4, createdAt: 0 };
const item = (o: Partial<ListItem>): ListItem => ({
  id: 'i1', listId: 'chores', name: 'Drop off dry cleaning', category: CATEGORIES.CHORES, quantity: '1', notes: '', addedBy: 'Alex',
  completed: false, urgency: URGENCY.NORMAL, createdAt: 0, updatedAt: 0, completedAt: null, ...o,
});

describe('due dates in Spanish and Dutch', () => {
  it('reads as each language writes it', async () => {
    await setLangForTests('es', ['es-MX']);
    expect(formatDue({ dueAt: at(2031, 1, 7, 18), dueBy: true }, NOW)).toMatch(/^Mañana · antes de las 6:00\s?p\.\s?m\.$/);
    expect(formatDue({ dueAt: at(2031, 1, 7), allDay: true, dueBy: true }, NOW)).toBe('Antes de: mañana');
    await setLangForTests('nl', ['nl-NL']);
    expect(formatDue({ dueAt: at(2031, 1, 6, 15), allDay: false }, NOW)).toBe('Vandaag · 15:00');
  });

  it('shows the default list in the reader’s language', async () => {
    await setLangForTests('nl');
    expect(listName(chores)).toBe('Klusjes en notities');
  });
});

describe('what other devices read', () => {
  it('a to-do carries its words and buttons in every language', async () => {
    const [todo] = await localizeTodos(() => todoItems([item({})], [chores]));
    expect(todo.done?.label).toBe('Mark done');
    expect(todo.texts?.es).toMatchObject({ title: 'Drop off dry cleaning', detail: 'Tareas y notas', done: 'Marcar como hecho', cancel: 'Cancelar' });
    expect(todo.texts?.nl).toMatchObject({ detail: 'Klusjes en notities', done: 'Afvinken', cancel: 'Annuleren' });
    expect(itemTodo(item({}), chores)?.title).toBe('Drop off dry cleaning');
  });

  it('a reminder body in every language', async () => {
    const [reminder] = await localizeReminders(() => reminderItems([item({ dueAt: at(2031, 1, 7, 18), dueBy: true })]));
    expect(reminder.body).toMatch(/^By 6:00\s?PM$/);
    expect(reminder.texts?.nl?.body).toBe('Uiterlijk 18:00');
    expect(itemReminder(item({ dueAt: at(2031, 1, 7), allDay: true }))?.body).toBe('Today');
  });
});
