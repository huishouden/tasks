/**
 * Reads a due date and time out of what someone typed, so "Drycleaners dropoff before 6" becomes
 * "Drycleaners dropoff", due today by 6 PM, and "Cancel trial by October 4th" becomes "Cancel
 * trial", due by 4 October, without opening any fields.
 *
 * Deliberately narrow: it only acts on a time with a word that marks it ("before 6", "at 3pm",
 * "by noon"), a day word ("tomorrow", "friday") or a date written as one ("October 4th", "4 Oct",
 * "10/4", "the 4th", "in 3 days", "next week", "end of month"). A bare number is never a date or a
 * time, so "6 eggs", "2 boxes" and "1/2 gallon milk" are left alone.
 */

export interface ParsedWhen {
  /** The text without the date and time words: "Drycleaners dropoff". */
  rest: string;
  dueAt: number;
  allDay: boolean;
  /** "before 6" / "by October 4": a deadline rather than an appointment. */
  by: boolean;
  /** The words that were read, for showing what was inferred: "before 6", "by October 4th". */
  phrase: string;
}

export interface ParseWhenOptions {
  /** Whether "4/10" means 4 October (most of the world) rather than April 10 (US). Defaults to the device's locale. */
  dayFirst?: boolean;
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SHORT_DAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };

const MONTHS: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sept: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};
const MONTH = `(${Object.keys(MONTHS).join('|')})\\.?`;
const WEEKDAY = `(?:(?:${DAYS.join('|')}|${Object.keys(SHORT_DAYS).join('|')})\\.?,?\\s+)?`;
// Words in front of a date; all but "on" make it a deadline.
const LEAD = `(?:(by|before|due(?:\\s+by|\\s+on)?|until|til|till|on)\\s+)?`;
const ORD = `(?:st|nd|rd|th)?`;
const END = `(?=$|[\\s,.;!?)])`;
const YEAR = `(?:,?\\s+(\\d{4}))?`;

// "October 4th", "Oct. 4", "Sat, Oct 4", "October 4, 2026"
const MONTH_DAY = new RegExp(`(?:^|\\s)${LEAD}${WEEKDAY}${MONTH}\\s+(\\d{1,2})${ORD}${YEAR}${END}`, 'i');
// "4 October", "4th of Oct", "4 October 2026"
const DAY_MONTH = new RegExp(`(?:^|\\s)${LEAD}${WEEKDAY}(\\d{1,2})${ORD}\\s+(?:of\\s+)?${MONTH}${YEAR}${END}`, 'i');
// "10/4", "10/4/2026", "10/4/26"
const NUMERIC = new RegExp(`(?:^|\\s)${LEAD}(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?${END}`, 'i');
// "the 4th", "on the 21st", "by the 3rd"
const ORDINAL = new RegExp(`(?:^|\\s)${LEAD}the\\s+(\\d{1,2})(?:st|nd|rd|th)${END}`, 'i');
// "in 3 days", "in a week", "in 2 weeks"
const IN_DAYS = new RegExp(`(?:^|\\s)${LEAD}in\\s+(\\d{1,3}|a|an|one|two|three|four|five|six|seven)\\s+(days?|weeks?)${END}`, 'i');
// "next week", "by next week"
const NEXT_WEEK = new RegExp(`(?:^|\\s)${LEAD}next\\s+week${END}`, 'i');
// "end of month", "by the end of the month", "end of this month"
const END_OF_MONTH = new RegExp(`(?:^|\\s)${LEAD}(?:the\\s+)?end\\s+of\\s+(?:the\\s+|this\\s+)?month${END}`, 'i');

