import { describeDay, isOpenAt, parseOpeningHours } from '@huishouden/pwa-kit/hours';
import { formatTime } from '@huishouden/pwa-kit/time';
import { t } from '../i18n';

/**
 * A short note when a task's place is closed at the time it is due: "Closed at 6:30 PM. That day:
 * 7:00 AM – 6:00 PM". Null when the hours are unknown, cannot be read, or fit the task.
 *
 * - "at" a time: the place must be open then.
 * - "by" a time: it must be open at some point before then that day (and, for today, after now).
 * - a date with no time: it must open at some point that day.
 */
export function hoursWarning(
  openingHours: string | undefined,
  due: { dueAt: number | null; allDay: boolean; dueBy: boolean },
  now: number = Date.now(),
): string | null {
  const hours = parseOpeningHours(openingHours);
  if (!hours || due.dueAt === null) return null;
  const at = new Date(due.dueAt);
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  const that = describeDay(hours, at);
  const time = formatTime(at.getTime());

  const periods = hours[at.getDay()];
  if (periods.length === 0) return t('hours.closedThatDay');
  if (due.allDay) return null;
  if (!due.dueBy) return isOpenAt(hours, at) ? null : t('hours.closedAt', { time, hours: that });

  // "By" a time: some opening between the start of the window and the deadline.
  const from = Math.max(day.getTime(), now);
  const minutes = (t: number) => (t - day.getTime()) / 60_000;
  const windowStart = minutes(from);
  const windowEnd = minutes(due.dueAt);
  const fits = periods.some(([open, close]) => open < windowEnd && close > windowStart);
  return fits ? null : t('hours.notOpenBefore', { time, hours: that });
}
