import { useEffect, useId, useRef, useState } from 'react';
import { CalendarClock, CalendarPlus, CalendarSearch, ChevronDown, Download, ListChecks, Loader2, LocateFixed, MapPin, Plus, Send, Trash2, UserPlus, X, Zap } from 'lucide-react';
import { describeDay, parseOpeningHours } from '@huishouden/pwa-kit/hours';
import { PlaceSearchUnavailable, formatDistance, mapsSearchUrl, placeKinds, searchPlaces, type Place } from '@huishouden/pwa-kit/places';
import { findCalendarEvents, type CalendarMatch } from '@huishouden/pwa-kit/calendar';
import { getFirebase } from '../lib/firebase';
import {
  ALL_CATEGORIES,
  URGENCY,
  isTaskList,
  LIST_COLORS,
  moveInOrder,
  formatDue,
  googleCalendarLink,
  newSubtask,
  splitIntoChecklist,
  type Subtask,
  type Category,
  type Household,
  type ItemPlace,
  type ListIcon,
  type ListItem,
  type ShoppingList,
  type Urgency,
} from '../data/model';
import type { ThemeMode } from '../lib/prefs';
import { parseWhen } from '../data/when';
import { currentPosition, locationPermission } from '../lib/location';
import { hoursWarning } from '../data/hours';
import { friendlyError, type FriendlyError } from '../lib/errors';
import { ErrorNotice } from './ErrorNotice';
import { Dialog, LIST_ICONS, ListIconBadge, ghostButton, inputClass, primaryButton } from './ui';
import { SortableRows } from './SortableRows';

