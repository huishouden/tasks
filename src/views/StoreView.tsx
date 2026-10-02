import { useMemo, useState, type ReactNode } from 'react';
import { Check, LocateFixed, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { ErrorNotice } from '../components/ErrorNotice';
import { ItemRow, aisleRowProps, type AisleProps } from '../components/ItemRow';
import { SortableRows } from '../components/SortableRows';
import { Chip, ghostButton, inputClass, primaryButton } from '../components/ui';
import { moveInOrder, stapleKey, type Category, type ListItem, type ShoppingList } from '../data/model';
import { fullCategoryOrder, groupWithAisles, type GeoPoint, type StoreLayout } from '../data/stores';
import { friendlyError, type FriendlyError } from '../lib/errors';
import { useWakeLock } from '../lib/prefs';

export type StoreChanges = Partial<Pick<StoreLayout, 'name' | 'categoryOrder' | 'aisleLabels'>> & { location?: GeoPoint | null };

interface Props {
  /** The shopping banner (detected store, or the store being shopped), shown above the list. */
  banner?: ReactNode;
  lists: ShoppingList[];
  items: ListItem[];
  selectedList: ShoppingList;
  onSelectList: (id: string) => void;
  onToggle: (item: ListItem) => void;
  onToggleSubtask: (item: ListItem, subtaskId: string) => void;
  aisle?: AisleProps;
  onClearCompleted: (items: ListItem[]) => void;
  stores: StoreLayout[];
  storeId: string | null;
  onSelectStore: (id: string | null) => void;
  onCreateStore: (name: string) => string;
  onUpdateStore: (id: string, changes: StoreChanges) => void;
  onDeleteStore: (id: string) => void;
  /** Learned aisles at the selected store, keyed by normalised item name. */
  aisles: Map<string, string>;
}

function currentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Location is not available on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? 'Location permission was denied.' : e.message)),
      // Always a fresh fix: a cached one from minutes ago can still be at the last store.
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

function cleanLabels(labels: Partial<Record<Category, string>>): Partial<Record<Category, string>> {
  return Object.fromEntries(Object.entries(labels).flatMap(([k, v]) => (v?.trim() ? [[k, v.trim()]] : [])));
}

