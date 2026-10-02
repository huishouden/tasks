import { useEffect, useId, useMemo, useState } from 'react';
import { CalendarPlus, Candy, ChevronDown, Citrus, Droplet, Flame, Leaf, ListPlus, Loader2, Plus, Sparkles, Star, Trash2, X } from 'lucide-react';
import { GENTLE_DIETS, dietTags, gentleOnReflux, isStrict, mealLevels, type MealLevels } from '../data/diet';
import { ErrorNotice } from '../components/ErrorNotice';
import { Badge, Chip, Dialog, ghostButton, inputClass, primaryButton } from '../components/ui';
import { friendlyError, type FriendlyError } from '../lib/errors';
import { useOnline, usePref } from '../lib/prefs';
import { DIET_LABELS, householdDiets, type FoodPreferences } from '@huishouden/pwa-kit/food';
import { MEAL_LABELS, groupMeals, kitchenInventory, mealIngredients, mealKey, pantryOf, plannedGroceries, type FavoriteMeal, type Meal, type MealContext, type Menu, type ValidatedMeals } from '../data/menus';
import type { ListItem, ShoppingList } from '../data/model';
import { PLAN_TYPES, firstFreeDay, type PlanType, type PlannedMeal } from '../data/mealPlan';
import type { Ymd } from '@huishouden/pwa-kit/time';

interface Props {
  lists: ShoppingList[];
  items: ListItem[];
  menus: Menu[];
  favorites: FavoriteMeal[];
  /** The household's diets and pantry (portal settings); null until read or when unavailable. */
  food: FoodPreferences | null;
  suggest: (ctx: MealContext) => Promise<ValidatedMeals>;
  onSave: (ingredients: string[], meals: Meal[]) => Promise<string>;
  onDelete: (id: string) => void;
  onSaveFavorite: (meal: Meal) => Promise<void>;
  onRemoveFavorite: (id: string) => Promise<void>;
  /** Adds each name to the list with the same note. */
  onAddItems: (listId: string, names: string[], notes: string) => void;
  /** The week shown in the plan, today first. */
  planWeek: Ymd[];
  plan: PlannedMeal[];
  onPlan: (day: Ymd, type: PlanType, meal: Meal) => Promise<void>;
  onUnplan: (day: Ymd, type: PlanType) => void;
}

const MIN_INGREDIENTS = 3;

/**
 * Meal ideas from what is in the kitchen (bought in the last 10 days) and what is still on the food
 * lists, so a week can be planned before shopping, within the household's diets.
 */
