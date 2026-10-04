import { can, householdRole, roleLabel, type Role } from '@huishouden/pwa-kit/roles';
import { RoleNote, RoleSelect } from '@huishouden/pwa-kit/react/roles';
import { useEffect, useId, useRef, useState } from 'react';
import { Ban, CalendarClock, CalendarSearch, ChevronDown, Download, House, ListChecks, Loader2, LocateFixed, MapPin, Plus, Send, Trash2, UserPlus, X, Zap } from 'lucide-react';
import { describeDay, parseOpeningHours } from '@huishouden/pwa-kit/hours';
import { PlaceSearchUnavailable, formatDistance, mapsSearchUrl, placeKinds, searchPlaces, type Place } from '@huishouden/pwa-kit/places';
import { findCalendarEvents, type CalendarMatch } from '@huishouden/pwa-kit/calendar';
import { AddToCalendar } from '@huishouden/pwa-kit/react/calendar';
import { itemUrl } from '../data/publish';
import { getFirebase } from '../lib/firebase';
import {
  URGENCY,
  LIST_COLORS,
  moveInOrder,
  formatDue,
  calendarEntry,
  listName as shownName,
  newSubtask,
  splitIntoChecklist,
  type Subtask,
  type Household,
  type ItemPlace,
  type ListIcon,
  type ListItem,
  type ShoppingList,
  type Urgency,
} from '../data/model';
import { parseWhen } from '../data/when';
import { LocationOff, locationPermission, searchCentre, type SearchCentre } from '../lib/location';
import { getHome } from '@huishouden/pwa-kit/home';
import { richT } from '../lib/rich';
import { hoursWarning } from '../data/hours';
import { friendlyError, type FriendlyError } from '../lib/errors';
import { ErrorNotice } from './ErrorNotice';
import { Dialog, ListIconBadge, ghostButton, inputClass, primaryButton } from './ui';
import { SortableRows } from './SortableRows';
import { t, useT } from '../i18n';
import { getLocale } from '@huishouden/pwa-kit/i18n';
import { formatTime as formatClock } from '@huishouden/pwa-kit/time';

