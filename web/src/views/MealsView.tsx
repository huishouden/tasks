import { useEffect, useId, useMemo, useState } from 'react';
import { ChevronDown, ListPlus, Loader2, Plus, Sparkles, Star, Trash2, X } from 'lucide-react';
import { ErrorNotice } from '../components/ErrorNotice';
import { Chip, Dialog, ghostButton, inputClass, primaryButton } from '../components/ui';
import { friendlyError, type FriendlyError } from '../lib/errors';
import { useOnline, usePref } from '../lib/prefs';
import { MEAL_LABELS, groupMeals, ingredientChoices, kitchenInventory, mealKey, type FavoriteMeal, type Meal, type Menu } from '../data/menus';
import type { ListItem, ShoppingList } from '../data/model';

interface Props {
  lists: ShoppingList[];
  items: ListItem[];
  menus: Menu[];
  favorites: FavoriteMeal[];
  suggest: (ingredients: string[]) => Promise<Meal[]>;
  onSave: (ingredients: string[], meals: Meal[]) => Promise<string>;
  onDelete: (id: string) => void;
  onSaveFavorite: (meal: Meal) => Promise<void>;
  onRemoveFavorite: (id: string) => Promise<void>;
  /** Adds each name to the list with the same note. */
  onAddItems: (listId: string, names: string[], notes: string) => void;
}

const MIN_INGREDIENTS = 3;

