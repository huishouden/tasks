import { describe, expect, test } from 'vitest';
import { hoursWarning } from '../../src/data/hours';

const HOURS = 'Mo-Fr 07:00-18:00; Sa 08:00-12:00; Su off';
// Monday 6 January 2031.
const at = (day: number, h: number, m = 0) => new Date(2031, 0, 5 + day, h, m).getTime();
const MONDAY_9 = at(1, 9);

describe('hoursWarning', () => {
  test('an appointment when the place is closed', () => {
    expect(hoursWarning(HOURS, { dueAt: at(1, 18, 30), allDay: false, dueBy: false }, MONDAY_9)).toMatch(/^Closed at 6:30\sPM\. That day: 7:00\sAM – 6:00\sPM$/);
    expect(hoursWarning(HOURS, { dueAt: at(1, 17), allDay: false, dueBy: false }, MONDAY_9)).toBeNull();
  });

  test('a deadline needs an opening before it', () => {
    // Saturday by 6 PM: open 8–12, fine.
    expect(hoursWarning(HOURS, { dueAt: at(6, 18), allDay: false, dueBy: true }, MONDAY_9)).toBeNull();
    // Today by 6 PM, but it is already 1 PM Saturday and they closed at noon.
    expect(hoursWarning(HOURS, { dueAt: at(6, 18), allDay: false, dueBy: true }, at(6, 13))).toMatch(/^Not open before 6:00\sPM/);
    // Monday by 6 AM: not open yet.
    expect(hoursWarning(HOURS, { dueAt: at(1, 6), allDay: false, dueBy: true }, at(1, 5))).toMatch(/^Not open before/);
  });

  test('a day it is closed', () => {
    expect(hoursWarning(HOURS, { dueAt: at(0, 0), allDay: true, dueBy: false }, MONDAY_9)).toBe('Closed that day.');
    expect(hoursWarning(HOURS, { dueAt: at(2, 0), allDay: true, dueBy: false }, MONDAY_9)).toBeNull();
  });

  test('unknown or unreadable hours say nothing', () => {
    expect(hoursWarning(undefined, { dueAt: at(0, 9), allDay: false, dueBy: false }, MONDAY_9)).toBeNull();
    expect(hoursWarning('Mo-Fr 07:00-18:00; PH off', { dueAt: at(0, 9), allDay: false, dueBy: false }, MONDAY_9)).toBeNull();
    expect(hoursWarning(HOURS, { dueAt: null, allDay: false, dueBy: false }, MONDAY_9)).toBeNull();
  });
});
