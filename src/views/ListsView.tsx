import { useMemo, useState, type ReactNode } from 'react';
import { ArrowUpDown, ChevronDown, Plus, Search, Share2, ShoppingCart, Trash2, X } from 'lucide-react';
import { AddBar, type AddRequest } from '../components/AddBar';
import { usePref } from '../lib/prefs';
import { RoleNote } from '@huishouden/pwa-kit/react/roles';
import { ItemRow } from '../components/ItemRow';
import { SortableItems } from '../components/SortableItems';
import { Chip, ListIconBadge, ghostButton } from '../components/ui';
import { GROCERIES_PATH, formatListForSharing, needsDoing, sortItems, type ListItem, type ShoppingList } from '../data/model';
import { TodayPanel } from '../components/TodayPanel';

interface Props {
  /** Shown above the list: Google Tasks suggestions, a nearby errand. */
  banner?: ReactNode;
  lists: ShoppingList[];
  items: ListItem[];
  selectedList: ShoppingList;
  onSelectList: (id: string) => void;
  onNewList: () => void;
  onReorderLists: () => void;
  onDeleteList: (list: ShoppingList) => void;
  onAdd: (req: AddRequest) => void;
  onToggle: (item: ListItem) => void;
  onToggleSubtask: (item: ListItem, subtaskId: string) => void;
  onEdit: (item: ListItem) => void;
  onDelete: (item: ListItem) => void;
  onClearCompleted: (items: ListItem[]) => void;
  onMove: (ordered: ListItem[], from: number, to: number) => void;
  /** Whether this person may change or delete the item: helpers and kids only their own. */
  mayChange?: (item: ListItem) => boolean;
  /** Creating, reordering and deleting lists: admins and members. */
  canSetUp?: boolean;
}

