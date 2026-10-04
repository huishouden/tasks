import { useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { Ban, CalendarClock, Check, ChevronDown, ExternalLink, ListChecks, MapPin, Pencil, Trash2, Zap } from 'lucide-react';
import { mapsSearchUrl } from '@huishouden/pwa-kit/places';
import { URGENCY, formatDue, isCancelled, isOverdue, type ListItem } from '../data/model';
import { useT } from '../i18n';

interface Props {
  item: ListItem;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  large?: boolean;
  onToggleSubtask?: (subtaskId: string) => void;
  /** Present when the row can be reordered: the grip, plus what the drag library attaches to the row. */
  drag?: DragProps;
}

export interface DragProps {
  handle: ReactNode;
  rowRef: Ref<HTMLLIElement>;
  rowStyle: CSSProperties;
  dragging: boolean;
}

export function ItemRow({ item, onToggle, onEdit, onDelete, large, drag, onToggleSubtask }: Props) {
  const [expanded, setExpanded] = useState(false);
  const steps = item.subtasks ?? [];
  const stepsDone = steps.filter((st) => st.done).length;
  const t = useT();
  // A due time says more than "Need today", so the badge only shows on undated items.
  const urgent = item.urgency === URGENCY.URGENT && !item.completed && !item.dueAt;
  const now = Date.now();
  const overdue = isOverdue(item, now);
  // Cancelled reads differently from done: no strike-through, a "Cancelled" label, and ticking restores it.
  const cancelled = isCancelled(item);
  const details = [item.notes || null].filter(Boolean);
  return (
    <li
      ref={drag?.rowRef}
      style={drag?.rowStyle}
      className={`group flex min-w-0 ${drag?.dragging ? 'relative z-10 shadow-lg' : ''} items-center gap-3 rounded-2xl border bg-surface px-3 ${large ? 'py-4' : 'py-2.5'} ${
        urgent || overdue ? 'border-terracotta/60' : 'border-line'
      } ${item.completed ? 'opacity-60' : ''}`}
    >
      {drag?.handle}
      <button
        onClick={onToggle}
        aria-label={cancelled ? t('item.restore', { name: item.name }) : item.completed ? t('item.markNotDone', { name: item.name }) : t('item.markDone', { name: item.name })}
        className={`flex shrink-0 items-center justify-center rounded-full border-2 transition ${large ? 'h-10 w-10' : 'h-8 w-8'} ${
          cancelled
            ? 'border-stone-300 text-muted dark:border-forest-500'
            : item.completed
              ? 'border-forest-500 bg-forest-500 text-white'
              : 'border-stone-300 hover:border-forest-500 dark:border-forest-500'
        }`}
      >
        {cancelled ? <Ban size={large ? 20 : 16} /> : item.completed && <Check size={large ? 22 : 18} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={onEdit ?? onToggle} className="block w-full text-left">
          <span className={`${large ? 'text-xl' : 'text-base'} ${item.completed && !cancelled ? 'line-through' : ''}`}>
            <span className="font-medium [overflow-wrap:anywhere]" translate="no">{item.name}</span>
            {cancelled && (
              <span className="ml-2 inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 align-middle text-xs font-semibold text-muted dark:bg-forest-700">
                {t('item.cancelled')}
              </span>
            )}
            {urgent && (
              <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-attention-tint px-2 py-0.5 align-middle text-xs font-semibold text-attention">
                <Zap size={12} /> {t('due.today')}
              </span>
            )}
          </span>
          {(details.length > 0 || item.addedBy) && (
            <span className={`block text-muted [overflow-wrap:anywhere] ${large ? 'text-base' : 'text-sm'}`}>
              {details.join(' · ')}
              {details.length > 0 && item.addedBy ? ' · ' : ''}
              <span translate="no">{item.addedBy}</span>
            </span>
          )}
        </button>
        {steps.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={`mt-1 inline-flex items-center gap-1 rounded-full bg-tint px-2 py-0.5 font-medium text-forest-700 dark:text-forest-100 ${large ? 'text-base' : 'text-sm'}`}
          >
            <ListChecks size={14} /> {t('item.stepsDone', { done: stepsDone, total: steps.length })}
            <ChevronDown size={14} className={expanded ? 'rotate-180' : ''} />
          </button>
        )}
        {steps.length > 0 && expanded && (
          <ul className="mt-2 grid gap-1" aria-label={t('item.steps', { name: item.name })}>
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
                  <span className={`[overflow-wrap:anywhere] ${st.done ? 'text-muted line-through' : ''}`}>{st.text}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {(item.dueAt || item.location || item.link) && (
          <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 ${large ? 'text-base' : 'text-sm'}`}>
            {item.dueAt ? (
              <span className={`inline-flex items-center gap-1 font-medium ${overdue ? 'text-attention' : 'text-positive'}`}>
                <CalendarClock size={14} /> {formatDue(item, now)}
                {overdue && <span className="font-normal">{t('item.overdue')}</span>}
              </span>
            ) : null}
            {item.location && (
              <a
                href={mapsSearchUrl(item.location)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-1 text-muted underline-offset-2 hover:underline"
                aria-label={t('item.openInMaps', { place: item.location })}
              >
                <MapPin size={14} className="shrink-0" /> <span className="[overflow-wrap:anywhere]">{item.location}</span>
              </a>
            )}
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-link underline-offset-2 hover:underline"
              >
                <ExternalLink size={14} /> {/calendar\.google\.com|google\.com\/calendar/.test(item.link) ? t('item.openCalendar') : t('item.openLink')}
              </a>
            )}
          </div>
        )}
      </div>
      {onEdit && (
        <button onClick={onEdit} className="hidden shrink-0 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 sm:block dark:hover:bg-forest-700" aria-label={t('item.edit', { name: item.name })}>
          <Pencil size={18} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} className="shrink-0 rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" aria-label={t('item.delete', { name: item.name })}>
          <Trash2 size={18} />
        </button>
      )}
    </li>
  );
}
