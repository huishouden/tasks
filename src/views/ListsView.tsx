import { useMemo, useState, type ReactNode } from 'react';
import { ArrowUpDown, ChevronDown, Plus, Search, Share2, Trash2, X } from 'lucide-react';
import { AddBar, type AddRequest } from '../components/AddBar';
import { usePref } from '../lib/prefs';
import { ItemRow, aisleRowProps, type AisleProps } from '../components/ItemRow';
import { SortableItems } from '../components/SortableItems';
import { StaplesShelf } from '../components/StaplesShelf';
import { Chip, ListIconBadge, ghostButton } from '../components/ui';
import { AISLE_ORDER, formatListForSharing, sortItems, type ListItem, type ShoppingList, type Staple } from '../data/model';

interface Props {
  /** The shopping banner (detected store, or the store being shopped), shown above the list. */
  banner?: ReactNode;
  lists: ShoppingList[];
  items: ListItem[];
  staples: Staple[];
  selectedList: ShoppingList;
  onSelectList: (id: string) => void;
  onNewList: () => void;
  onReorderLists: () => void;
  onDeleteList: (list: ShoppingList) => void;
  onAdd: (req: AddRequest) => void;
  onAddStaple: (s: Staple) => void;
  onToggle: (item: ListItem) => void;
  onToggleSubtask: (item: ListItem, subtaskId: string) => void;
  aisle?: AisleProps;
  onEdit: (item: ListItem) => void;
  onDelete: (item: ListItem) => void;
  onClearCompleted: (items: ListItem[]) => void;
  onMove: (ordered: ListItem[], from: number, to: number) => void;
}

export function ListsView(props: Props) {
  const { lists, items, staples, selectedList } = props;
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showDone, setShowDone] = usePref('showDone', true);
  const [shared, setShared] = useState(false);

  const listItems = useMemo(() => items.filter((i) => i.listId === selectedList.id), [items, selectedList.id]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listItems.filter(
      (i) =>
        (!filter || i.category === filter) &&
        (!q || i.name.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q) || i.addedBy.toLowerCase().includes(q)),
    );
  }, [listItems, filter, search]);
  const pending = sortItems(visible.filter((i) => !i.completed));
  const done = visible.filter((i) => i.completed).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const categoryCounts = AISLE_ORDER.map((c) => [c, listItems.filter((i) => !i.completed && i.category === c).length] as const).filter(
    ([, n]) => n > 0,
  );
  const pendingCount = (listId: string) => items.filter((i) => i.listId === listId && !i.completed).length;

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
      <nav className="hidden w-72 shrink-0 flex-col gap-1 overflow-y-auto border-r border-stone-200 p-3 md:flex dark:border-forest-700" aria-label="Lists">
        {lists.map((l) => (
          <button
            key={l.id}
            onClick={() => props.onSelectList(l.id)}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
              l.id === selectedList.id ? 'bg-forest-100 dark:bg-forest-700' : 'hover:bg-stone-100 dark:hover:bg-forest-800'
            }`}
          >
            <ListIconBadge icon={l.icon} color={l.color} />
            <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
            {pendingCount(l.id) > 0 && <span className="text-sm text-stone-500">{pendingCount(l.id)}</span>}
          </button>
        ))}
        <button onClick={props.onNewList} className={`${ghostButton} mt-2 justify-start`}>
          <Plus size={18} /> New list
        </button>
        {lists.length > 1 && (
          <button onClick={props.onReorderLists} className={`${ghostButton} justify-start`}>
            <ArrowUpDown size={18} /> Reorder lists
          </button>
        )}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="scrollbar-none flex gap-2 overflow-x-auto border-b border-stone-200 px-4 py-2 md:hidden dark:border-forest-700">
          {lists.map((l) => (
            <Chip key={l.id} active={l.id === selectedList.id} onClick={() => props.onSelectList(l.id)}>
              {l.name}
              {pendingCount(l.id) > 0 ? ` · ${pendingCount(l.id)}` : ''}
            </Chip>
          ))}
          <Chip onClick={props.onNewList}>+ New</Chip>
          {lists.length > 1 && <Chip onClick={props.onReorderLists}>Reorder</Chip>}
        </div>

        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:p-6">
          {props.banner}
          <header className="flex items-center gap-3">
            <ListIconBadge icon={selectedList.icon} color={selectedList.color} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold">{selectedList.name}</h1>
              <p className="text-sm text-stone-500">
                {listItems.filter((i) => !i.completed).length} to get · {listItems.filter((i) => i.completed).length} done
              </p>
            </div>
            <button onClick={() => void share()} className={ghostButton} aria-label="Share list">
              <Share2 size={20} />
              <span className="hidden sm:inline">{shared ? 'Copied' : 'Share'}</span>
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete "${selectedList.name}" and its ${listItems.length} items?`)) props.onDeleteList(selectedList);
              }}
              className={`${ghostButton} text-stone-400`}
              aria-label="Delete list"
            >
              <Trash2 size={20} />
            </button>
          </header>

          <AddBar staples={staples} listIcon={selectedList.icon} onAdd={props.onAdd} />
          <StaplesShelf staples={staples} activeItems={listItems} onAdd={props.onAddStaple} />

          {(listItems.length > 6 || search) && (
            <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 dark:border-forest-700 dark:bg-forest-800">
              <Search size={18} className="text-stone-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items, notes or people" className="min-w-0 flex-1 bg-transparent py-2 outline-none" />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={18} className="text-stone-400" />
                </button>
              )}
            </div>
          )}

          {categoryCounts.length > 1 && (
            <div className="scrollbar-none flex gap-2 overflow-x-auto">
              <Chip active={!filter} onClick={() => setFilter(null)}>
                All
              </Chip>
              {categoryCounts.map(([c, n]) => (
                <Chip key={c} active={filter === c} onClick={() => setFilter(filter === c ? null : c)}>
                  {c} ({n})
                </Chip>
              ))}
            </div>
          )}

          {pending.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-500 dark:border-forest-600">
              {listItems.length === 0 ? 'Nothing here yet. Type above to add the first item.' : 'All done.'}
            </p>
          ) : (
            <SortableItems
              items={pending}
              // Moving within a filtered view has no clear place among the hidden items.
              disabled={Boolean(filter || search.trim())}
              onMove={(from, to) => props.onMove(pending, from, to)}
              renderItem={(item, drag) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  drag={drag}
                  onToggle={() => props.onToggle(item)} onToggleSubtask={(id) => props.onToggleSubtask(item, id)} {...aisleRowProps(props.aisle, item)}
                  onEdit={() => props.onEdit(item)}
                  onDelete={() => props.onDelete(item)}
                  showCategory={!filter}
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
                <button onClick={() => props.onClearCompleted(listItems)} className={`${ghostButton} text-sm`}>
                  Clear done
                </button>
              </div>
              {showDone && (
                <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2">
                  {done.map((item) => (
                    <ItemRow key={item.id} item={item} onToggle={() => props.onToggle(item)} onToggleSubtask={(id) => props.onToggleSubtask(item, id)} {...aisleRowProps(props.aisle, item)} onDelete={() => props.onDelete(item)} />
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