export function ListsView(props: Props) {
  const { lists, items, selectedList } = props;
  const mine = (item: ListItem) => props.mayChange?.(item) !== false;
  const setUp = props.canSetUp !== false;
  const [search, setSearch] = useState('');
  const [showDone, setShowDone] = usePref('showDone', true);
  const [shared, setShared] = useState(false);

  const listItems = useMemo(() => items.filter((i) => i.listId === selectedList.id), [items, selectedList.id]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listItems.filter(
      (i) =>
        !q || i.name.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q) || i.addedBy.toLowerCase().includes(q),
    );
  }, [listItems, search]);
  const pending = sortItems(visible.filter((i) => !i.completed));
  const done = visible.filter((i) => i.completed).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const pendingCount = (listId: string) => items.filter((i) => i.listId === listId && !i.completed).length;
  const now = Date.now();
  const today = needsDoing(items, now);

  async function share() {
    const text = formatListForSharing(selectedList.name, listItems);
    if (navigator.share) {
      try {
        await navigator.share({ title: selectedList.name, text });
        return;
      } catch {
        // Cancelled or unsupported payload; fall through to the clipboard.
      }
    }
    await navigator.clipboard.writeText(text);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  return (
    <div className="flex h-full min-h-0">
      <nav className="hidden w-72 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line p-3 md:flex" aria-label="Lists">
        {lists.map((l) => (
          <button
            key={l.id}
            onClick={() => props.onSelectList(l.id)}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
              l.id === selectedList.id ? 'bg-tint-strong' : 'hover:bg-stone-100 dark:hover:bg-forest-800'
            }`}
          >
            <ListIconBadge icon={l.icon} color={l.color} />
            <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
            {pendingCount(l.id) > 0 && <span className="text-sm text-muted">{pendingCount(l.id)}</span>}
          </button>
        ))}
        {setUp ? (
          <button onClick={props.onNewList} className={`${ghostButton} mt-2 justify-start`}>
            <Plus size={18} /> New list
          </button>
        ) : (
          <RoleNote action="change-settings" className="mt-2 px-3" />
        )}
        {setUp && lists.length > 1 && (
          <button onClick={props.onReorderLists} className={`${ghostButton} justify-start`}>
            <ArrowUpDown size={18} /> Reorder lists
          </button>
        )}
        <a href={GROCERIES_PATH} className={`${ghostButton} mt-4 justify-start text-sm text-muted`}>
          <ShoppingCart size={18} /> Shopping lists are in Groceries
        </a>
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="scrollbar-none flex gap-2 overflow-x-auto border-b border-line px-4 py-2 md:hidden">
          {lists.map((l) => (
            <Chip key={l.id} active={l.id === selectedList.id} onClick={() => props.onSelectList(l.id)}>
              {l.name}
              {pendingCount(l.id) > 0 ? ` · ${pendingCount(l.id)}` : ''}
            </Chip>
          ))}
          {setUp && <Chip onClick={props.onNewList}>+ New</Chip>}
          {setUp && lists.length > 1 && <Chip onClick={props.onReorderLists}>Reorder</Chip>}
          <a href={GROCERIES_PATH} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-sm whitespace-nowrap text-muted underline underline-offset-2">
            <ShoppingCart size={16} aria-hidden /> Shopping lists are in Groceries
          </a>
        </div>

        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:p-6">
          <TodayPanel today={today} lists={lists} now={now} onToggle={props.onToggle} onOpen={props.onEdit} onSelectList={props.onSelectList} />
          {props.banner}
          <header className="flex items-center gap-3">
            <ListIconBadge icon={selectedList.icon} color={selectedList.color} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold">{selectedList.name}</h1>
              <p className="text-sm text-muted">
                {listItems.filter((i) => !i.completed).length} to do · {listItems.filter((i) => i.completed).length} done
              </p>
            </div>
            <button onClick={() => void share()} className={ghostButton} aria-label="Share list">
              <Share2 size={20} />
              <span className="hidden sm:inline">{shared ? 'Copied' : 'Share'}</span>
            </button>
            {setUp && (
              <button
                onClick={() => {
                  if (confirm(`Delete "${selectedList.name}" and its ${listItems.length} items?`)) props.onDeleteList(selectedList);
                }}
                className={`${ghostButton} text-stone-400`}
                aria-label="Delete list"
              >
                <Trash2 size={20} />
              </button>
            )}
          </header>

          <AddBar onAdd={props.onAdd} />

          {(listItems.length > 6 || search) && (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3">
              <Search size={18} className="text-stone-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks, notes or people" className="min-w-0 flex-1 bg-transparent py-2 outline-none" />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={18} className="text-stone-400" />
                </button>
              )}
            </div>
          )}

          {pending.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
              {listItems.length === 0 ? 'Nothing here yet. Type above to add the first item.' : 'All done.'}
            </p>
          ) : (
            <SortableItems
              items={pending}
              // Moving within a filtered view has no clear place among the hidden items.
              disabled={Boolean(search.trim())}
              onMove={(from, to) => props.onMove(pending, from, to)}
              renderItem={(item, drag) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  drag={drag}
                  onToggle={() => props.onToggle(item)}
                  onToggleSubtask={(id) => props.onToggleSubtask(item, id)}
                  onEdit={mine(item) ? () => props.onEdit(item) : undefined}
                  onDelete={mine(item) ? () => props.onDelete(item) : undefined}
                />
              )}
            />
          )}

          {done.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <button onClick={() => setShowDone(!showDone)} className={`${ghostButton} -ml-3`}>
                  <ChevronDown size={18} className={showDone ? 'rotate-180' : ''} /> Done ({done.length})
                </button>
                {done.some(mine) && (
                  <button onClick={() => props.onClearCompleted(listItems.filter(mine))} className={`${ghostButton} text-sm`}>
                    Clear done
                  </button>
                )}
              </div>
              {showDone && (
                <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2">
                  {done.map((item) => (
                    <ItemRow key={item.id} item={item} onToggle={() => props.onToggle(item)} onToggleSubtask={(id) => props.onToggleSubtask(item, id)} onDelete={mine(item) ? () => props.onDelete(item) : undefined} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
