import { useEffect, useMemo, useState } from 'react';
import { AddBar, type AddRequest } from '../components/AddBar';
import { ItemRow, aisleRowProps, type AisleProps } from '../components/ItemRow';
import { SortableItems } from '../components/SortableItems';
import { StaplesShelf } from '../components/StaplesShelf';
import { ListIconBadge } from '../components/ui';
import { CalendarClock } from 'lucide-react';
import { formatDue, isOverdue, isTaskList, sortItems, upcomingItems, type ListItem, type ShoppingList, type Staple } from '../data/model';
import { useWakeLock } from '../lib/prefs';

interface Props {
  lists: ShoppingList[];
  items: ListItem[];
  staples: Staple[];
  selectedList: ShoppingList;
  onSelectList: (id: string) => void;
  onAdd: (req: AddRequest) => void;
  onAddStaple: (s: Staple) => void;
  onToggle: (item: ListItem) => void;
  onToggleSubtask: (item: ListItem, subtaskId: string) => void;
  aisle?: AisleProps;
  onEdit: (item: ListItem) => void;
  /** Whether this person may change the item: helpers and kids only their own. */
  mayChange?: (item: ListItem) => boolean;
  onMove: (ordered: ListItem[], from: number, to: number) => void;
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Always-on kitchen tablet layout: big targets, screen kept awake. */
export function HubView(props: Props) {
  const { lists, items, staples, selectedList } = props;
  useWakeLock(true);
  const now = useClock();
  const listItems = useMemo(() => items.filter((i) => i.listId === selectedList.id), [items, selectedList.id]);
  const upcoming = upcomingItems(items, now.getTime());
  const pending = sortItems(listItems.filter((i) => !i.completed));
  const recentlyDone = listItems
    .filter((i) => i.completed && i.completedAt && now.getTime() - i.completedAt < 6 * 60 * 60 * 1000)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 5);

  return (
    <div className="grid h-full min-h-0 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="flex min-h-0 flex-col gap-5">
        <div>
          <p className="text-5xl font-light tabular-nums">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
          <p className="text-lg text-stone-500">{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {lists.map((l) => {
            const count = items.filter((i) => i.listId === l.id && !i.completed).length;
            return (
              <button
                key={l.id}
                onClick={() => props.onSelectList(l.id)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${
                  l.id === selectedList.id ? 'border-forest-600 bg-forest-100 dark:bg-forest-700' : 'border-stone-200 bg-white dark:border-forest-700 dark:bg-forest-800'
                }`}
              >
                <ListIconBadge icon={l.icon} color={l.color} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{l.name}</span>
                  <span className="text-sm text-stone-500">{count === 0 ? 'Empty' : `${count} to get`}</span>
                </span>
              </button>
            );
          })}
        </div>
        {upcoming.length > 0 && (
          <section aria-label="Coming up" className="rounded-2xl border border-stone-200 bg-white p-3 dark:border-forest-700 dark:bg-forest-800">
            <h2 className="mb-2 text-xs font-semibold tracking-wider text-stone-500 uppercase">Coming up</h2>
            <ul className="grid gap-1.5">
              {upcoming.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <button onClick={() => props.onEdit(item)} className="flex w-full items-start gap-2 text-left">
                    <CalendarClock size={18} className={`mt-0.5 shrink-0 ${isOverdue(item, now.getTime()) ? 'text-terracotta' : 'text-forest-600 dark:text-forest-300'}`} />
                    <span className="min-w-0">
                      <span className="block font-medium [overflow-wrap:anywhere]">{item.name}</span>
                      <span className={`text-sm ${isOverdue(item, now.getTime()) ? 'text-terracotta' : 'text-stone-500'}`}>
                        {formatDue(item, now.getTime())} · {lists.find((l) => l.id === item.listId)?.name}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <AddBar staples={staples} listIcon={selectedList.icon} onAdd={props.onAdd} large placeholder={`Add to ${selectedList.name}…`} />
        <div className="min-h-0 overflow-y-auto">
          <StaplesShelf staples={staples} activeItems={listItems} onAdd={props.onAddStaple} limit={18} large />
        </div>
      </section>

      <section className="flex min-h-0 flex-col rounded-3xl bg-white/70 p-4 dark:bg-forest-800/60">
        <h2 className="mb-3 text-2xl font-bold">
          {selectedList.name}
          <span className="ml-2 text-lg font-normal text-stone-500">{pending.length === 0 ? 'all caught up' : `${pending.length} to get`}</span>
        </h2>
        <div className="grid min-h-0 content-start gap-2 overflow-y-auto">
          <SortableItems
            items={pending}
            onMove={(from, to) => props.onMove(pending, from, to)}
            renderItem={(item, drag) => (
              <ItemRow key={item.id} item={item} drag={drag} large showCategory={!isTaskList(selectedList.icon)} onToggle={() => props.onToggle(item)} onToggleSubtask={(id) => props.onToggleSubtask(item, id)} {...aisleRowProps(props.aisle, item)} onEdit={props.mayChange?.(item) === false ? undefined : () => props.onEdit(item)} />
            )}
          />
          {recentlyDone.length > 0 && (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {recentlyDone.map((item) => (
                <ItemRow key={item.id} item={item} large onToggle={() => props.onToggle(item)} onToggleSubtask={(id) => props.onToggleSubtask(item, id)} {...aisleRowProps(props.aisle, item)} />
              ))}
            </ul>
          )}
        </div>
        {pending.length === 0 && recentlyDone.length === 0 && (
          <p className="m-auto max-w-sm text-center text-lg text-stone-500">Notice something running low? Add it on the left and it shows up on everyone's phone.</p>
        )}
      </section>
    </div>
  );
}