const WORD_NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
// What follows a fraction or a size rather than a date: "1/2 gallon", "3/4 cup".
const UNIT_AFTER =
  /^\s*(?:cups?|c\b|tbsp|tsp|teaspoons?|tablespoons?|lbs?|pounds?|oz|ounces?|gal(?:lons?)?|qts?|quarts?|pints?|pt\b|inch(?:es)?|in\b|"|ft\b|feet|kg|g\b|grams?|l\b|liters?|litres?|ml|dozen|sticks?|loaf|loaves|bags?|boxes?|cans?|packs?)/i;

// "before 6", "by 6:30pm", "at 3 pm", "@ 9am", "until 5", "by noon"
const TIME = /(?:^|\s)(before|by|at|@|until|til|till)\s+(noon|midnight|(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|a|p)?)(?=$|[\s,.;!?])/i;
// "6pm", "6:30 pm" without a leading word: the am/pm makes it unambiguous.
const BARE_TIME = /(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)(?=$|[\s,.;!?])/i;
// "today", "tonight", "tomorrow", "this evening", "on friday", "by friday", "next tue", "monday"
const DAY = new RegExp(
  `(?:^|\\s)(?:(by|before|on|next|this)\\s+)?(today|tonight|tomorrow|tmrw|tmr|morning|afternoon|evening|${DAYS.join('|')}|${Object.keys(SHORT_DAYS).join('|')})(?=$|[\\s,.;!?])`,
  'i',
);

function startOfDay(t: number): Date {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Whether a locale (the device's by default) writes dates day first, "4/10" for 4 October. */
export function localeDayFirst(locale?: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric' }).formatToParts(new Date(2000, 11, 31));
    return parts.findIndex((p) => p.type === 'day') < parts.findIndex((p) => p.type === 'month');
  } catch {
    return false;
  }
}

/** A real calendar day, or null for "February 30". A month past December rolls into the next year. */
function validDate(year: number, month: number, day: number): Date | null {
  const first = new Date(year, month, 1);
  if (day < 1 || day > 31) return null;
  const d = new Date(first.getFullYear(), first.getMonth(), day);
  return d.getMonth() === first.getMonth() ? d : null;
}

/** The date, this year or (when it has already gone by) the next year that has it; an explicit year is kept. */
function nextOccurrence(month: number, day: number, year: string | undefined, today: Date): Date | null {
  if (month < 0 || month > 11) return null;
  if (year) return validDate(year.length === 2 ? 2000 + Number(year) : Number(year), month, day);
  for (let y = today.getFullYear(); y <= today.getFullYear() + 8; y++) {
    const d = validDate(y, month, day);
    if (d && d >= today) return d;
  }
  return null;
}

const isDeadline = (lead: string | undefined) => !!lead && !/^(due\s+)?on$/i.test(lead);

interface DateMatch {
  whole: string;
  date: Date;
  by: boolean;
}

/** The first written date in `text`, if any. */
function findDate(text: string, today: Date, dayFirst: boolean): DateMatch | null {
  const found = (whole: string, lead: string | undefined, date: Date | null) => (date ? { whole, date, by: isDeadline(lead) } : null);

  let m = MONTH_DAY.exec(text);
  if (m) {
    const r = found(m[0], m[1], nextOccurrence(MONTHS[m[2].toLowerCase()], Number(m[3]), m[4], today));
    if (r) return r;
  }
  m = DAY_MONTH.exec(text);
  if (m) {
    const r = found(m[0], m[1], nextOccurrence(MONTHS[m[3].toLowerCase()], Number(m[2]), m[4], today));
    if (r) return r;
  }
  m = NUMERIC.exec(text);
  if (m) {
    const [whole, lead, a, b, year] = m;
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + whole.length);
    const [month, day] = dayFirst ? [Number(b), Number(a)] : [Number(a), Number(b)];
    // "1/2 gallon", "3/4" on its own, "1 1/2 cups", "size 10/12": quantities and sizes, not dates.
    const fraction = Number(a) < Number(b) && [2, 3, 4, 6, 8, 16].includes(Number(b));
    const quantity = UNIT_AFTER.test(after) || /\d\s*$/.test(before) || /\bsizes?\s*$/i.test(before) || (!lead && !year && fraction);
    if (!quantity) {
      const r = found(whole, lead, nextOccurrence(month - 1, day, year, today));
      if (r) return r;
    }
  }
  m = ORDINAL.exec(text);
  if (m) {
    // This month if the day is still ahead (or today), otherwise the next month that has it.
    for (let i = 0; i < 3; i++) {
      const d = validDate(today.getFullYear(), today.getMonth() + i, Number(m[2]));
      if (d && d >= today) return found(m[0], m[1], d);
    }
  }
  m = IN_DAYS.exec(text);
  if (m) {
    const n = WORD_NUMBERS[m[2].toLowerCase()] ?? Number(m[2]);
    const days = /^week/i.test(m[3]) ? n * 7 : n;
    return found(m[0], m[1], new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));
  }
  m = NEXT_WEEK.exec(text);
  if (m) {
    // The Monday that starts next week.
    const ahead = (1 - today.getDay() + 7) % 7 || 7;
    return found(m[0], m[1], new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead));
  }
  m = END_OF_MONTH.exec(text);
  if (m) return found(m[0], m[1], new Date(today.getFullYear(), today.getMonth() + 1, 0));
  return null;
}

