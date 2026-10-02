/**
 * Reads a due time out of what someone typed, so "Drycleaners dropoff before 6" becomes
 * "Drycleaners dropoff", due today by 6 PM, without opening any fields.
 *
 * Deliberately narrow: it only acts on a time with a word that marks it ("before 6", "at 3pm",
 * "by noon") or a day word ("tomorrow", "friday"), so "6 eggs" or "2 boxes" are left alone.
 */

export interface ParsedWhen {
  /** The text without the time words: "Drycleaners dropoff". */
  rest: string;
  dueAt: number;
  allDay: boolean;
  /** "before 6" / "by 6": a deadline rather than an appointment. */
  by: boolean;
  /** The words that were read, for showing what was inferred: "before 6". */
  phrase: string;
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SHORT_DAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };

// "before 6", "by 6:30pm", "at 3 pm", "@ 9am", "until 5", "by noon"
const TIME = /(?:^|\s)(before|by|at|@|until|til|till)\s+(noon|midnight|(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|a|p)?)(?=$|[\s,.;!?])/i;
// "6pm", "6:30 pm" without a leading word: the am/pm makes it unambiguous.
const BARE_TIME = /(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)(?=$|[\s,.;!?])/i;
// "today", "tonight", "tomorrow", "this evening", "on friday", "next tue", "monday"
const DAY = new RegExp(
  `(?:^|\\s)(?:(on|next|this)\\s+)?(today|tonight|tomorrow|tmrw|tmr|morning|afternoon|evening|${DAYS.join('|')}|${Object.keys(SHORT_DAYS).join('|')})(?=$|[\\s,.;!?])`,
  'i',
);

function startOfDay(t: number): Date {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseWhen(text: string, now: number = Date.now()): ParsedWhen | null {
  let rest = text;
  const phrases: string[] = [];

  let day: Date | null = null;
  let evening = false;
  const d = DAY.exec(rest);
  if (d) {
    const [whole, prefix, wordRaw] = d;
    const word = wordRaw.toLowerCase();
    // Short day names are common words ("sat", "sun", "wed"); only read them after "on"/"next".
    const short = word in SHORT_DAYS;
    const isMorningEtc = word === 'morning' || word === 'afternoon' || word === 'evening';
    if ((!short || prefix) && (!isMorningEtc || prefix?.toLowerCase() === 'this')) {
      const today = startOfDay(now);
      if (word === 'today' || word === 'tonight' || isMorningEtc) day = today;
      else if (word === 'tomorrow' || word === 'tmrw' || word === 'tmr') day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      else {
        const target = short ? SHORT_DAYS[word] : DAYS.indexOf(word);
        let ahead = (target - today.getDay() + 7) % 7;
        if (ahead === 0 || prefix?.toLowerCase() === 'next') ahead = ahead === 0 ? 7 : ahead;
        day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead);
      }
      evening = word === 'tonight' || word === 'evening' || word === 'afternoon';
      phrases.push(whole.trim());
      rest = rest.replace(whole, ' ');
    }
  }

  let hour: number | null = null;
  let minute = 0;
  let by = false;
  let meridiem: string | undefined;
  const t = TIME.exec(rest);
  if (t) {
    const [whole, prep, spec, h, m, ap] = t;
    by = /^(before|by|until|til|till)$/i.test(prep);
    if (/^noon$/i.test(spec)) hour = 12;
    else if (/^midnight$/i.test(spec)) {
      hour = 23;
      minute = 59;
    }    else {
      hour = Number(h);
      minute = m ? Number(m) : 0;
      meridiem = ap?.toLowerCase().replace(/\./g, '');
    }
    phrases.push(whole.trim());
    rest = rest.replace(whole, ' ');
  } else {
    const b = BARE_TIME.exec(rest);
    if (b) {
      const [whole, h, m, ap] = b;
      hour = Number(h);
      minute = m ? Number(m) : 0;
      meridiem = ap.toLowerCase().replace(/\./g, '');
      phrases.push(whole.trim());
      rest = rest.replace(whole, ' ');
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

  let base = day ?? startOfDay(now);
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
  return { rest: cleaned, dueAt: base.getTime(), allDay: hour === null, by: by && hour !== null, phrase: phrases.join(' ') };
}