export function EditItemDialog({
  item,
  lists,
  onSave,
  onDelete,
  onCancel,
  onClose,
}: {
  item: ListItem;
  lists: ShoppingList[];
  onSave: (changes: Partial<ListItem>) => void;
  onDelete: () => void;
  /** Closes an open item as not needed (it moves to Done marked "Cancelled"). */
  onCancel?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  // A date or time still in the name ("Cancel trial by October 4th") fills the empty date fields.
  const [readFromName] = useState(() => (item.dueAt ? null : parseWhen(item.name)));
  const [showRead, setShowRead] = useState(readFromName !== null);
  const [name, setName] = useState(readFromName?.rest ?? item.name);
  const [notes, setNotes] = useState(item.notes);
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
  const currentList = lists.find((l) => l.id === listId);
  const listName = currentList ? shownName(currentList) : '';

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
        <label className="text-sm text-muted">
          {t('common.date')}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-sm text-muted">
          {t('edit.timeOptional')}
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
            aria-label={t('edit.clearDate')}
          >
            <X size={18} />
          </button>
        )}
      </div>
      {date && time && (
        <div className="flex gap-1.5" role="group" aria-label={t('edit.kindOfTime')}>
          {[
            { by: false, label: t('publish.atTime', { time: formatTime(time) }) },
            { by: true, label: t('publish.byTime', { time: formatTime(time) }) },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setDueBy(o.by)}
              aria-pressed={dueBy === o.by}
              className={`rounded-full border px-3 py-1 text-sm ${dueBy === o.by ? 'border-forest-700 bg-primary text-on-primary dark:border-forest-400' : 'border-stone-200 dark:border-forest-600'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={() => void searchCalendar()} disabled={searching || !name.trim()} className={`${ghostButton} justify-self-start px-2 py-1 text-sm text-link`}>
        {searching ? <Loader2 size={16} className="animate-spin" /> : <CalendarSearch size={16} />} {searching ? t('edit.searchingCalendars') : t('edit.findInCalendar')}
      </button>
      {calendarError && <ErrorNotice error={calendarError} onRetry={() => void searchCalendar()} retrying={searching} />}
      {matches && matches.length === 0 && (
        <p className="text-sm text-muted" role="status">
          {t('edit.noEvents', { query: name.trim() })}
        </p>
      )}
      {matches && matches.length > 0 && (
        <ul className="grid gap-1.5" aria-label={t('edit.calendarMatches')}>
          {matches.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => useMatch(m)} className="w-full rounded-xl border border-line px-3 py-2 text-left hover:border-forest-500 hover:bg-tint">
                <span className="block font-medium [overflow-wrap:anywhere]">{m.title}</span>
                <span className="block text-sm text-muted">
                  {formatDue({ dueAt: m.start, allDay: m.allDay }, Date.now())} · {m.calendarName}
                </span>
                {m.location && (
                  <span className="block text-sm text-muted [overflow-wrap:anywhere]">
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
      suggest
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
    <fieldset className="grid gap-2 rounded-2xl border border-line p-3">
      <legend className="px-1 text-sm text-muted">{t('edit.steps')}</legend>
      {steps.map((st, i) => (
        <div key={st.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={st.done}
            onChange={() => setSteps(steps.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)))}
            className="h-4 w-4 shrink-0 accent-forest-600"
            aria-label={t('edit.stepDone', { n: i + 1 })}
          />
          <input
            value={st.text}
            onChange={(e) => setSteps(steps.map((x) => (x.id === st.id ? { ...x, text: e.target.value } : x)))}
            className={`${inputClass} py-1.5`}
            aria-label={t('edit.step', { n: i + 1 })}
          />
          <button type="button" onClick={() => setSteps(steps.filter((x) => x.id !== st.id))} className="rounded-lg p-1.5 text-stone-400 hover:text-red-600" aria-label={t('edit.removeStep', { n: i + 1 })}>
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
          placeholder={steps.length ? t('edit.anotherStep') : t('edit.firstStep')}
          className={`${inputClass} py-1.5`}
          aria-label={t('edit.newStep')}
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
          aria-label={t('edit.addStep')}
        >
          <Plus size={18} />
        </button>
      </div>
    </fieldset>
  );

  const quick = 'inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-forest-500';

  return (
    <Dialog title={t('edit.title')} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          if (!linkValid) return;
          onSave({
            name: name.trim(),
            notes: notes.trim(),
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
        <label className="text-sm text-muted">
          {t('edit.task')}
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} autoFocus />
        </label>
        {showRead && readFromName && date && (
          <p className="-mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted" role="status">
            <CalendarClock size={16} className="shrink-0 text-link" aria-hidden />
            <span>{t('edit.readFromName', { phrase: readFromName.phrase })}</span>
            <button
              type="button"
              onClick={() => {
                setName(item.name);
                setDate('');
                setTime('');
                setDueBy(false);
                setShowRead(false);
              }}
              className="min-h-11 font-medium text-link underline underline-offset-2"
            >
              {t('common.undo')}
            </button>
          </p>
        )}
        {inferred && !showRead && (
          <button
            type="button"
            onClick={applyInferred}
            className={`${ghostButton} justify-self-start bg-tint text-left text-forest-700 dark:text-forest-100`}
          >
            <CalendarClock size={18} className="shrink-0" />
            <span>
              <span className="block">{t('edit.dueInferred', { due: lowerFirst(formatDue({ dueAt: inferred.dueAt, allDay: inferred.allDay, dueBy: inferred.by }, Date.now()).replace(' · ', ' ')) })}</span>
              <span className="block text-sm font-normal text-forest-600 dark:text-forest-200">{t('edit.fromPhrase', { phrase: inferred.phrase })}</span>
            </span>
          </button>
        )}

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm text-muted">{t('item.when')}</legend>
          {whenFields}
        </fieldset>
        {whereField}

        <label className="text-sm text-muted">
          {t('common.notes')}
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('add.notesPlaceholder')} className={`${inputClass} mt-1`} />
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
                  setSteps(split.steps.map((text) => newSubtask(text)));
                  setShowSteps(true);
                }}
                className={`${quick} border-forest-200 bg-tint text-forest-700 dark:text-forest-100`}
              >
                <ListChecks size={16} /> {t('edit.split', { count: split.steps.length })}
              </button>
            )}
            {!split && (
              <button type="button" onClick={() => setShowSteps(true)} className={quick}>
                <ListChecks size={16} /> {t('edit.addSteps')}
              </button>
            )}
            {dueAt === null && (
              <button
                type="button"
                onClick={() => setUrgency(urgency === URGENCY.URGENT ? URGENCY.NORMAL : URGENCY.URGENT)}
                aria-pressed={urgency === URGENCY.URGENT}
                className={`${quick} ${urgency === URGENCY.URGENT ? 'border-terracotta bg-attention-tint font-semibold text-attention' : ''}`}
              >
                <Zap size={16} /> {t('item.needToday')}
              </button>
            )}
          </div>
        )}

        <details className="group rounded-2xl border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm text-muted">
            {t('edit.listAndLink')}
            <ChevronDown size={16} className="transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-3 border-t border-line p-3">
            <label className="text-sm text-muted">
              {t('item.list')}
              <select value={listId} onChange={(e) => setListId(e.target.value)} className={`${inputClass} mt-1`}>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {shownName(l)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-muted">
              {t('edit.link')}
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={t('edit.linkPlaceholder')}
                inputMode="url"
                className={`${inputClass} mt-1`}
                aria-invalid={!linkValid}
              />
            </label>
            {!linkValid && <p className="text-sm text-attention">{t('edit.linkInvalid')}</p>}
            {dueAt !== null && !link.trim() && (
              <AddToCalendar className="justify-self-start" entry={calendarEntry({ name, notes, dueAt, allDay: !time, dueBy: !!time && dueBy, location }, listName, itemUrl(item))!} />
            )}
          </div>
        </details>
        <p className="text-sm text-muted">{item.addedBy ? t('item.addedBy', { name: item.addedBy }) : t('item.addedBySomeone')}</p>
        {/* Labels stay on one line ("Taak annuleren"): on a narrow phone the buttons share rows and grow to fill them. */}
        <div className="mt-2 flex flex-wrap items-center gap-2 [&>*]:whitespace-nowrap max-sm:[&>*]:grow">
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className={`${ghostButton} text-red-600 dark:text-red-400`}
          >
            <Trash2 size={18} /> {t('common.delete')}
          </button>
          {onCancel && !item.completed && (
            <button
              type="button"
              onClick={() => {
                onCancel();
                onClose();
              }}
              className={`${ghostButton} mr-auto`}
            >
              <Ban size={18} /> {t('edit.cancelTask')}
            </button>
          )}
          <button type="submit" className={`${primaryButton} ml-auto`}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Where an errand happens, with "Find nearby": the closest places of that kind ("Drycleaners
 * dropoff" → dry cleaners near you) from OpenStreetMap. Searches run only on a tap, as the
 * free service asks, and location is read only then. Without location allowed, it searches near
 * the household's home (set in the portal) and says so, with "Use my location" one tap away.
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
  const t = useT();
  const inputId = useId();
  const query = value.trim() || name.trim();
  // Google Maps searches near the device by itself and knows far more businesses than
  // OpenStreetMap; pick one there and paste or type it in.
  const mapsLink = (label: string) => (
    <a href={mapsSearchUrl(query)} target="_blank" rel="noreferrer" className="font-medium text-link underline underline-offset-2">
      {label}
    </a>
  );
  const [results, setResults] = useState<Place[] | null>(null);
  const [centre, setCentre] = useState<SearchCentre | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noHome, setNoHome] = useState(false);

  // "Drop off dry cleaning" with no place yet: show the nearest dry cleaners straight away, without
  // a prompt (when location is already allowed, or near home; otherwise Find nearby asks on a tap).
  const auto = useRef(suggest && !value.trim() && placeKinds(name).length > 0);
  useEffect(() => {
    if (!auto.current) return;
    auto.current = false;
    void locationPermission().then((state) => {
      if (state === 'granted' || getHome()) void findNearby({ quiet: true });
    });
    // Once, when the editor opens.
  }, []);

  async function findNearby({ quiet = false, ask = false }: { quiet?: boolean; ask?: boolean } = {}) {
    setBusy(true);
    setError(null);
    setNoHome(false);
    setResults(null);
    try {
      const from = await searchCentre({ ask });
      setCentre(from);
      setResults(await findPlaces(query, from.point));
    } catch (e) {
      if (quiet) return;
      const off = e instanceof LocationOff || (e as GeolocationPositionError)?.code === 1;
      setNoHome(off);
      setError(off ? t('where.locationOff') : e instanceof PlaceSearchUnavailable ? t('where.mapBusy') : t('where.lookupFailed'));
    } finally {
      setBusy(false);
    }
  }

  const nearHome = centre?.from === 'home';

  return (
    <div className="grid gap-2">
      <div className="text-sm text-muted">
        <label htmlFor={inputId}>{t('where.label')}</label>
        <div className="mt-1 flex gap-2">
          <input id={inputId} value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('where.placeholder')} className={inputClass} />
          <button type="button" onClick={() => void findNearby()} disabled={busy || !(value.trim() || name.trim())} className={`${ghostButton} shrink-0 border border-line`}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />} {busy ? t('where.looking') : t('where.findNearby')}
          </button>
        </div>
      </div>
      {hours && (
        <p className="text-sm text-muted" role="status">
          {parseOpeningHours(hours) ? hoursToday(hours) : t('where.hours', { hours })}
        </p>
      )}
      {warning && (
        <p className="text-sm font-medium text-attention" role="status">
          {warning}
        </p>
      )}
      {error && (
        <p className="text-sm text-muted" role="status">
          {error} {query && mapsLink(t('where.searchMaps'))}
        </p>
      )}
      {noHome && (
        <p className="text-sm text-muted">
          {richT('where.setHome', {
            portal: (
              // i18n-ignore: the suite's name
              <a href="/#household" className="font-medium text-link underline underline-offset-2">
                Huishouden
              </a>
            ),
          })}
        </p>
      )}
      {results && centre && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted" data-testid="search-centre">
          <span className="inline-flex items-center gap-1 font-medium">
            {nearHome ? <House size={16} aria-hidden="true" /> : <LocateFixed size={16} aria-hidden="true" />}
            {nearHome ? t('where.nearHome') : t('where.nearYou')}
          </span>
          {nearHome && centre.canAsk && (
            <button type="button" onClick={() => void findNearby({ ask: true })} disabled={busy} className="font-medium text-link underline underline-offset-2">
              {t('where.useMyLocation')}
            </button>
          )}
        </p>
      )}
      {results && results.length === 0 && (
        <p className="text-sm text-muted" role="status">
          {nearHome ? t('where.nothingNearHome', { query }) : t('where.nothing', { query })} {mapsLink(t('where.searchMaps'))}
        </p>
      )}
      {results && results.length > 0 && (
        <p className="sr-only" role="status">
          {t('where.found', { count: results.length })}
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="grid gap-1.5" aria-label={t('where.nearbyPlaces')}>
          {results.map((p) => (
            <li key={p.osmUrl}>
              <button
                type="button"
                onClick={() => {
                  onPick(p, p.address ? `${p.name}, ${p.address}` : p.name);
                  setResults(null);
                }}
                className="w-full rounded-xl border border-line px-3 py-2 text-left hover:border-forest-500 hover:bg-tint"
              >
                <span className="block font-medium [overflow-wrap:anywhere]">{p.name}</span>
                <span className="block text-sm text-muted [overflow-wrap:anywhere]">
                  {p.distanceKm !== undefined && `${formatDistance(p.distanceKm)}`}
                  {p.distanceKm !== undefined && p.address ? ' · ' : ''}
                  {p.address}
                </span>
                {p.openingHours && <span className="block text-sm text-muted">{hoursToday(p.openingHours)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && results.length > 0 && <p className="text-sm">{mapsLink(t('where.moreInMaps'))}</p>}
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
  return week ? t('where.today', { hours: describeDay(week, new Date()) }) : hours;
}

/** "Today by 6:00 PM" → "today by 6:00 PM", for use mid-sentence; dates like "Tue, Jan 7" keep their case. */
function lowerFirst(text: string): string {
  const words = [t('due.today'), t('due.tomorrow'), t('due.yesterday'), t('due.by', { date: '' }).trim()];
  return words.some((w) => w && text.startsWith(w)) ? text[0].toLocaleLowerCase(getLocale()) + text.slice(1) : text;
}

/** "18:00" → "6:00 PM" ("18:00", "6:00 p.m.") in the active locale. */
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return formatClock(new Date(2000, 0, 1, h, m).getTime());
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

/** Tasks makes to-do lists; shopping lists are made in Groceries. */
const TASK_LIST_ICONS: ListIcon[] = ['chores', 'notes'];

export function NewListDialog({ onCreate, onClose }: { onCreate: (name: string, icon: ListIcon, color: string) => void; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<ListIcon>('chores');
  const [color, setColor] = useState(LIST_COLORS[0]);
  return (
    <Dialog title={t('lists.new')} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreate(name, icon, color);
          onClose();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('newList.placeholder')} className={inputClass} autoFocus aria-label={t('newList.name')} />
        <div>
          <p className="mb-2 text-sm text-muted">{t('newList.icon')}</p>
          <div className="flex flex-wrap gap-2">
            {TASK_LIST_ICONS.map((i) => (
              <button
                type="button"
                key={i}
                onClick={() => setIcon(i)}
                className={`rounded-2xl p-1 ${icon === i ? 'ring-2 ring-forest-500' : ''}`}
                aria-label={t(ICON_KEYS[i])}
                aria-pressed={icon === i}
              >
                <ListIconBadge icon={i} color={color} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-muted">{t('newList.color')}</p>
          <div className="flex flex-wrap gap-2">
            {LIST_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-9 w-9 rounded-full ${color === c ? 'ring-2 ring-forest-500 ring-offset-2 dark:ring-offset-forest-800' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={t('newList.colorOption', { color: c })}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>
        <button type="submit" disabled={!name.trim()} className={primaryButton}>
          {t('newList.create')}
        </button>
      </form>
    </Dialog>
  );
}

const ICON_KEYS = { grocery: 'icon.grocery', pantry: 'icon.pantry', bulk: 'icon.bulk', hardware: 'icon.hardware', notes: 'icon.notes', chores: 'icon.chores' } as const satisfies Record<ListIcon, string>;

/** The invitation text, in the inviter's language (they choose who to send it to). */
export function inviteMessage(email: string, householdName: string, url: string): string {
  return t('invite.message', { household: householdName, url, email });
}

/** Opens the share sheet (text, WhatsApp, email…) or, where there is none, a prefilled email. */
async function sendInvite(email: string, householdName: string): Promise<void> {
  const url = window.location.origin;
  const text = inviteMessage(email, householdName, url);
  if (navigator.share) {
    try {
      await navigator.share({ title: t('invite.subject'), text });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(t('invite.subject'))}&body=${encodeURIComponent(text)}`;
}

export function SettingsDialog({
  household,
  myEmail,
  addedAs,
  setAddedAs,
  install,
  notifications,
  googleTasks,
  onAddMember,
  onRemoveMember,
  onSetRole,
  onClose,
}: {
  household: Household;
  myEmail: string;
  addedAs: string;
  setAddedAs: (name: string) => void;
  install: { canInstall: boolean; installed: boolean; install: () => Promise<void> };
  /** "Notifications on this device" (the kit's NotificationsCard). */
  notifications?: React.ReactNode;
  /** Google Tasks into lists (GoogleTasksSettings). */
  googleTasks?: React.ReactNode;
  onAddMember: (email: string, role: Role) => Promise<void>;
  onRemoveMember: (email: string) => Promise<void>;
  onSetRole: (email: string, role: Role) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const [invite, setInvite] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const myRole = householdRole(household, myEmail);
  const admin = can(myRole, 'manage-people');
  const [error, setError] = useState<FriendlyError | null>(null);
  const validInvite = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.trim());
  return (
    <Dialog title={t('settings.title')} onClose={onClose}>
      <div className="grid gap-6">
        <section>
          <h3 className="mb-1 font-semibold" translate="no">{household.name}</h3>
          <p className="mb-3 text-sm text-muted">{t('settings.membersHint')}</p>
          <ul className="mb-3 grid gap-1.5">
            {household.members.map((m) => {
              const joined = m === myEmail || (household.joined ?? []).includes(m);
              return (
                <li key={m} className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      <span translate="no">{m}</span>
                      {m === myEmail && <span className="ml-1 text-muted">{t('settings.you')}</span>}
                    </span>
                    <span className={`text-xs ${joined ? 'text-positive' : 'text-attention'}`}>
                      {joined ? t('settings.joined') : t('settings.invited')}
                    </span>
                    {!(admin && m !== myEmail) && <span className="text-xs text-muted"> · {roleLabel(householdRole(household, m) ?? 'member')}</span>}
                  </span>
                  {admin && m !== myEmail && (
                    <RoleSelect
                      value={householdRole(household, m) ?? 'member'}
                      label={t('settings.roleFor', { email: m })}
                      onChange={(next) => void onSetRole(m, next).catch((err: unknown) => setError(friendlyError(err, 'save')))}
                    />
                  )}
                  {!joined && (
                    <button onClick={() => void sendInvite(m, household.name)} className={`${ghostButton} text-sm`} aria-label={t('settings.sendInviteTo', { email: m })}>
                      <Send size={16} /> {t('settings.sendInvite')}
                    </button>
                  )}
                  {admin && m !== myEmail && (
                    <button
                      onClick={() => {
                        if (confirm(t('settings.removeConfirm', { email: m }))) void onRemoveMember(m).catch((err: unknown) => setError(friendlyError(err, 'save')));
                      }}
                      className="rounded-lg p-1.5 text-stone-400 hover:text-red-600"
                      aria-label={t('settings.remove', { email: m })}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {!admin && <RoleNote action="manage-people" />}
          {admin && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validInvite) return;
              setError(null);
              const email = invite.trim().toLowerCase();
              onAddMember(email, inviteRole)
                .then(() => {
                  setInvite('');
                  setInviteRole('member');
                })
                .catch((err: unknown) => setError(friendlyError(err, 'save')));
            }}
          >
            <input type="email" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder={t('settings.inviteEmail')} className={inputClass} aria-label={t('settings.inviteEmail')} />
            <RoleSelect value={inviteRole} label={t('settings.theirRole')} onChange={setInviteRole} />
            <button type="submit" disabled={!validInvite} className={primaryButton} aria-label={t('settings.addMember')}>
              <UserPlus size={18} />
            </button>
          </form>
          )}
          {error && (
            <div className="mt-2">
              <ErrorNotice error={error} />
            </div>
          )}
        </section>

        <section>
          <label className="text-sm font-semibold">
            {t('settings.addedAs')}
            <input value={addedAs} onChange={(e) => setAddedAs(e.target.value)} className={`${inputClass} mt-1 font-normal`} />
          </label>
          <p className="mt-1 text-sm text-muted">{t('settings.addedAsHint')}</p>
        </section>

        {notifications}

        {googleTasks}


        {!install.installed && (
          <section>
            <p className="mb-2 text-sm font-semibold">{t('settings.install')}</p>
            {install.canInstall ? (
              <button onClick={() => void install.install()} className={primaryButton}>
                <Download size={18} /> {t('settings.installButton')}
              </button>
            ) : (
              <p className="text-sm text-muted">{t('settings.installHint')}</p>
            )}
          </section>
        )}

      </div>
    </Dialog>
  );
}

export function ReorderListsDialog({ lists, onReorder, onClose }: { lists: ShoppingList[]; onReorder: (ids: string[]) => void; onClose: () => void }) {
  const t = useT();
  const ids = lists.map((l) => l.id);
  return (
    <Dialog title={t('lists.reorder')} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">{t('reorder.hint')}</p>
      <SortableRows
        ids={ids}
        label={(id) => {
          const list = lists.find((l) => l.id === id);
          return list ? shownName(list) : id;
        }}
        onMove={(from, to) => onReorder(moveInOrder(ids, from, to))}
        renderRow={(id) => {
          const list = lists.find((l) => l.id === id)!;
          return (
            <>
              <ListIconBadge icon={list.icon} color={list.color} size="sm" />
              <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{shownName(list)}</span>
            </>
          );
        }}
      />
      <button onClick={onClose} className={`${primaryButton} mt-4 w-full`}>
        {t('common.done')}
      </button>
    </Dialog>
  );
}
