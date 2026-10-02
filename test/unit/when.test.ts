import { describe, expect, test } from 'vitest';
import { parseWhen } from '../../src/data/when';

// Monday 6 January 2031, 10:00 local time.
const NOW = new Date(2031, 0, 6, 10, 0).getTime();
const at = (d: number, h = 0, m = 0) => new Date(2031, 0, d, h, m).getTime();

describe('parseWhen', () => {
  test('"before 6" is a deadline today at 6 PM, and the words come out of the name', () => {
    expect(parseWhen('Drycleaners dropoff before 6', NOW)).toEqual({ rest: 'Drycleaners dropoff', dueAt: at(6, 18), allDay: false, by: true, phrase: 'before 6' });
  });

  test('times with a marking word or am/pm', () => {
    expect(parseWhen('Call plumber at 3pm', NOW)).toMatchObject({ rest: 'Call plumber', dueAt: at(6, 15), by: false });
    expect(parseWhen('Pick up kids by 2:30', NOW)).toMatchObject({ dueAt: at(6, 14, 30), by: true });
    expect(parseWhen('Haircut 11:15am', NOW)).toMatchObject({ rest: 'Haircut', dueAt: at(6, 11, 15) });
    expect(parseWhen('Return library books by noon', NOW)).toMatchObject({ dueAt: at(6, 12), by: true });
  });

  test('morning hours stay morning unless already past or tonight', () => {
    expect(parseWhen('Dentist at 11', NOW)).toMatchObject({ dueAt: at(6, 11) });
    expect(parseWhen('Walk dog at 9', NOW)).toMatchObject({ dueAt: at(6, 21) });
    expect(parseWhen('Movie tonight at 8', NOW)).toMatchObject({ rest: 'Movie', dueAt: at(6, 20) });
  });

  test('a time already gone today means tomorrow', () => {
    expect(parseWhen('Coffee at 9am', NOW)).toMatchObject({ dueAt: at(7, 9) });
  });

  test('day words, alone or with a time', () => {
    expect(parseWhen('Take out recycling tomorrow', NOW)).toEqual({ rest: 'Take out recycling', dueAt: at(7), allDay: true, by: false, phrase: 'tomorrow' });
    expect(parseWhen('Pay rent on friday', NOW)).toMatchObject({ rest: 'Pay rent', dueAt: at(10), allDay: true });
    expect(parseWhen('Oil change monday at 4', NOW)).toMatchObject({ rest: 'Oil change', dueAt: at(13, 16) });
    expect(parseWhen('Book club next wed', NOW)).toMatchObject({ rest: 'Book club', dueAt: at(8), allDay: true });
  });

  test('leaves ordinary item names alone', () => {
    for (const name of ['6 eggs', '2 boxes of diapers', 'Sun chips', 'Wed anniversary card', '7up', 'Batteries AA', 'Morning glory seeds', 'Light bulbs at home depot']) {
      expect(parseWhen(name, NOW)).toBeNull();
    }
  });

  test('nothing left after the time words means it is not an item name to change', () => {
    expect(parseWhen('tomorrow', NOW)).toBeNull();
    expect(parseWhen('at 25', NOW)).toBeNull();
  });
});
