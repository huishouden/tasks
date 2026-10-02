import { useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { CalendarClock, Check, ChevronDown, ExternalLink, ListChecks, MapPin, Pencil, Signpost, Trash2, Zap } from 'lucide-react';
import { aisleLabel } from '../data/stores';
import { URGENCY, formatDue, isOverdue, type ListItem } from '../data/model';

interface Props {
  item: ListItem;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  large?: boolean;
  showCategory?: boolean;
  onToggleSubtask?: (subtaskId: string) => void;
  /** Where this item was found at the store being shopped, if anyone recorded it. */
  aisle?: string;
  onAisle?: (aisle: string) => void;
  onDismissAisle?: () => void;
  /** Present when the row can be reordered: the grip, plus what the drag library attaches to the row. */
  drag?: DragProps;
}

/** Aisle support passed down from the app while a store is known. */
export interface AisleProps {
  aisleFor: (item: ListItem) => string | undefined;
  onAisle: (item: ListItem, aisle: string) => void;
  onDismissAisle: () => void;
}

export function aisleRowProps(aisle: AisleProps | undefined, item: ListItem): Partial<Props> {
  if (!aisle) return {};
  return {
    aisle: aisle.aisleFor(item),
    onAisle: (v: string) => aisle.onAisle(item, v),
    onDismissAisle: aisle.onDismissAisle,
  };
}

export interface DragProps {
  handle: ReactNode;
  rowRef: Ref<HTMLLIElement>;
  rowStyle: CSSProperties;
  dragging: boolean;
}

export function ItemRow({ item, onToggle, onEdit, onDelete, large, showCategory, drag, onToggleSubtask, aisle, onAisle, onDismissAisle }: Props) {
  const [editingAisle, setEditingAisle] = useState(false);
  const showAisleInput = !!onAisle && editingAisle;
  const [expanded, setExpanded] = useState(false);
  const steps = item.subtasks ?? [];
  const stepsDone = steps.filter((st) => st.done).length;
  const urgent = item.urgency === URGENCY.URGENT && !item.completed;
  const now = Date.now();
  const overdue = isOverdue(item, now);
  const details = [
    item.quantity && item.quantity !== '1' ? item.quantity : null,
    item.notes || null,
    showCategory ? item.category : null,
  ].filter(Boolean);
  return (
    <li
      ref={drag?.rowRef}
      style={drag?.rowStyle}
      className={`group flex min-w-0 ${drag?.dragging ? 'relative z-10 shadow-lg' : ''} items-center gap-3 rounded-2xl border bg-white px-3 dark:bg-forest-800 ${large ? 'py-4' : 'py-2.5'} ${
        urgent || overdue ? 'border-terracotta/60' : 'border-stone-200/80 dark:border-forest-700'
      } ${item.completed ? 'opacity-60' : ''}`}
    >
      {drag?.handle}
      <button
        onClick={onToggle}
        aria-label={item.completed ? `Mark ${item.name} not done` : `Mark ${item.name} done`}
        className={`flex shrink-0 items-center justify-center rounded-full border-2 transition ${large ? 'h-10 w-10' : 'h-8 w-8'} ${
          item.completed
            ? 'border-forest-500 bg-forest-500 text-white'
            : 'border-stone-300 hover:border-forest-500 dark:border-forest-500'
        }`}
      >
        {item.completed && <Check size={large ? 22 : 18} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={onEdit ?? onToggle} className="block w-full text-left">
          <span className={`${large ? 'text-xl' : 'text-base'} ${item.completed ? 'line-through' : ''}`}>
            <span className="font-medium [overflow-wrap:anywhere]">{item.name}</span>
            {urgent && (
              <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-terracotta-light px-2 py-0.5 align-middle text-xs font-semibold text-terracotta">
                <Zap size={12} /> Today
              </span>
            )}
          </span>
          {(details.length > 0 || item.addedBy) && (
            <span className={`block text-stone-500 [overflow-wrap:anywhere] dark:text-stone-400 ${large ? 'text-base' : 'text-sm'}`}>
              {details.join(' · ')}
              {details.length > 0 && item.addedBy ? ' · ' : ''}
              {item.addedBy}
            </span>
          )}
        </button>
        {steps.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={`mt-1 inline-flex items-center gap-1 rounded-full bg-forest-50 px-2 py-0.5 font-medium text-forest-700 dark:bg-forest-700 dark:text-forest-100 ${large ? 'text-base' : 'text-sm'}`}
          >
            <ListChecks size={14} /> {stepsDone} of {steps.length} done
            <ChevronDown size={14} className={expanded ? 'rotate-180' : ''} />
          </button>
        )}
        {steps.length > 0 && expanded && (
          <ul className="mt-2 grid gap-1" aria-label={`Steps for ${item.name}`}>
            {steps.map((st) => (
              <li key={st.id}>
                <label className={`flex cursor-pointer items-start gap-2 ${large ? 'text-lg' : 'text-sm'}`}>
                  <input
                    type="checkbox"
                    checked={st.done}
                    onChange={() => onToggleSubtask?.(st.id)}
                    disabled={!onToggleSubtask}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-forest-600"
                  />
                  <span className={`[overflow-wrap:anywhere] ${st.done ? 'text-stone-400 line-through' : ''}`}>{st.text}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {aisle && onAisle && !showAisleInput && (
          <button
            onClick={() => setEditingAisle(true)}
            className={`mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 ${large ? 'text-base' : 'text-sm'}`}
            aria-label={`${aisleLabel(aisle)}. Change where ${item.name} is`}
          >
            <Signpost size={14} /> {aisleLabel(aisle)}
          </button>
        )}
        {showAisleInput && (
          <AisleInput
            itemName={item.name}
            initial={aisle ?? ''}
            correcting
            onSave={(v) => {
              onAisle?.(v);
              setEditingAisle(false);
            }}
            onCancel={() => {
              setEditingAisle(false);
              onDismissAisle?.();
            }}
          />
        )}
        {(item.dueAt || item.location || item.link) && (
          <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 ${large ? 'text-base' : 'text-sm'}`}>
            {item.dueAt ? (
              <span className={`inline-flex items-center gap-1 font-medium ${overdue ? 'text-terracotta' : 'text-forest-600 dark:text-forest-300'}`}>
                <CalendarClock size={14} /> {formatDue(item, now)}
                {overdue && <span className="font-normal">(overdue)</span>}
              </span>
            ) : null}
            {item.location && (
              <span className="inline-flex min-w-0 items-center gap-1 text-stone-500 dark:text-stone-400">
                <MapPin size={14} className="shrink-0" /> <span className="[overflow-wrap:anywhere]">{item.location}</span>
              </span>
            )}
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-forest-700 underline-offset-2 hover:underline dark:text-forest-300"
              >
                <ExternalLink size={14} /> {/calendar\.google\.com|google\.com\/calendar/.test(item.link) ? 'Open in Calendar' : 'Open link'}
              </a>
            )}
          </div>
        )}
      </div>
      {onEdit && (
        <button onClick={onEdit} className="hidden shrink-0 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 sm:block dark:hover:bg-forest-700" aria-label={`Edit ${item.name}`}>
          <Pencil size={18} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} className="shrink-0 rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" aria-label={`Delete ${item.name}`}>
          <Trash2 size={18} />
        </button>
      )}
    </li>
  );
}

function AisleInput({ itemName, initial, correcting, onSave, onCancel }: { itemName: string; initial: string; correcting: boolean; onSave: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="mt-1.5 flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <Signpost size={14} className="shrink-0 text-amber-600" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={correcting ? 'Found it in…' : 'Aisle? e.g. 12'}
        aria-label={correcting ? `Where ${itemName} actually was` : `Aisle for ${itemName}`}
        inputMode="text"
        enterKeyHint="done"
        maxLength={24}
        className="w-28 min-w-0 rounded-lg border border-amber-200 bg-white px-2 py-1 text-sm outline-none focus:border-amber-500 dark:border-amber-800 dark:bg-forest-900"
      />
      <button type="submit" disabled={!value.trim() && !correcting} className="rounded-lg bg-amber-100 px-2 py-1 text-sm font-medium text-amber-900 disabled:opacity-40 dark:bg-amber-900/50 dark:text-amber-100">
        Save
      </button>
      <button type="button" onClick={onCancel} className="rounded-lg px-1.5 py-1 text-sm text-stone-400 hover:text-stone-600">
        Cancel
      </button>
    </form>
  );
}