export function EditItemDialog({
  item,
  lists,
  onSave,
  onDelete,
  onClose,
}: {
  item: ListItem;
  lists: ShoppingList[];
  onSave: (changes: Partial<ListItem>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  // A date or time still in the name ("Cancel trial by October 4th") fills the empty date fields.
  const [readFromName] = useState(() => (item.dueAt ? null : parseWhen(item.name)));
  const [showRead, setShowRead] = useState(readFromName !== null);
  const [name, setName] = useState(readFromName?.rest ?? item.name);
  const [quantity, setQuantity] = useState(item.quantity);
  const [notes, setNotes] = useState(item.notes);
  const [category, setCategory] = useState<Category>(item.category);
  const [urgency, setUrgency] = useState<Urgency>(item.urgency);
  const [listId, setListId] = useState(item.listId);
  const [date, setDate] = useState(item.dueAt ? toDateInput(item.dueAt) : readFromName ? toDateInput(readFromName.dueAt) : '');
  const [time, setTime] = useState(
    item.dueAt && !item.allDay ? toTimeInput(item.dueAt) : readFromName && !readFromName.allDay ? toTimeInput(readFromName.dueAt) : '',
  );
  const [dueBy, setDueBy] = useState(item.dueAt ? !!item.dueBy : !!readFromName?.by);
  const [location, setLocation] = useState(item.location ?? '');
  const [place, setPlace] = useState<ItemPlace | null>(item.place ?? null);
  const [link, setLink] = useState(item.link ?? '');
  const [steps, setSteps] = useState<Subtask[]>(item.subtasks ?? []);
  const [showSteps, setShowSteps] = useState((item.subtasks ?? []).length > 0);
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<CalendarMatch[] | null>(null);
  const [calendarError, setCalendarError] = useState<FriendlyError | null>(null);

  const task = isTaskList(lists.find((l) => l.id === listId)?.icon);

  async function searchCalendar() {
    setSearching(true);
    setCalendarError(null);
    setMatches(null);
    try {
      const { auth } = await getFirebase();
      setMatches(await findCalendarEvents(auth, name));
    } catch (e) {
      setCalendarError(friendlyError(e, 'calendar'));
    } finally {
      setSearching(false);
    }
  }

  function useMatch(m: CalendarMatch) {
    setDate(toDateInput(m.start));
    setTime(m.allDay ? '' : toTimeInput(m.start));
    setDueBy(false);
    if (m.location) {
      setLocation(m.location);
      setPlace(null);
    }
    setLink(m.link);
    setMatches(null);
  }
  const [newStep, setNewStep] = useState('');
  const split = steps.length === 0 ? splitIntoChecklist(name) : null;
  const dueAt = date ? fromInputs(date, time) : null;
  // "before 6" typed into the name or notes, offered as a due time while there is none.
  const inferred = date ? null : (parseWhen(name) ?? (notes ? parseWhen(notes) : null));
  const linkValid = !link.trim() || /^https?:\/\/\S+$/i.test(link.trim());
  const listName = lists.find((l) => l.id === listId)?.name ?? '';

  function applyInferred() {
    if (!inferred) return;
    setDate(toDateInput(inferred.dueAt));
    setTime(inferred.allDay ? '' : toTimeInput(inferred.dueAt));
    setDueBy(inferred.by);
    if (parseWhen(name)) setName(inferred.rest);
    else setNotes(inferred.rest);
  }

  const whenFields = (
    <>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <label className="text-sm text-stone-500">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-sm text-stone-500">
          Time (optional)
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} className={`${inputClass} mt-1`} />
        </label>
        {date && (
          <button
            type="button"
            onClick={() => {
              setDate('');
              setTime('');
              setDueBy(false);
            }}
            className="mb-1 rounded-lg p-2 text-stone-400 hover:text-stone-700"
            aria-label="Clear date"
          >
            <X size={18} />
          </button>
        )}
      </div>
      {date && time && (
        <div className="flex gap-1.5" role="group" aria-label="Kind of time">
          {[
            { by: false, label: `At ${formatTime(time)}` },
            { by: true, label: `By ${formatTime(time)}` },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setDueBy(o.by)}
              aria-pressed={dueBy === o.by}
              className={`rounded-full border px-3 py-1 text-sm ${dueBy === o.by ? 'border-forest-700 bg-forest-700 text-white' : 'border-stone-200 dark:border-forest-600'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={() => void searchCalendar()} disabled={searching || !name.trim()} className={`${ghostButton} justify-self-start px-2 py-1 text-sm text-forest-700 dark:text-forest-300`}>
        {searching ? <Loader2 size={16} className="animate-spin" /> : <CalendarSearch size={16} />} {searching ? 'Searching your calendars…' : 'Find in my calendar'}
      </button>
      {calendarError && <ErrorNotice error={calendarError} onRetry={() => void searchCalendar()} retrying={searching} />}
      {matches && matches.length === 0 && (
        <p className="text-sm text-stone-500" role="status">
          No events matching "{name.trim()}" in your calendars from last week to a year ahead.
        </p>
      )}
      {matches && matches.length > 0 && (
        <ul className="grid gap-1.5" aria-label="Calendar matches">
          {matches.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => useMatch(m)} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-left hover:border-forest-500 hover:bg-forest-50 dark:border-forest-600 dark:hover:bg-forest-700">
                <span className="block font-medium [overflow-wrap:anywhere]">{m.title}</span>
                <span className="block text-sm text-stone-500">
                  {formatDue({ dueAt: m.start, allDay: m.allDay }, Date.now())} · {m.calendarName}
                </span>
                {m.location && (
                  <span className="block text-sm text-stone-500 [overflow-wrap:anywhere]">
                    <MapPin size={12} className="mr-0.5 inline" /> {m.location}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const whereField = (
    <WhereField
      name={name}
      value={location}
      suggest={task}
      onChange={(text) => {
        setLocation(text);
        // Typing over a chosen place means it is somewhere else now.
        if (place && !text.startsWith(place.name)) setPlace(null);
      }}
      hours={place?.hours}
      warning={hoursWarning(place?.hours, { dueAt, allDay: dueAt !== null && !time, dueBy: !!time && dueBy })}
      onPick={(p, text) => {
        setLocation(text);
        setPlace({ name: p.name, lat: p.lat, lon: p.lon, ...(p.openingHours ? { hours: p.openingHours } : {}) });
      }}
    />
  );

  const stepsFields = (
    <fieldset className="grid gap-2 rounded-2xl border border-stone-200 p-3 dark:border-forest-700">
      <legend className="px-1 text-sm text-stone-500">Steps</legend>
      {steps.map((st, i) => (
        <div key={st.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={st.done}
            onChange={() => setSteps(steps.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)))}
            className="h-4 w-4 shrink-0 accent-forest-600"
            aria-label={`Step ${i + 1} done`}
          />
          <input
            value={st.text}
            onChange={(e) => setSteps(steps.map((x) => (x.id === st.id ? { ...x, text: e.target.value } : x)))}
            className={`${inputClass} py-1.5`}
            aria-label={`Step ${i + 1}`}
          />
          <button type="button" onClick={() => setSteps(steps.filter((x) => x.id !== st.id))} className="rounded-lg p-1.5 text-stone-400 hover:text-red-600" aria-label={`Remove step ${i + 1}`}>
            <X size={16} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={newStep}
          onChange={(e) => setNewStep(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (newStep.trim()) setSteps([...steps, newSubtask(newStep)]);
              setNewStep('');
            }
          }}
          placeholder={steps.length ? 'Add another step' : 'First step'}
          className={`${inputClass} py-1.5`}
          aria-label="New step"
          autoFocus={steps.length === 0}
        />
        <button
          type="button"
          onClick={() => {
            if (newStep.trim()) setSteps([...steps, newSubtask(newStep)]);
            setNewStep('');
          }}
          disabled={!newStep.trim()}
          className={ghostButton}
          aria-label="Add step"
        >
          <Plus size={18} />
        </button>
      </div>
    </fieldset>
  );

  const quick = 'inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1.5 text-sm text-stone-700 hover:border-forest-500 dark:border-forest-600 dark:text-stone-200';

  return (
    <Dialog title={task ? 'Edit task' : 'Edit item'} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          if (!linkValid) return;
          onSave({
            name: name.trim(),
            quantity: quantity.trim() || '1',
            notes: notes.trim(),
            category,
            // A due time replaces "Need today".
            urgency: dueAt !== null && urgency === URGENCY.URGENT ? URGENCY.NORMAL : urgency,
            listId,
            dueAt,
            allDay: dueAt !== null && !time,
            dueBy: dueAt !== null && dueBy,
            location: location.trim(),
            place: location.trim() ? place : null,
            link: link.trim(),
            subtasks: steps.filter((st) => st.text.trim()),
          });
          onClose();
        }}
      >
        <label className="text-sm text-stone-500">
          {task ? 'Task' : 'Item'}
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} autoFocus />
        </label>
        {showRead && readFromName && date && (
          <p className="-mt-1 flex flex-wrap items-center gap-x-2 text-sm text-stone-600 dark:text-stone-300" role="status">
            <CalendarClock size={16} className="shrink-0 text-forest-700 dark:text-forest-300" aria-hidden />
            <span>Read “{readFromName.phrase}” from the name.</span>
            <button
              type="button"
              onClick={() => {
                setName(item.name);
                setDate('');
                setTime('');
                setDueBy(false);
                setShowRead(false);
              }}
              className="min-h-11 font-medium text-forest-700 underline underline-offset-2 dark:text-forest-300"
            >
              Undo
            </button>
          </p>
        )}
        {inferred && !showRead && (
          <button
            type="button"
            onClick={applyInferred}
            className={`${ghostButton} justify-self-start bg-forest-50 text-left text-forest-700 dark:bg-forest-700 dark:text-forest-100`}
          >
            <CalendarClock size={18} className="shrink-0" />
            <span>
              <span className="block">Due {lowerFirst(formatDue({ dueAt: inferred.dueAt, allDay: inferred.allDay, dueBy: inferred.by }, Date.now()).replace(' · ', ' '))}</span>
              <span className="block text-sm font-normal text-forest-600 dark:text-forest-200">from “{inferred.phrase}”</span>
            </span>
          </button>
        )}

        {task ? (
          <>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm text-stone-500">When</legend>
              {whenFields}
            </fieldset>
            {whereField}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-stone-500">
              Quantity
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="text-sm text-stone-500">
              Section
              <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={`${inputClass} mt-1`}>
                {ALL_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <label className="text-sm text-stone-500">
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={task ? 'Ticket number, what to bring…' : 'Brand, size, organic…'} className={`${inputClass} mt-1`} />
        </label>

        {showSteps ? (
          stepsFields
        ) : (
          <div className="flex flex-wrap gap-2">
            {split && (
              <button
                type="button"
                onClick={() => {
                  setName(split.title);
                  setSteps(split.steps.map((t) => newSubtask(t)));
                  setShowSteps(true);
                }}
                className={`${quick} border-forest-200 bg-forest-50 text-forest-700 dark:bg-forest-700 dark:text-forest-100`}
              >
                <ListChecks size={16} /> Split into {split.steps.length} steps
              </button>
            )}
            {!split && (
              <button type="button" onClick={() => setShowSteps(true)} className={quick}>
                <ListChecks size={16} /> Add steps
              </button>
            )}
            {dueAt === null && (
              <button
                type="button"
                onClick={() => setUrgency(urgency === URGENCY.URGENT ? URGENCY.NORMAL : URGENCY.URGENT)}
                aria-pressed={urgency === URGENCY.URGENT}
                className={`${quick} ${urgency === URGENCY.URGENT ? 'border-terracotta bg-terracotta-light font-semibold text-terracotta' : ''}`}
              >
                <Zap size={16} /> Need today
              </button>
            )}
          </div>
        )}

        <details className="group rounded-2xl border border-stone-200 dark:border-forest-700" open={!task && (dueAt !== null || !!location || !!link)}>
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm text-stone-600 dark:text-stone-300">
            {task ? 'List and link' : 'Date, place, list and link'}
            <ChevronDown size={16} className="transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-3 border-t border-stone-200 p-3 dark:border-forest-700">
            {!task && (
              <>
                {whenFields}
                {whereField}
              </>
            )}
            <label className="text-sm text-stone-500">
              List
              <select value={listId} onChange={(e) => setListId(e.target.value)} className={`${inputClass} mt-1`}>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-stone-500">
              Link
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Paste the Google Calendar event link"
                inputMode="url"
                className={`${inputClass} mt-1`}
                aria-invalid={!linkValid}
              />
            </label>
            {!linkValid && <p className="text-sm text-terracotta">Links start with https://</p>}
            {dueAt !== null && !link.trim() && (
              <a
                href={googleCalendarLink({ name, notes, dueAt, allDay: !time, location }, listName)}
                target="_blank"
                rel="noreferrer"
                className={`${ghostButton} justify-self-start text-forest-700 dark:text-forest-300`}
              >
                <CalendarPlus size={18} /> Add to Google Calendar
              </a>
            )}
          </div>
        </details>
        <p className="text-sm text-stone-500">Added by {item.addedBy || 'someone'}</p>
        <div className="mt-2 flex justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className={`${ghostButton} text-red-600 dark:text-red-400`}
          >
            <Trash2 size={18} /> Delete
          </button>
          <button type="submit" className={primaryButton}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Where an errand happens, with "Find nearby": the closest places of that kind ("Drycleaners
 * dropoff" → dry cleaners near you) from OpenStreetMap. Searches run only on a tap, as the
 * free service asks, and location is read only then.
 */
function WhereField({
  name,
  value,
  suggest,
  onChange,
  onPick,
  hours,
  warning,
}: {
  name: string;
  value: string;
  /** Look nearby on open when the task names a kind of place and location is already allowed. */
  suggest: boolean;
  onChange: (text: string) => void;
  onPick: (place: Place, text: string) => void;
  /** The chosen place's hours, and a note when they do not fit the due time. */
  hours?: string;
  warning?: string | null;
}) {
  const inputId = useId();
  const query = value.trim() || name.trim();
  // Google Maps searches near the device by itself and knows far more businesses than
  // OpenStreetMap; pick one there and paste or type it in.
  const mapsLink = (label: string) => (
    <a href={mapsSearchUrl(query)} target="_blank" rel="noreferrer" className="font-medium text-forest-700 underline underline-offset-2 dark:text-forest-300">
      {label}
    </a>
  );
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Drop off dry cleaning" with no place yet: show the nearest dry cleaners straight away, without
  // a prompt (only when location is already allowed; otherwise Find nearby asks on a tap).
  const auto = useRef(suggest && !value.trim() && placeKinds(name).length > 0);
  useEffect(() => {
    if (!auto.current) return;
    auto.current = false;
    void locationPermission().then((state) => {
      if (state === 'granted') void findNearby({ quiet: true });
    });
    // Once, when the editor opens.
  }, []);

  async function findNearby({ quiet = false }: { quiet?: boolean } = {}) {
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const here = await currentPosition();
      setResults(await findPlaces(query, { lat: here.lat, lon: here.lng }));
    } catch (e) {
      if (quiet) return;
      const denied = (e as GeolocationPositionError)?.code === 1;
      setError(
        denied
          ? 'Location is off for this app, so nearby places can’t be found here.'
          : e instanceof PlaceSearchUnavailable
            ? 'The free map service is busy right now.'
            : 'Couldn’t look up places right now.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="text-sm text-stone-500">
        <label htmlFor={inputId}>Where</label>
        <div className="mt-1 flex gap-2">
          <input id={inputId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Place or address" className={inputClass} />
          <button type="button" onClick={() => void findNearby()} disabled={busy || !(value.trim() || name.trim())} className={`${ghostButton} shrink-0 border border-stone-200 dark:border-forest-600`}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />} {busy ? 'Looking…' : 'Find nearby'}
          </button>
        </div>
      </div>
      {hours && (
        <p className="text-sm text-stone-600 dark:text-stone-300" role="status">
          {parseOpeningHours(hours) ? hoursToday(hours) : `Hours: ${hours}`}
        </p>
      )}
      {warning && (
        <p className="text-sm font-medium text-terracotta" role="status">
          {warning}
        </p>
      )}
      {error && (
        <p className="text-sm text-stone-600 dark:text-stone-300" role="status">
          {error} {query && mapsLink('Search Google Maps')}
        </p>
      )}
      {results && results.length === 0 && (
        <p className="text-sm text-stone-600 dark:text-stone-300" role="status">
          The free map has nothing like "{query}" near you; it misses many businesses. {mapsLink('Search Google Maps')}
        </p>
      )}
      {results && results.length > 0 && (
        <p className="sr-only" role="status">
          {results.length === 1 ? 'Found 1 place nearby' : `Found ${results.length} places nearby`}
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="grid gap-1.5" aria-label="Nearby places">
          {results.map((p) => (
            <li key={p.osmUrl}>
              <button
                type="button"
                onClick={() => {
                  onPick(p, p.address ? `${p.name}, ${p.address}` : p.name);
                  setResults(null);
                }}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-left hover:border-forest-500 hover:bg-forest-50 dark:border-forest-600 dark:hover:bg-forest-700"
              >
                <span className="block font-medium [overflow-wrap:anywhere]">{p.name}</span>
                <span className="block text-sm text-stone-500 [overflow-wrap:anywhere]">
                  {p.distanceKm !== undefined && `${formatDistance(p.distanceKm)}`}
                  {p.distanceKm !== undefined && p.address ? ' · ' : ''}
                  {p.address}
                </span>
                {p.openingHours && <span className="block text-sm text-stone-500">{hoursToday(p.openingHours)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && results.length > 0 && <p className="text-sm">{mapsLink('More in Google Maps')}</p>}
    </div>
  );
}

function findPlaces(text: string, near: { lat: number; lon: number }): Promise<Place[]> {
  if (window.__mockPlaces) return Promise.resolve(window.__mockPlaces);
  return searchPlaces(text, { near, limit: 5 });
}

declare global {
  interface Window {
    /** Browser tests stand in for OpenStreetMap, which has no emulator. */
    __mockPlaces?: Place[];
  }
}

/** "Today: 7:00 AM – 6:00 PM" or "Today: Closed" when the hours can be read; otherwise the hours as the map writes them. */
function hoursToday(hours: string): string {
  const week = parseOpeningHours(hours);
  return week ? `Today: ${describeDay(week, new Date())}` : hours;
}

/** "Today by 6:00 PM" → "today by 6:00 PM", for use mid-sentence; dates like "Tue, Jan 7" keep their case. */
function lowerFirst(text: string): string {
  return /^(Today|Tomorrow|Yesterday|By)\b/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

/** "18:00" → "6:00 PM" in the device's locale. */
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateInput(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInput(t: number): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local date and optional time from the inputs; an all-day item is stored at local midnight. */
function fromInputs(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time ? time.split(':').map(Number) : [0, 0];
  return new Date(y, m - 1, d, hh, mm).getTime();
}

export function NewListDialog({ onCreate, onClose }: { onCreate: (name: string, icon: ListIcon, color: string) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<ListIcon>('grocery');
  const [color, setColor] = useState(LIST_COLORS[0]);
  return (
    <Dialog title="New list" onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreate(name, icon, color);
          onClose();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Target, Home Depot, Weekend chores…" className={inputClass} autoFocus />
        <div>
          <p className="mb-2 text-sm text-stone-500">Icon</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LIST_ICONS) as ListIcon[]).map((i) => (
              <button
                type="button"
                key={i}
                onClick={() => setIcon(i)}
                className={`rounded-2xl p-1 ${icon === i ? 'ring-2 ring-forest-500' : ''}`}
                aria-label={i}
                aria-pressed={icon === i}
              >
                <ListIconBadge icon={i} color={color} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-stone-500">Color</p>
          <div className="flex flex-wrap gap-2">
            {LIST_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-9 w-9 rounded-full ${color === c ? 'ring-2 ring-forest-500 ring-offset-2 dark:ring-offset-forest-800' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>
        <button type="submit" disabled={!name.trim()} className={primaryButton}>
          Create list
        </button>
      </form>
    </Dialog>
  );
}

export function inviteMessage(email: string, householdName: string, url: string): string {
  return `I added you to "${householdName}" on Huishouden Tasks, our shared grocery and chores lists.\n\nOpen ${url} and sign in with Google as ${email}. Then use Chrome's menu, "Install app" (or Share, "Add to Home Screen" on iPhone) to keep it on your home screen.`;
}

/** Opens the share sheet (text, WhatsApp, email…) or, where there is none, a prefilled email. */
async function sendInvite(email: string, householdName: string): Promise<void> {
  const url = window.location.origin;
  const text = inviteMessage(email, householdName, url);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Join our household on Huishouden Tasks', text });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Join our household on Huishouden Tasks')}&body=${encodeURIComponent(text)}`;
}

export function SettingsDialog({
  household,
  myEmail,
  addedAs,
  setAddedAs,
  theme,
  setTheme,
  install,
  notifications,
  onAddMember,
  onRemoveMember,
  onClose,
}: {
  household: Household;
  myEmail: string;
  addedAs: string;
  setAddedAs: (name: string) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  install: { canInstall: boolean; installed: boolean; install: () => Promise<void> };
  /** "Notifications on this device" (the kit's NotificationsCard). */
  notifications?: React.ReactNode;
  onAddMember: (email: string) => Promise<void>;
  onRemoveMember: (email: string) => Promise<void>;
  onClose: () => void;
}) {
  const [invite, setInvite] = useState('');
  const [error, setError] = useState<FriendlyError | null>(null);
  const validInvite = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.trim());
  return (
    <Dialog title="Settings" onClose={onClose}>
      <div className="grid gap-6">
        <section>
          <h3 className="mb-1 font-semibold">{household.name}</h3>
          <p className="mb-3 text-sm text-stone-500">
            Everyone below can see and edit every list. Adding someone does not email them: send them the link, and they get in by
            signing in with the Google account you added.
          </p>
          <ul className="mb-3 grid gap-1.5">
            {household.members.map((m) => {
              const joined = m === myEmail || (household.joined ?? []).includes(m);
              return (
                <li key={m} className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 dark:bg-forest-900">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {m}
                      {m === myEmail && <span className="ml-1 text-stone-400">(you)</span>}
                    </span>
                    <span className={`text-xs ${joined ? 'text-forest-600 dark:text-forest-300' : 'text-terracotta'}`}>
                      {joined ? 'Joined' : 'Invited, not signed in yet'}
                    </span>
                  </span>
                  {!joined && (
                    <button onClick={() => void sendInvite(m, household.name)} className={`${ghostButton} text-sm`} aria-label={`Send invite to ${m}`}>
                      <Send size={16} /> Send invite
                    </button>
                  )}
                  {m !== myEmail && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${m} from the household?`)) void onRemoveMember(m);
                      }}
                      className="rounded-lg p-1.5 text-stone-400 hover:text-red-600"
                      aria-label={`Remove ${m}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validInvite) return;
              setError(null);
              const email = invite.trim().toLowerCase();
              onAddMember(email)
                .then(() => setInvite(''))
                .catch((err: unknown) => setError(friendlyError(err, 'save')));
            }}
          >
            <input type="email" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="their.gmail@gmail.com" className={inputClass} />
            <button type="submit" disabled={!validInvite} className={primaryButton} aria-label="Add member">
              <UserPlus size={18} />
            </button>
          </form>
          {error && (
            <div className="mt-2">
              <ErrorNotice error={error} />
            </div>
          )}
        </section>

        <section>
          <label className="text-sm font-semibold">
            Items added on this device are labelled
            <input value={addedAs} onChange={(e) => setAddedAs(e.target.value)} className={`${inputClass} mt-1 font-normal`} />
          </label>
          <p className="mt-1 text-sm text-stone-500">Use "Kitchen" on the shared tablet so you can tell who added what.</p>
        </section>

        {notifications}

        <section>
          <p className="mb-2 text-sm font-semibold">Appearance on this device</p>
          <div className="flex gap-2">
            {(['light', 'dark', 'auto'] as ThemeMode[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 rounded-xl border px-3 py-2 capitalize ${theme === t ? 'border-forest-600 bg-forest-50 font-semibold dark:bg-forest-700' : 'border-stone-200 dark:border-forest-600'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {!install.installed && (
          <section>
            <p className="mb-2 text-sm font-semibold">Install</p>
            {install.canInstall ? (
              <button onClick={() => void install.install()} className={primaryButton}>
                <Download size={18} /> Install Tasks on this device
              </button>
            ) : (
              <p className="text-sm text-stone-500">In Chrome, open the ⋮ menu and choose "Add to Home screen" or "Install app". On iPhone, use Share, then "Add to Home Screen".</p>
            )}
          </section>
        )}

      </div>
    </Dialog>
  );
}

export function ReorderListsDialog({ lists, onReorder, onClose }: { lists: ShoppingList[]; onReorder: (ids: string[]) => void; onClose: () => void }) {
  const ids = lists.map((l) => l.id);
  return (
    <Dialog title="Reorder lists" onClose={onClose}>
      <p className="mb-3 text-sm text-stone-500">Drag by the grip. Everyone in the household sees the new order.</p>
      <SortableRows
        ids={ids}
        label={(id) => lists.find((l) => l.id === id)?.name ?? id}
        onMove={(from, to) => onReorder(moveInOrder(ids, from, to))}
        renderRow={(id) => {
          const list = lists.find((l) => l.id === id)!;
          return (
            <>
              <ListIconBadge icon={list.icon} color={list.color} size="sm" />
              <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{list.name}</span>
            </>
          );
        }}
      />
      <button onClick={onClose} className={`${primaryButton} mt-4 w-full`}>
        Done
      </button>
    </Dialog>
  );
}