export function parseWhen(text: string, now: number = Date.now(), { dayFirst = localeDayFirst() }: ParseWhenOptions = {}): ParsedWhen | null {
  let rest = text;
  const phrases: { at: number; words: string }[] = [];
  const take = (whole: string) => {
    phrases.push({ at: text.indexOf(whole.trim()), words: whole.trim() });
    rest = rest.replace(whole, ' ');
  };
  const today = startOfDay(now);

  let day: Date | null = null;
  let evening = false;
  let dateBy = false;

  const written = findDate(rest, today, dayFirst);
  if (written) {
    day = written.date;
    dateBy = written.by;
    take(written.whole);
  } else {
    const d = DAY.exec(rest);
    if (d) {
      const [whole, prefixRaw, wordRaw] = d;
      const prefix = prefixRaw?.toLowerCase();
      const word = wordRaw.toLowerCase();
      // Short day names are common words ("sat", "sun", "wed"); only read them after a marking word.
      const short = word in SHORT_DAYS;
      const isMorningEtc = word === 'morning' || word === 'afternoon' || word === 'evening';
      if ((!short || prefix) && (!isMorningEtc || prefix === 'this')) {
        if (word === 'today' || word === 'tonight' || isMorningEtc) day = today;
        else if (word === 'tomorrow' || word === 'tmrw' || word === 'tmr') day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        else {
          const target = short ? SHORT_DAYS[word] : DAYS.indexOf(word);
          let ahead = (target - today.getDay() + 7) % 7;
          if (ahead === 0 || prefix === 'next') ahead = ahead === 0 ? 7 : ahead;
          day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead);
        }
        evening = word === 'tonight' || word === 'evening' || word === 'afternoon';
        dateBy = prefix === 'by' || prefix === 'before';
        take(whole);
      }
    }
  }

  let hour: number | null = null;
  let minute = 0;
  let timeBy = false;
  let meridiem: string | undefined;
  const t = TIME.exec(rest);
  if (t) {
    const [whole, prep, spec, h, m, ap] = t;
    timeBy = /^(before|by|until|til|till)$/i.test(prep);
    if (/^noon$/i.test(spec)) hour = 12;
    else if (/^midnight$/i.test(spec)) {
      hour = 23;
      minute = 59;
    } else {
      hour = Number(h);
      minute = m ? Number(m) : 0;
      meridiem = ap?.toLowerCase().replace(/\./g, '');
    }
    take(whole);
  } else {
    const b = BARE_TIME.exec(rest);
    if (b) {
      const [whole, h, m, ap] = b;
      hour = Number(h);
      minute = m ? Number(m) : 0;
      meridiem = ap.toLowerCase().replace(/\./g, '');
      take(whole);
    }
  }
  if (hour !== null && (hour > 23 || minute > 59)) return null;

  if (day === null && hour === null) return null;

  if (hour !== null && hour <= 12) {
    if (meridiem?.startsWith('p') && hour < 12) hour += 12;
    else if (meridiem?.startsWith('a') && hour === 12) hour = 0;
    else if (!meridiem && hour < 12) {
      // No am/pm: errands and appointments are daytime. 1–6 means afternoon ("before 6");
      // 7–11 means morning unless it is tonight or that time has already gone by today.
      const passed = day === null && new Date(now).getHours() >= hour;
      if (hour <= 6 || evening || passed) hour += 12;
    }
  }

  let base = day ?? today;
  if (hour !== null) {
    let at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute);
    // A time with no day that has already passed today means tomorrow.
    if (day === null && at.getTime() <= now) at = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, hour, minute);
    base = at;
  }

  const cleaned = rest
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/(^[\s,;-]+|[\s,;:-]+$)/g, '')
    .trim();
  if (!cleaned) return null;
  return {
    rest: cleaned,
    dueAt: base.getTime(),
    allDay: hour === null,
    by: dateBy || (timeBy && hour !== null),
    phrase: phrases
      .sort((a, b) => a.at - b.at)
      .map((p) => p.words)
      .join(' '),
  };
}