/** Meal ideas from what was recently bought: groceries checked off in the last 10 days. */
export function MealsView({ lists, items, menus, favorites, suggest, onSave, onDelete, onSaveFavorite, onRemoveFavorite, onAddItems }: Props) {
  const bought = useMemo(() => kitchenInventory(items, lists, Date.now()), [items, lists]);
  const [usedUp, setUsedUp] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [saveError, setSaveError] = useState<FriendlyError | null>(null);
  const online = useOnline();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favoritesOpen, setFavoritesOpen] = usePref('favoritesOpen', true);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const available = [...bought.filter((b) => !usedUp.has(b)), ...extras];
  const shown = menus.find((m) => m.id === selectedId) ?? menus[0];
  const savedIds = new Set(favorites.map((f) => f.id));
  const groceries = lists.find((l) => l.icon === 'grocery') ?? lists[0];

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function toggleFavorite(meal: Meal) {
    setSaveError(null);
    const id = mealKey(meal);
    const write = savedIds.has(id) ? onRemoveFavorite(id) : onSaveFavorite(meal);
    write.catch((e: unknown) => setSaveError(friendlyError(e, 'save')));
  }

  function card(meal: Meal, key: string, label?: string) {
    return (
      <MealCard
        key={key}
        meal={meal}
        label={label}
        saved={savedIds.has(mealKey(meal))}
        listName={groceries?.name}
        onToggleSaved={() => toggleFavorite(meal)}
        onAdd={() => setAdding(meal)}
      />
    );
  }

  function toggle(name: string) {
    setUsedUp((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const meals = await suggest(available);
      setSelectedId(await onSave(available, meals));
    } catch (e) {
      setError(friendlyError(e, 'meals'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 p-4 sm:p-6">
      <section className="grid gap-3 rounded-3xl bg-white p-4 sm:p-5 dark:bg-forest-800">
        <div>
          <h1 className="text-2xl font-bold">What can we make?</h1>
          <p className="text-sm text-stone-500">
            In the kitchen: groceries checked off in the last 10 days. Tap anything that's used up; add what isn't on a list.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Ingredients">
          {bought.map((name) => (
            <Chip key={name} active={!usedUp.has(name)} onClick={() => toggle(name)}>
              <span className={usedUp.has(name) ? 'line-through' : ''}>{name}</span>
            </Chip>
          ))}
          {extras.map((name) => (
            <Chip key={`extra-${name}`} active onClick={() => setExtras(extras.filter((e) => e !== name))}>
              {name} <X size={12} className="ml-0.5 inline" />
            </Chip>
          ))}
          {bought.length === 0 && extras.length === 0 && (
            <p className="text-sm text-stone-500">Nothing checked off recently. Add ingredients below.</p>
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = extra.trim();
            if (name && !available.some((a) => a.toLowerCase() === name.toLowerCase())) setExtras([...extras, name]);
            setExtra('');
          }}
        >
          <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Also have… (e.g. bread)" className={inputClass} aria-label="Extra ingredient" />
          <button type="submit" className={ghostButton} aria-label="Add ingredient" disabled={!extra.trim()}>
            <Plus size={18} />
          </button>
        </form>
        <button onClick={() => void run()} disabled={busy || !online || available.length < MIN_INGREDIENTS} className={`${primaryButton} py-3 text-lg`}>
          {busy ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
          {busy ? 'Thinking up meals… usually 10–30 seconds' : 'Suggest meals'}
        </button>
        {available.length < MIN_INGREDIENTS && <p className="text-sm text-stone-500">Needs at least {MIN_INGREDIENTS} ingredients.</p>}
        {!online && !error && <ErrorNotice error={friendlyError(new Error('offline'), 'meals', false)} />}
        {error && <ErrorNotice error={error} retrying={busy} onRetry={online ? () => void run() : undefined} />}
      </section>

      {shown && (
        <section className="grid gap-4" aria-label="Meal ideas">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <select
                value={shown.id}
                onChange={(e) => setSelectedId(e.target.value)}
                className={inputClass}
                aria-label="Saved meal ideas"
              >
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {new Date(m.createdAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {m.createdBy} ·{' '}
                    {m.meals.length} ideas
                  </option>
                ))}
              </select>
            </div>
            <button onClick={() => onDelete(shown.id)} className={`${ghostButton} text-stone-400`} aria-label="Delete these ideas">
              <Trash2 size={18} />
            </button>
          </div>
          {groupMeals(shown.meals).map(([type, meals]) => (
            <div key={type}>
              <h2 className="mb-2 text-sm font-semibold tracking-wider text-stone-500 uppercase">{MEAL_LABELS[type]}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{meals.map((meal) => card(meal, meal.name))}</div>
            </div>
          ))}
        </section>
      )}

      {saveError && <ErrorNotice error={saveError} />}

      {favorites.length > 0 && (
        <section className="grid gap-3" aria-label="Favorites">
          <h2>
            <button
              onClick={() => setFavoritesOpen(!favoritesOpen)}
              aria-expanded={favoritesOpen}
              className="flex w-full items-center gap-2 text-left text-sm font-semibold tracking-wider text-stone-500 uppercase"
            >
              <Star size={16} className="fill-amber-400 text-amber-400" /> Favorites ({favorites.length})
              <ChevronDown size={16} className={`ml-auto transition ${favoritesOpen ? 'rotate-180' : ''}`} />
            </button>
          </h2>
          {favoritesOpen && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{favorites.map((f) => card(f.meal, f.id, MEAL_LABELS[f.meal.type]))}</div>
          )}
        </section>
      )}

      {adding && groceries && (
        <AddIngredientsDialog
          meal={adding}
          list={groceries}
          onList={items.filter((i) => i.listId === groceries.id && !i.completed).map((i) => i.name)}
          // Used-up chips are not in the kitchen any more, so they are worth buying again.
          recentlyBought={bought.filter((b) => !usedUp.has(b))}
          onAdd={(names) => {
            onAddItems(groceries.id, names, `for ${adding.name}`);
            setNotice(`Added ${names.length} ${names.length === 1 ? 'item' : 'items'} to ${groceries.name}`);
            setAdding(null);
          }}
          onClose={() => setAdding(null)}
        />
      )}

      {notice && (
        <p
          role="status"
          className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto w-fit rounded-full bg-forest-700 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-forest-300 dark:text-forest-900"
        >
          {notice}
        </p>
      )}
    </div>
  );
}

function MealCard({
  meal,
  label,
  saved,
  listName,
  onToggleSaved,
  onAdd,
}: {
  meal: Meal;
  /** Shown above the name where the meal type is not already a heading. */
  label?: string;
  saved: boolean;
  listName?: string;
  onToggleSaved: () => void;
  onAdd: () => void;
}) {
  const iconButton = 'shrink-0 rounded-lg p-1.5 hover:bg-stone-100 dark:hover:bg-forest-700';
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-forest-700 dark:bg-forest-800">
      <div className="mb-2 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          {label && <p className="text-xs font-semibold tracking-wider text-stone-500 uppercase">{label}</p>}
          <h3 className="font-semibold">{meal.name}</h3>
        </div>
        <button
          onClick={onToggleSaved}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${meal.name} from favorites` : `Save ${meal.name} to favorites`}
          title={saved ? 'Remove from favorites' : 'Save to favorites'}
          className={`${iconButton} ${saved ? 'text-amber-500' : 'text-stone-400'}`}
        >
          <Star size={18} className={saved ? 'fill-current' : ''} />
        </button>
        {listName && (
          <button
            onClick={onAdd}
            aria-label={`Add ingredients for ${meal.name} to ${listName}`}
            title={`Add ingredients to ${listName}`}
            className={`${iconButton} text-stone-400`}
          >
            <ListPlus size={18} />
          </button>
        )}
      </div>
      <ul className="grid gap-1.5 text-sm">
        {meal.parts.map((part, i) => (
          <li key={i}>
            <span className="font-medium capitalize">{part.ingredients.join(', ')}</span>
            <span className="text-stone-500 dark:text-stone-400"> · {part.prep}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function AddIngredientsDialog({
  meal,
  list,
  onList,
  recentlyBought,
  onAdd,
  onClose,
}: {
  meal: Meal;
  list: ShoppingList;
  onList: string[];
  recentlyBought: string[];
  onAdd: (names: string[]) => void;
  onClose: () => void;
}) {
  // Computed once on open, so the ticks don't shift if the list changes while choosing.
  const [choices, setChoices] = useState(() => ingredientChoices(meal, onList, recentlyBought));
  const idPrefix = useId();
  const picked = choices.filter((c) => c.selected).map((c) => c.name);
  return (
    <Dialog title={`Add to ${list.name}`} onClose={onClose}>
      <p className="mb-3 text-sm text-stone-500">For {meal.name}</p>
      {choices.length === 0 ? (
        <p className="text-sm text-stone-500">Nothing to buy: this meal uses only kitchen basics.</p>
      ) : (
        <ul className="grid gap-1">
          {choices.map((c, i) => (
            <li key={c.name} className="flex items-center gap-2 rounded-xl px-2 hover:bg-stone-50 dark:hover:bg-forest-700">
              <label className="flex flex-1 items-center gap-3 py-2">
                <input
                  type="checkbox"
                  checked={c.selected}
                  onChange={() => setChoices(choices.map((x, j) => (j === i ? { ...x, selected: !x.selected } : x)))}
                  aria-describedby={c.note ? `${idPrefix}-${i}` : undefined}
                  className="h-5 w-5 shrink-0 accent-forest-700 dark:accent-forest-400"
                />
                {c.name}
              </label>
              {c.note && (
                <span id={`${idPrefix}-${i}`} className="text-xs text-stone-500 dark:text-stone-400">
                  {c.note}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className={ghostButton}>
          Cancel
        </button>
        <button onClick={() => onAdd(picked)} disabled={picked.length === 0} className={primaryButton}>
          {picked.length === 1 ? 'Add 1 item' : `Add ${picked.length} items`}
        </button>
      </div>
    </Dialog>
  );
}
