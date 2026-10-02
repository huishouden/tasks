import { useState } from 'react';
import { CalendarPlus, CalendarSearch, Download, ListChecks, Loader2, LogOut, MapPin, Plus, Send, Trash2, UserPlus, X } from 'lucide-react';
import { findCalendarEvents, type CalendarMatch } from '../lib/calendar';
import {
  ALL_CATEGORIES,
  ALL_URGENCIES,
  LIST_COLORS,
  moveInOrder,
  formatDue,
  googleCalendarLink,
  newSubtask,
  splitIntoChecklist,
  type Subtask,
  type Category,
  type Household,
  type ListIcon,
  type ListItem,
  type ShoppingList,
  type Urgency,
} from '../data/model';
import type { ThemeMode } from '../lib/prefs';
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
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity);
  const [notes, setNotes] = useState(item.notes);
  const [category, setCategory] = useState<Category>(item.category);
  const [urgency, setUrgency] = useState<Urgency>(item.urgency);
  const [listId, setListId] = useState(item.listId);
  const [date, setDate] = useState(item.dueAt ? toDateInput(item.dueAt) : '');
  const [time, setTime] = useState(item.dueAt && !item.allDay ? toTimeInput(item.dueAt) : '');
  const [location, setLocation] = useState(item.location ?? '');
  const [link, setLink] = useState(item.link ?? '');
  const [steps, setSteps] = useState<Subtask[]>(item.subtasks ?? []);
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<CalendarMatch[] | null>(null);
  const [calendarError, setCalendarError] = useState<FriendlyError | null>(null);

  async function searchCalendar() {
    setSearching(true);
    setCalendarError(null);
    setMatches(null);
    try {
      setMatches(await findCalendarEvents(name));
    } catch (e) {
      setCalendarError(friendlyError(e, 'calendar'));
    } finally {
      setSearching(false);
    }
  }

  function useMatch(m: CalendarMatch) {
    setDate(toDateInput(m.start));
    setTime(m.allDay ? '' : toTimeInput(m.start));
    if (m.location) setLocation(m.location);
    setLink(m.link);
    setMatches(null);
  }
  const [newStep, setNewStep] = useState('');
  const split = steps.length === 0 ? splitIntoChecklist(name) : null;
  const dueAt = date ? fromInputs(date, time) : null;
  const linkValid = !link.trim() || /^https?:\/\/\S+$/i.test(link.trim());
  const listName = lists.find((l) => l.id === listId)?.name ?? '';
  return (
    <Dialog title="Edit item" onClose={onClose}>
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
            urgency,
            listId,
            dueAt,
            allDay: dueAt !== null && !time,
            location: location.trim(),
            link: link.trim(),
            subtasks: steps.filter((st) => st.text.trim()),
          });
          onClose();
        }}
      >
        <label className="text-sm text-stone-500">
          Item
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-stone-500">
            Quantity
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm text-stone-500">
            When
            <select value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)} className={`${inputClass} mt-1`}>
              {ALL_URGENCIES.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-sm text-stone-500">
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Brand, size, organic…" className={`${inputClass} mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-stone-500">
            Aisle
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={`${inputClass} mt-1`}>
              {ALL_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
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
        </div>
        {split && (
          <button
            type="button"
            onClick={() => {
              setName(split.title);
              setSteps(split.steps.map((t) => newSubtask(t)));
            }}
            className={`${ghostButton} justify-self-start bg-forest-50 text-forest-700 dark:bg-forest-700 dark:text-forest-100`}
          >
            <ListChecks size={18} /> Split into checklist: "{split.title}" with {split.steps.length} steps
          </button>
        )}
        <fieldset className="grid gap-2 rounded-2xl border border-stone-200 p-3 dark:border-forest-700">
          <legend className="px-1 text-sm text-stone-500">Checklist</legend>
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
              placeholder={steps.length ? 'Add another step' : 'Add a step to make this a checklist'}
              className={`${inputClass} py-1.5`}
              aria-label="New step"
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
        <fieldset className="grid gap-3 rounded-2xl border border-stone-200 p-3 dark:border-forest-700">
          <legend className="px-1 text-sm text-stone-500">Date or appointment</legend>
          <button type="button" onClick={() => void searchCalendar()} disabled={searching || !name.trim()} className={`${ghostButton} justify-self-start bg-forest-50 text-forest-700 dark:bg-forest-700 dark:text-forest-100`}>
            {searching ? <Loader2 size={18} className="animate-spin" /> : <CalendarSearch size={18} />} {searching ? 'Searching your calendars…' : 'Find in my calendar'}
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
                }}
                className="mb-1 rounded-lg p-2 text-stone-400 hover:text-stone-700"
                aria-label="Clear date"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <label className="text-sm text-stone-500">
            Where
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Fire station on Main St" className={`${inputClass} mt-1`} />
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
        </fieldset>
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
  onAddMember,
  onRemoveMember,
  onSignOut,
  onClose,
}: {
  household: Household;
  myEmail: string;
  addedAs: string;
  setAddedAs: (name: string) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  install: { canInstall: boolean; installed: boolean; install: () => Promise<void> };
  onAddMember: (email: string) => Promise<void>;
  onRemoveMember: (email: string) => Promise<void>;
  onSignOut: () => void;
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

        <div className="flex items-center justify-between border-t border-stone-200 pt-4 dark:border-forest-700">
          <span className="text-xs text-stone-400">
            Signed in as {myEmail} · Tasks {import.meta.env.VITE_APP_VERSION} ({import.meta.env.VITE_BUILD_SHA})
          </span>
          <button onClick={onSignOut} className={ghostButton}>
            <LogOut size={18} /> Sign out
          </button>
        </div>
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