export function MealsView({ lists, items, menus, favorites, food, suggest, onSave, onDelete, onSaveFavorite, onRemoveFavorite, onAddItems, planWeek, plan, onPlan, onUnplan }: Props) {
  const [planning, setPlanning] = useState<Meal | null>(null);
  const bought = useMemo(() => kitchenInventory(items, lists, Date.now()), [items, lists]);
  const planned = useMemo(() => plannedGroceries(items, lists).filter((p) => !bought.some((b) => b.toLowerCase() === p.toLowerCase())), [items, lists, bought]);
  const pantry = pantryOf(food);
  const people = food?.people ?? [];
  const diets = householdDiets({ people });
  const strictDiets = diets.filter(isStrict);
  const gentleDiets = diets.filter((d) => GENTLE_DIETS.includes(d));
  const reflux = gentleDiets.includes('gerd');
  const [dropped, setDropped] = useState<ValidatedMeals['droppedDiet']>([]);
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

  const have = [...bought.filter((b) => !usedUp.has(b)), ...extras];
  const onList = planned.filter((p) => !usedUp.has(p));
  const available = [...have, ...onList];
  const ctx: MealContext = { have, onList, pantry, food: { people } };
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
        sources={mealIngredients(meal, ctx)}
        reflux={reflux}
        onToggleSaved={() => toggleFavorite(meal)}
        onAdd={() => setAdding(meal)}
        onPlan={meal.type === 'snack' ? undefined : () => setPlanning(meal)}
        onAddExtras={(names) => {
          if (!groceries) return;
          onAddItems(groceries.id, names, `for ${meal.name}`);
          setNotice(`Added ${names.length} ${names.length === 1 ? 'item' : 'items'} to ${groceries.name}`);
        }}
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
    setDropped([]);
    try {
      const result = await suggest(ctx);
      setDropped(result.droppedDiet);
      setSelectedId(await onSave(available, result.meals));
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
            From what you have (bought in the last 10 days) and what's still on your lists. Tap anything used up or not wanted.
          </p>
          {strictDiets.length > 0 && (
            <p className="mt-1 text-sm font-medium text-forest-700 dark:text-forest-300">
              Every idea fits {whoHas(people, (d) => isStrict(d)).join(', ')}
            </p>
          )}
          {gentleDiets.length > 0 && (
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              Gentler ideas first for {whoHas(people, (d) => !isStrict(d), true).join(', ')}; each shows how hot, acidic, rich and sweet it is.
            </p>
          )}
        </div>
        {bought.length + extras.length > 0 && <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">Have</h2>}
        <div className="flex flex-wrap gap-2" aria-label="Ingredients">
          {bought.map((name) => (
            <Chip key={name} active={!usedUp.has(name)} pressed={!usedUp.has(name)} onClick={() => toggle(name)}>
              <span className={usedUp.has(name) ? 'line-through' : ''}>{name}</span>
            </Chip>
          ))}
          {extras.map((name) => (
            <Chip key={`extra-${name}`} active label={`Remove ${name}`} onClick={() => setExtras(extras.filter((e) => e !== name))}>
              {name} <X size={12} className="ml-0.5 inline" aria-hidden />
            </Chip>
          ))}
          {bought.length === 0 && extras.length === 0 && planned.length === 0 && (
            <p className="text-sm text-stone-500">Nothing bought recently or on a food list. Add ingredients below.</p>
          )}
        </div>
        {planned.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-300">On the list</h2>
            <div className="flex flex-wrap gap-2" aria-label="On the list">
              {planned.map((name) => (
                <Chip key={`list-${name}`} active={!usedUp.has(name)} pressed={!usedUp.has(name)} onClick={() => toggle(name)}>
                  <span className={usedUp.has(name) ? 'line-through' : ''}>{name}</span>
                </Chip>
              ))}
            </div>
          </>
        )}
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
        {dropped.length > 0 && (
          <p className="text-sm text-stone-600 dark:text-stone-300" role="status">
            Left out {dropped.length === 1 ? '1 idea' : `${dropped.length} ideas`} that didn't fit: {dropped.map((d) => `${d.name} (${d.reason})`).join('; ')}.
          </p>
        )}
      </section>

      <WeekPlan days={planWeek} plan={plan} onUnplan={onUnplan} />

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
          {groupMeals(shown.meals, reflux).map(([type, meals]) => (
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
              <Star size={16} className="fill-terracotta text-terracotta" /> Favorites ({favorites.length})
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
          pantry={pantry}
          onAdd={(names) => {
            onAddItems(groceries.id, names, `for ${adding.name}`);
            setNotice(`Added ${names.length} ${names.length === 1 ? 'item' : 'items'} to ${groceries.name}`);
            setAdding(null);
          }}
          onClose={() => setAdding(null)}
        />
      )}

      {planning && (
        <PlanDialog
          meal={planning}
          days={planWeek}
          plan={plan}
          onPlan={(day, type) => {
            const meal = planning;
            setPlanning(null);
            onPlan(day, type, meal)
              .then(() => setNotice(`Planned for ${dayName(day)} ${type}`))
              .catch((e: unknown) => setSaveError(friendlyError(e, 'save')));
          }}
          onClose={() => setPlanning(null)}
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
  sources,
  reflux,
  onToggleSaved,
  onAdd,
  onPlan,
  onAddExtras,
}: {
  meal: Meal;
  /** Shown above the name where the meal type is not already a heading. */
  label?: string;
  saved: boolean;
  listName?: string;
  /** The meal's ingredients by where they come from. */
  sources: Record<'have' | 'list' | 'extra', string[]>;
  /** Someone in the household has GERD: mark the meals that are easy on it. */
  reflux: boolean;
  onToggleSaved: () => void;
  onAdd: () => void;
  /** Absent for snacks, which are not planned. */
  onPlan?: () => void;
  onAddExtras: (names: string[]) => void;
}) {
  const row = (title: string, names: string[]) =>
    names.length > 0 && (
      <p>
        <span className="font-medium text-stone-700 dark:text-stone-200">{title}:</span> {names.join(', ')}
      </p>
    );
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
          className={`${iconButton} ${saved ? 'text-terracotta' : 'text-stone-400'}`}
        >
          <Star size={18} className={saved ? 'fill-current' : ''} />
        </button>
        {onPlan && (
          <button onClick={onPlan} aria-label={`Plan ${meal.name}`} title="Plan for a day this week" className={`${iconButton} text-stone-400`}>
            <CalendarPlus size={18} />
          </button>
        )}
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
      <MealBadges meal={meal} reflux={reflux} />
      <div className="mb-2 grid gap-0.5 text-sm text-stone-600 dark:text-stone-300">
        {row('Have', sources.have)}
        {row('On the list', sources.list)}
        {sources.extra.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2">
            {row('To get', sources.extra)}
            {listName && (
              <button
                onClick={() => onAddExtras(sources.extra)}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 font-medium text-forest-700 hover:bg-forest-50 dark:text-forest-300 dark:hover:bg-forest-700"
                aria-label={`Add ${sources.extra.join(', ')} to ${listName}`}
              >
                <ListPlus size={16} /> Add to list
              </button>
            )}
          </div>
        )}
      </div>
      <ul className="grid gap-1.5 text-sm">
        {meal.parts.map((part, i) => (
          <li key={i}>
            <span className="font-medium">{sentenceCase(part.ingredients.join(', '))}</span>
            <span className="text-stone-500 dark:text-stone-400"> · {part.prep}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** "Today", "Tomorrow", "Wed, Jan 8". */
function dayName(day: Ymd, now: number = Date.now()): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * The week ahead, shared with the household: each day's breakfast, lunch and dinner. Empty slots
 * stay quiet; ideas are planned from their cards. Planned dinners also show in the portal.
 */
function WeekPlan({ days, plan, onUnplan }: { days: Ymd[]; plan: PlannedMeal[]; onUnplan: (day: Ymd, type: PlanType) => void }) {
  if (plan.length === 0) {
    return (
      <section aria-label="This week" className="rounded-2xl border border-dashed border-stone-300 p-4 text-sm text-stone-500 dark:border-forest-600">
        <h2 className="mb-1 font-semibold text-stone-700 dark:text-stone-200">This week</h2>
        Nothing planned yet. Use the calendar button on an idea to plan it for a day.
      </section>
    );
  }
  const slot = (day: Ymd, type: PlanType) => {
    const p = plan.find((x) => x.day === day && x.type === type);
    if (!p) return <span className="text-stone-400">–</span>;
    return (
      <span className="flex items-center gap-1">
        <span className="min-w-0 flex-1">{p.name}</span>
        <button
          onClick={() => onUnplan(day, type)}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-forest-700"
          aria-label={`Remove ${p.name} from ${dayName(day)} ${type}`}
        >
          <X size={16} aria-hidden />
        </button>
      </span>
    );
  };
  return (
    <section aria-label="This week" className="grid gap-2">
      <h2 className="text-sm font-semibold tracking-wider text-stone-500 uppercase">This week</h2>
      {/* Tablet and up: a table, days down, meals across. */}
      <table className="hidden w-full table-fixed overflow-hidden rounded-2xl border border-stone-200 bg-white text-left text-sm sm:table dark:border-forest-700 dark:bg-forest-800">
        <thead className="text-stone-500">
          <tr>
            <th scope="col" className="w-36 px-3 py-2 font-medium">
              <span className="sr-only">Day</span>
            </th>
            {PLAN_TYPES.map((t) => (
              <th key={t} scope="col" className="px-3 py-2 font-medium">
                {MEAL_LABELS[t]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day} className="border-t border-stone-200 dark:border-forest-700">
              <th scope="row" className="px-3 py-2 font-semibold">
                {dayName(day)}
              </th>
              {PLAN_TYPES.map((t) => (
                <td key={t} className="px-3 py-1 align-middle">
                  {slot(day, t)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Phone: one card per day with something planned. */}
      <ul className="grid gap-2 sm:hidden">
        {days
          .filter((day) => plan.some((p) => p.day === day))
          .map((day) => (
            <li key={day} className="rounded-2xl border border-stone-200 bg-white p-3 dark:border-forest-700 dark:bg-forest-800">
              <h3 className="mb-1 text-sm font-semibold">{dayName(day)}</h3>
              <dl className="grid gap-1 text-sm">
                {PLAN_TYPES.filter((t) => plan.some((p) => p.day === day && p.type === t)).map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <dt className="w-20 shrink-0 text-stone-500">{MEAL_LABELS[t]}</dt>
                    <dd className="min-w-0 flex-1">{slot(day, t)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
      </ul>
    </section>
  );
}

/** Picks the day and meal for an idea; defaults to its own type on the first free day. */
function PlanDialog({ meal, days, plan, onPlan, onClose }: { meal: Meal; days: Ymd[]; plan: PlannedMeal[]; onPlan: (day: Ymd, type: PlanType) => void; onClose: () => void }) {
  const initialType: PlanType = (PLAN_TYPES as readonly string[]).includes(meal.type) ? (meal.type as PlanType) : 'dinner';
  const [type, setType] = useState<PlanType>(initialType);
  const [day, setDay] = useState<Ymd>(() => firstFreeDay(days, plan, initialType));
  const taken = plan.find((p) => p.day === day && p.type === type);
  return (
    <Dialog title={`Plan ${meal.name}`} onClose={onClose}>
      <div className="grid gap-3">
        <div role="group" aria-label="Meal" className="flex flex-wrap gap-2">
          {PLAN_TYPES.map((t) => (
            <Chip key={t} active={type === t} pressed={type === t} onClick={() => setType(t)}>
              {MEAL_LABELS[t]}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Day" className="flex flex-wrap gap-2">
          {days.map((d) => (
            <Chip key={d} active={day === d} pressed={day === d} onClick={() => setDay(d)}>
              {dayName(d)}
            </Chip>
          ))}
        </div>
        {taken && <p className="text-sm text-stone-600 dark:text-stone-300">Replaces {taken.name}.</p>}
        <div className="mt-1 flex justify-end gap-2">
          <button onClick={onClose} className={ghostButton}>
            Cancel
          </button>
          <button onClick={() => onPlan(day, type)} className={primaryButton}>
            Plan for {dayName(day).toLowerCase() === 'today' || dayName(day).toLowerCase() === 'tomorrow' ? dayName(day).toLowerCase() : dayName(day)}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** "Alex (vegetarian, pregnant)", or with `possessive`, "Alex's GERD (reflux)": who has which diets. */
function whoHas(people: FoodPreferences['people'], keep: (d: FoodPreferences['people'][number]['diets'][number]) => boolean, possessive = false): string[] {
  return people
    .map((p) => ({ name: p.name, diets: p.diets.filter(keep).map((d) => DIET_LABELS[d]) }))
    .filter((p) => p.diets.length)
    .map((p) => (possessive ? `${p.name}'s ${p.diets.join(' and ')}` : `${p.name} (${p.diets.map((d) => d.toLowerCase()).join(', ')})`));
}

/** One wording for what is shown and what is read out. */
const HEAT_WORDS = ['A little spicy', 'Spicy', 'Very spicy'];

const LEVEL_WORDS: Record<Exclude<keyof MealLevels, 'heat'>, [string, string, string]> = {
  acidity: ['A little acidic', 'Acidic', 'Very acidic'],
  richness: ['A little rich', 'Rich', 'Fried or greasy'],
  sweetness: ['A little sweet', 'Sweet', 'Very sweet'],
};

/**
 * What a menu would print beside a dish: Vegetarian or Vegan, flames for heat, and words for
 * acidity, richness and sweetness when there is any. Quiet stone text throughout.
 */
function MealBadges({ meal, reflux }: { meal: Meal; reflux: boolean }) {
  const levels = meal.levels ?? mealLevels(meal);
  const tags = dietTags(meal);
  const icons = { acidity: Citrus, richness: Droplet, sweetness: Candy } as const;
  const words = (Object.keys(LEVEL_WORDS) as (keyof typeof LEVEL_WORDS)[]).filter((k) => levels[k] > 0);
  const heat = HEAT_WORDS[levels.heat - 1];
  if (!tags.length && !levels.heat && !words.length && !reflux) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5" aria-label={`About ${meal.name}`}>
      {reflux && gentleOnReflux(levels) && <Badge tone="forest">Gentle on reflux</Badge>}
      {tags.map((t) => (
        <Badge key={t}>
          <Leaf size={12} aria-hidden /> {t}
        </Badge>
      ))}
      {heat && (
        <Badge label={heat}>
          {Array.from({ length: levels.heat }, (_, i) => (
            <Flame key={i} size={12} aria-hidden />
          ))}
          <span aria-hidden>{heat}</span>
        </Badge>
      )}
      {words.map((k) => {
        const Icon = icons[k];
        return (
          <Badge key={k}>
            <Icon size={12} aria-hidden /> {LEVEL_WORDS[k][Math.min(levels[k], 3) - 1]}
          </Badge>
        );
      })}
    </ul>
  );
}

/** "chicken, rice" → "Chicken, rice": sentence case, as the rest of the app writes. */
function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function AddIngredientsDialog({
  meal,
  list,
  onList,
  recentlyBought,
  pantry,
  onAdd,
  onClose,
}: {
  meal: Meal;
  list: ShoppingList;
  onList: string[];
  recentlyBought: string[];
  pantry: readonly string[];
  onAdd: (names: string[]) => void;
  onClose: () => void;
}) {
  // Computed once on open, so the ticks don't shift if the list changes while choosing. What is
  // neither listed nor bought is ticked.
  const [choices, setChoices] = useState(() => {
    const s = mealIngredients(meal, { have: recentlyBought, onList, pantry });
    return [
      ...s.extra.map((name) => ({ name, selected: true, note: null as string | null })),
      ...s.list.map((name) => ({ name, selected: false, note: 'on list' })),
      ...s.have.map((name) => ({ name, selected: false, note: 'bought recently' })),
    ];
  });
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