/** In-store checklist walked section by section in the chosen store's order. */
export function StoreView(props: Props) {
  const { lists, items, selectedList, stores, storeId, onSelectStore } = props;
  useWakeLock(true);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const store = stores.find((s) => s.id === storeId) ?? null;
  const listItems = useMemo(() => items.filter((i) => i.listId === selectedList.id), [items, selectedList.id]);
  const total = listItems.length;
  const done = listItems.filter((i) => i.completed).length;
  const progress = total === 0 ? 0 : done / total;
  const sections = groupWithAisles(listItems, props.aisles, store?.categoryOrder, store?.aisleLabels, stapleKey);

  function choose(id: string | null) {
    setEditing(false);
    onSelectStore(id);
  }

  return (
    <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:p-6">
      {props.banner}
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {lists.map((l) => (
          <Chip key={l.id} active={l.id === selectedList.id} onClick={() => props.onSelectList(l.id)}>
            {l.name}
          </Chip>
        ))}
      </div>

      <section aria-label="Store" className="grid gap-2 rounded-2xl border border-stone-200 bg-white p-3 dark:border-forest-700 dark:bg-forest-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-stone-500">Shopping at</span>
          <Chip active={!store} onClick={() => choose(null)}>
            Typical store
          </Chip>
          {stores.map((s) => (
            <Chip key={s.id} active={s.id === store?.id} onClick={() => choose(s.id)}>
              {s.location && <MapPin size={12} className="mr-0.5 inline" />}
              {s.name}
            </Chip>
          ))}
          <Chip onClick={() => setAdding(true)}>
            <Plus size={12} className="mr-0.5 inline" /> Add store
          </Chip>
        </div>
        {adding && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              const id = props.onCreateStore(newName);
              setNewName('');
              setAdding(false);
              choose(id);
              setEditing(true);
            }}
          >
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Publix on Main St" className={inputClass} autoFocus aria-label="Store name" />
            <button type="submit" disabled={!newName.trim()} className={primaryButton}>
              Add
            </button>
          </form>
        )}
        {store && !editing && (
          <button onClick={() => setEditing(true)} className={`${ghostButton} justify-self-start text-sm`}>
            <Pencil size={16} /> Edit {store.name} layout
          </button>
        )}
      </section>

      {store && editing ? (
        <LayoutEditor
          store={store}
          onUpdate={(changes) => props.onUpdateStore(store.id, changes)}
          onDelete={() => {
            if (!confirm(`Delete ${store.name}?`)) return;
            props.onDeleteStore(store.id);
            choose(null);
          }}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-4 bg-cream px-4 py-2 sm:-mx-6 sm:px-6 dark:bg-forest-900">
            <div className="flex items-baseline justify-between">
              <h1 className="text-2xl font-bold">{selectedList.name}</h1>
              <span className="text-stone-500">
                {done} of {total} in cart
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200 dark:bg-forest-700">
              <div className="h-full rounded-full bg-forest-500 transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
          {sections.length === 0 && <p className="p-8 text-center text-stone-500">This list is empty.</p>}
          {sections.map((group) => (
            <section key={group.key} aria-label={group.title}>
              <h2 className="mb-2 text-sm font-semibold tracking-wider text-stone-500 uppercase">
                {group.title}
                {group.label && (
                  <span className="ml-1.5 rounded-md bg-forest-100 px-1.5 py-0.5 tracking-normal text-forest-700 normal-case dark:bg-forest-700 dark:text-forest-100">
                    {group.label}
                  </span>
                )}
                <span className="font-normal"> · {group.items.filter((i) => !i.completed).length} left</span>
              </h2>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                {group.items.map((item) => (
                  <ItemRow key={item.id} item={item} large onToggle={() => props.onToggle(item)} onToggleSubtask={(id) => props.onToggleSubtask(item, id)} {...aisleRowProps(props.aisle, item)} />
                ))}
              </ul>
            </section>
          ))}
          {done > 0 && (
            <button onClick={() => props.onClearCompleted(listItems)} className={`${ghostButton} justify-self-center`}>
              Clear {done} checked item{done === 1 ? '' : 's'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function LayoutEditor({
  store,
  onUpdate,
  onDelete,
  onDone,
}: {
  store: StoreLayout;
  onUpdate: (changes: StoreChanges) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const order = fullCategoryOrder(store.categoryOrder);
  const [labels, setLabels] = useState<Partial<Record<Category, string>>>(store.aisleLabels ?? {});
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  async function saveLocation() {
    setLocating(true);
    setError(null);
    try {
      onUpdate({ location: await currentPosition() });
    } catch (e) {
      setError(friendlyError(e, 'save'));
    } finally {
      setLocating(false);
    }
  }

  return (
    <section aria-label={`${store.name} layout`} className="grid gap-3">
      <div>
        <h1 className="text-xl font-bold">{store.name} layout</h1>
        <p className="text-sm text-stone-500">Drag sections into the order you walk this store. Aisle labels are optional.</p>
      </div>
      <SortableRows
        ids={order}
        label={(c) => c}
        onMove={(from, to) => onUpdate({ categoryOrder: moveInOrder(order, from, to) })}
        renderRow={(c) => (
          <>
            <span className="min-w-0 flex-1 font-medium">{c}</span>
            {/* Fixed width in a wrapper: the shared input style is full-width and would win over w-28. */}
            <div className="w-24 shrink-0 sm:w-28">
              <input
                value={labels[c as Category] ?? ''}
                onChange={(e) => setLabels({ ...labels, [c]: e.target.value })}
                onBlur={() => onUpdate({ aisleLabels: cleanLabels(labels) })}
                placeholder="Aisle"
                aria-label={`Aisle for ${c}`}
                className={`${inputClass} py-1.5 text-sm`}
              />
            </div>
          </>
        )}
      />
      <div className="grid gap-2 rounded-2xl border border-stone-200 p-3 dark:border-forest-700">
        {store.location ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-stone-600 dark:text-stone-300">
              <MapPin size={14} className="mr-1 inline" /> Location saved. Store mode picks {store.name} when you're there.
            </span>
            <button onClick={() => onUpdate({ location: null })} className={`${ghostButton} text-sm`}>
              Forget
            </button>
          </div>
        ) : (
          <button onClick={() => void saveLocation()} disabled={locating} className={`${ghostButton} justify-self-start`}>
            <LocateFixed size={18} className={locating ? 'animate-pulse' : ''} /> {locating ? 'Finding you…' : `I'm at ${store.name}: save this spot`}
          </button>
        )}
        {error && <ErrorNotice error={error} onRetry={() => void saveLocation()} retrying={locating} />}
      </div>
      <div className="flex justify-between">
        <button onClick={onDelete} className={`${ghostButton} text-red-600 dark:text-red-400`}>
          <Trash2 size={18} /> Delete store
        </button>
        <button
          onClick={() => {
            onUpdate({ aisleLabels: cleanLabels(labels) });
            onDone();
          }}
          className={primaryButton}
        >
          <Check size={18} /> Done
        </button>
      </div>
    </section>
  );
}
