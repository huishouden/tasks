import { useState } from 'react';
import { Zap } from 'lucide-react';
import { cardClass } from '@huishouden/pwa-kit/react/ui';
import { formatDue, type ListItem, type NeedsDoing, type ShoppingList } from '../data/model';

/** How many dated rows show before "N more". */
const SHOWN = 4;

/**
 * What needs doing today, from every list, above whichever list is open: overdue and today's tasks
 * one per row (check off, or tap to open), and "Need today" items as one line per list. Nothing at
 * all when the day is clear.
 */
export function TodayPanel({
  today,
  lists,
  now,
  onToggle,
  onOpen,
  onSelectList,
}: {
  today: NeedsDoing;
  lists: ShoppingList[];
  now: number;
  onToggle: (item: ListItem) => void;
  onOpen: (item: ListItem) => void;
  onSelectList: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  const dated = [...today.overdue, ...today.today];
  const urgentByList = lists
    .map((l) => ({ list: l, names: today.urgent.filter((i) => i.listId === l.id).map((i) => i.name) }))
    .filter((g) => g.names.length > 0);
  if (dated.length === 0 && urgentByList.length === 0) return null;
  const shown = all ? dated : dated.slice(0, SHOWN);
  const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? '';

  return (
    <section aria-label="Today" className={`${cardClass} grid gap-1 p-3 sm:p-4`}>
      <h2 className="px-1 text-lg font-semibold">Today</h2>
      <div role="list" className="grid gap-0.5">
        {shown.map((item) => {
          const overdue = today.overdue.includes(item);
          return (
            <div role="listitem" key={item.id} className="flex min-h-11 items-center gap-3 rounded-xl px-1">
              <button
                onClick={() => onToggle(item)}
                aria-label={`Check off ${item.name}`}
                className="h-7 w-7 shrink-0 rounded-full border-2 border-stone-300 hover:border-forest-500 dark:border-forest-500"
              />
              <button onClick={() => onOpen(item)} className="min-w-0 flex-1 py-1 text-left">
                <span className="block truncate font-medium">{item.name}</span>
                <span className={`block truncate text-sm ${overdue ? 'font-medium text-attention' : 'text-muted'}`}>
                  {overdue ? `Overdue · ${formatDue(item, now)}` : formatDue(item, now)} · {listName(item.listId)}
                </span>
              </button>
            </div>
          );
        })}
        {dated.length > SHOWN && (
          <button onClick={() => setAll(!all)} className="min-h-11 rounded-xl px-1 text-left text-sm font-medium text-link">
            {all ? 'Show fewer' : `${dated.length - SHOWN} more due today`}
          </button>
        )}
        {urgentByList.map(({ list, names }) => (
          <button
            key={list.id}
            onClick={() => onSelectList(list.id)}
            className="flex min-h-11 items-center gap-3 rounded-xl px-1 text-left hover:bg-stone-100 dark:hover:bg-forest-700"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-attention-tint text-attention">
              <Zap size={14} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{names.join(', ')}</span>
              <span className="block text-sm text-muted">Need today · {list.name}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
