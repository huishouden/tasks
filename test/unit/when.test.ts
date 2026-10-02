import { describe, expect, test } from 'vitest';
import { localeDayFirst, parseWhen } from '../../src/data/when';

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

// Friday 2 October 2026, 9:00 local time.
const OCT2 = new Date(2026, 9, 2, 9, 0).getTime();
const day = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const us = (text: string) => parseWhen(text, OCT2, { dayFirst: false });
const eu = (text: string) => parseWhen(text, OCT2, { dayFirst: true });

describe('parseWhen: written dates', () => {
  test('"by October 4th" is a deadline on 4 October, and the date words come out of the name', () => {
    expect(us('Cancel Tinyhood trial by October 4th')).toEqual({
      rest: 'Cancel Tinyhood trial',
      dueAt: day(2026, 10, 4),
      allDay: true,
      by: true,
      phrase: 'by October 4th',
    });
  });

  test('month names, short or long, with or without an ordinal, a weekday or a year', () => {
    const cases: [string, string, number][] = [
      ['Renew passport Oct 4', 'Renew passport', day(2026, 10, 4)],
      ['Renew passport oct. 4', 'Renew passport', day(2026, 10, 4)],
      ['Renew passport October 4, 2026', 'Renew passport', day(2026, 10, 4)],
      ['Renew passport October 4 2027', 'Renew passport', day(2027, 10, 4)],
      ['Renew passport 4 October', 'Renew passport', day(2026, 10, 4)],
      ['Renew passport 4th of October', 'Renew passport', day(2026, 10, 4)],
      ['Renew passport 21st Nov', 'Renew passport', day(2026, 11, 21)],
      ['Renew passport Sat, Oct 10', 'Renew passport', day(2026, 10, 10)],
      ['Renew passport on Sunday October 4th', 'Renew passport', day(2026, 10, 4)],
      ['Renew passport Sept 30', 'Renew passport', day(2027, 9, 30)],
      ['Renew passport December 31st', 'Renew passport', day(2026, 12, 31)],
    ];
    for (const [text, rest, dueAt] of cases) expect(us(text), text).toMatchObject({ rest, dueAt, allDay: true });
  });

  test('a date already gone this year is next year; today stays today', () => {
    expect(us('Dentist checkup March 3')).toMatchObject({ dueAt: day(2027, 3, 3) });
    expect(us('Dentist checkup October 1')).toMatchObject({ dueAt: day(2027, 10, 1) });
    expect(us('Dentist checkup October 2')).toMatchObject({ dueAt: day(2026, 10, 2) });
    expect(us('Leap day party Feb 29')).toMatchObject({ dueAt: day(2028, 2, 29) });
  });

  test('impossible dates are not read', () => {
    expect(us('Something February 30')).toBeNull();
    expect(us('Something 13/45')).toBeNull();
    expect(us('Something on the 32nd')).toBeNull();
  });

  test('"by", "before", "due" and "until" make a deadline; "on" and nothing do not', () => {
    expect(us('Return library books before Oct 9')).toMatchObject({ rest: 'Return library books', by: true, phrase: 'before Oct 9' });
    expect(us('Tax form due Oct 15')).toMatchObject({ rest: 'Tax form', by: true });
    expect(us('Tax form due by Oct 15')).toMatchObject({ rest: 'Tax form', by: true });
    expect(us('Tax form due on Oct 15')).toMatchObject({ rest: 'Tax form', by: false });
    expect(us('Keep the rental until Oct 15')).toMatchObject({ rest: 'Keep the rental', by: true });
    expect(us('Flu shot on Oct 15')).toMatchObject({ rest: 'Flu shot', by: false, phrase: 'on Oct 15' });
    expect(us('Flu shot Oct 15')).toMatchObject({ by: false });
  });

  test('a date with a time', () => {
    expect(us('Parent teacher meeting Oct 4 at 3pm')).toMatchObject({ rest: 'Parent teacher meeting', dueAt: day(2026, 10, 4, 15), allDay: false, by: false, phrase: 'Oct 4 at 3pm' });
    expect(us('Parent teacher meeting on October 14th at 4:30')).toMatchObject({ dueAt: day(2026, 10, 14, 16, 30), allDay: false });
    expect(us('Submit claim by Oct 4 at 5pm')).toMatchObject({ dueAt: day(2026, 10, 4, 17), by: true });
    expect(us('Submit claim Oct 4 by 5')).toMatchObject({ dueAt: day(2026, 10, 4, 17), by: true });
    // A morning hour on another day is still the morning, even though 8 has gone by today.
    expect(us('Flight 10/8 at 8am')).toMatchObject({ dueAt: day(2026, 10, 8, 8) });
    expect(us('Flight 10/8 at 8')).toMatchObject({ dueAt: day(2026, 10, 8, 8) });
  });

  test('numeric dates follow the device: month first in the US, day first elsewhere', () => {
    expect(us('Cancel trial 10/4')).toMatchObject({ rest: 'Cancel trial', dueAt: day(2026, 10, 4), phrase: '10/4' });
    expect(eu('Cancel trial 10/4')).toMatchObject({ dueAt: day(2027, 4, 10) });
    expect(eu('Cancel trial 4/10')).toMatchObject({ dueAt: day(2026, 10, 4) });
    expect(us('Cancel trial by 10/4/2026')).toMatchObject({ dueAt: day(2026, 10, 4), by: true });
    expect(us('Cancel trial 10/4/27')).toMatchObject({ dueAt: day(2027, 10, 4) });
    expect(us('Pay invoice 1/15')).toMatchObject({ dueAt: day(2027, 1, 15) });
  });

  test('fractions, sizes and amounts are not dates', () => {
    for (const name of ['1/2 gallon milk', 'Milk 1/2 gallon', '3/4', 'Flour 3/4 cup', '1 1/2 lb ground beef', 'Kids leggings size 10/12', 'Butter 1/4 lb', 'Pizza 2/3 boxes', '24/7 pharmacy', 'Paper towels 6/12 pack']) {
      expect(us(name), name).toBeNull();
    }
    // With a marking word, even a fraction-shaped date is a date.
    expect(us('Call the bank by 1/2')).toMatchObject({ rest: 'Call the bank', dueAt: day(2027, 1, 2), by: true });
  });

  test('"the 4th" is this month while it is still ahead, otherwise next month', () => {
    expect(us('Pay rent by the 4th')).toMatchObject({ rest: 'Pay rent', dueAt: day(2026, 10, 4), by: true });
    expect(us('Pay rent on the 2nd')).toMatchObject({ dueAt: day(2026, 10, 2), by: false });
    expect(us('Pay rent on the 1st')).toMatchObject({ dueAt: day(2026, 11, 1) });
    expect(us('Water bill the 31st')).toMatchObject({ dueAt: day(2026, 10, 31) });
    // 31 November does not exist: the next month that has one.
    expect(parseWhen('Water bill the 31st', day(2026, 11, 2, 9), { dayFirst: false })).toMatchObject({ dueAt: day(2026, 12, 31) });
  });

  test('relative dates', () => {
    expect(us('Follow up with the plumber in 3 days')).toMatchObject({ rest: 'Follow up with the plumber', dueAt: day(2026, 10, 5) });
    expect(us('Follow up in a week')).toMatchObject({ rest: 'Follow up', dueAt: day(2026, 10, 9) });
    expect(us('Follow up in 2 weeks')).toMatchObject({ dueAt: day(2026, 10, 16) });
    expect(us('Follow up in one day')).toMatchObject({ dueAt: day(2026, 10, 3) });
    expect(us('Book the vet next week')).toMatchObject({ rest: 'Book the vet', dueAt: day(2026, 10, 5), by: false });
    expect(us('Book the vet by next week')).toMatchObject({ dueAt: day(2026, 10, 5), by: true });
    // On a Monday, next week is seven days away.
    expect(parseWhen('Book the vet next week', day(2026, 10, 5, 9), { dayFirst: false })).toMatchObject({ dueAt: day(2026, 10, 12) });
    expect(us('Submit expenses by end of month')).toMatchObject({ rest: 'Submit expenses', dueAt: day(2026, 10, 31), by: true });
    expect(us('Submit expenses by the end of the month')).toMatchObject({ dueAt: day(2026, 10, 31), by: true, phrase: 'by the end of the month' });
    expect(us('Submit expenses end of this month')).toMatchObject({ dueAt: day(2026, 10, 31), by: false });
  });

  test('"by friday" is a deadline and leaves no stray "by" in the name', () => {
    expect(us('Pay rent by friday')).toMatchObject({ rest: 'Pay rent', dueAt: day(2026, 10, 9), by: true });
    expect(us('Pay rent before tomorrow')).toMatchObject({ rest: 'Pay rent', dueAt: day(2026, 10, 3), by: true });
  });

  test('more ordinary names stay as typed', () => {
    for (const name of ['6 eggs', '2 boxes of cereal', 'March Madness snacks', 'May contain nuts', 'Oct sale flyer', 'Dec 25 lights', 'The 4 seasons pizza', 'In n out', 'Week planner', 'End of aisle cleanup', 'Sun 4 pack', 'Sat 2 boxes', 'Room 12', '100 envelopes', 'AA batteries x 4']) {
      const parsed = us(name);
      if (name === 'Dec 25 lights') expect(parsed).toMatchObject({ rest: 'lights', dueAt: day(2026, 12, 25) });
      else expect(parsed, name).toBeNull();
    }
  });

  test('the device locale decides the order by default', () => {
    expect(localeDayFirst('en-US')).toBe(false);
    expect(localeDayFirst('en-GB')).toBe(true);
    expect(localeDayFirst('nl-NL')).toBe(true);
  });
});
