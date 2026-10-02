import { useEffect, useMemo, useRef, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { inviteMember, markJoined, removeMember } from '@huishouden/pwa-kit/household';
import { CloudOff, Home, ListChecks, Loader2, ShoppingCart, UtensilsCrossed } from 'lucide-react';
import type { AddRequest } from './components/AddBar';
import { ErrorNotice } from './components/ErrorNotice';
import { friendlyError, type FriendlyError } from './lib/errors';
import { EditItemDialog, NewListDialog, ReorderListsDialog, SettingsDialog } from './components/dialogs';
import { inputClass, primaryButton } from './components/ui';
import { UndoToast, type UndoAction } from './components/UndoToast';
import { CATEGORIES, firstName, removedMessage, type Household, type ListIcon, type ListItem, type ShoppingList, type Staple } from './data/model';

const FOOD_LIST_ICONS: ListIcon[] = ['grocery', 'pantry', 'bulk'];
import {
  HouseholdRepo,
  createHousehold,
  signIn,
  signOut,
  useAuth,
  useHousehold,
  useFavorites,
  useFood,
  useMealPlan,
  useHouseholdData,
  useMenus,
  useStoreAisles,
  useStores,
} from './data/store';
import { classifyItem, suggestMeals } from './lib/ai';
import { useApplyTheme, useInstallPrompt, useOnline, usePref, type ThemeMode } from './lib/prefs';
import { HubView } from './views/HubView';
import { ListsView } from './views/ListsView';
import { StoreView } from './views/StoreView';
import { NearbyErrand } from './components/NearbyErrand';
import { StoreBanner } from './components/StoreBanner';
import { AislePrompt } from './components/AislePrompt';
import { placeLabel } from './data/places';
import { stapleKey } from './data/model';
import { MealsView } from './views/MealsView';
import { planDays, planMeal, unplanMeal } from './data/mealPlan';

type Mode = 'lists' | 'hub' | 'store' | 'meals';

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center p-6">{children}</div>;
}

function LoadFailure({ error }: { error: FriendlyError }) {
  return (
    <div className="grid w-full max-w-md gap-3">
      <ErrorNotice error={error} onRetry={() => window.location.reload()} />
    </div>
  );
}

const PORTAL_URL = 'https://huishouden-piekstra.web.app';

function Brand() {
  return (
    <div className="mb-6 flex flex-col items-center gap-3 text-center">
      <img src="/icon.svg" alt="" className="h-20 w-20 rounded-3xl shadow-sm" />
      <div>
        <p className="text-sm font-medium text-stone-600 dark:text-stone-300">Huishouden</p>
        <h1 className="text-3xl font-bold text-forest-700 dark:text-forest-300">Tasks</h1>
      </div>
    </div>
  );
}

/** Signed-in profile photo; initials when Google gives no photo. */
function Avatar({ photoURL, name }: { photoURL: string | null; name: string }) {
  if (photoURL) return <img src={photoURL} alt="" referrerPolicy="no-referrer" className="hh-avatar h-9 w-9 rounded-full" />;
  return (
    <span className="hh-avatar flex h-9 w-9 items-center justify-center rounded-full bg-forest-100 text-sm font-semibold text-forest-700 dark:bg-forest-700 dark:text-forest-100">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function App() {
  const [theme, setTheme] = usePref<ThemeMode>('theme', 'auto');
  useApplyTheme(theme);
  const auth = useAuth();
  const [signInError, setSignInError] = useState<FriendlyError | null>(null);

  if (auth.status === 'loading') {
    return (
      <Centered>
        <Loader2 className="animate-spin text-forest-500" size={36} />
      </Centered>
    );
  }
  if (auth.status === 'error') {
    return (
      <Centered>
        <LoadFailure error={friendlyError(new Error(auth.message), 'save')} />
      </Centered>
    );
  }
  if (auth.status === 'signed-out') {
    return (
      <Centered>
        <div className="w-full max-w-sm text-center">
          <Brand />
          <p className="mb-6 text-stone-600 dark:text-stone-300">Shared groceries, lists and chores for the kitchen tablet and both of your phones.</p>
          <button
            className={`${primaryButton} w-full py-3 text-lg`}
            onClick={() => {
              setSignInError(null);
              signIn().catch((e: unknown) => setSignInError(friendlyError(e, 'sign-in')));
            }}
          >
            Sign in with Google
          </button>
          {signInError && (
            <div className="mt-3 text-left">
              <ErrorNotice error={signInError} />
            </div>
          )}
        </div>
      </Centered>
    );
  }
  return <SignedIn db={auth.db} email={auth.email} displayName={auth.user.displayName} photoURL={auth.user.photoURL} theme={theme} setTheme={setTheme} />;
}

function SignedIn({ db, email, displayName, photoURL, theme, setTheme }: { db: Firestore; email: string; displayName: string | null; photoURL: string | null; theme: ThemeMode; setTheme: (t: ThemeMode) => void }) {
  const household = useHousehold(db, email);
  if (household.status === 'loading') {
    return (
      <Centered>
        <Loader2 className="animate-spin text-forest-500" size={36} />
      </Centered>
    );
  }
  if (household.status === 'error') {
    return (
      <Centered>
        <LoadFailure error={friendlyError(new Error(household.message), 'save')} />
      </Centered>
    );
  }
  if (household.status === 'none') return <Onboarding db={db} email={email} displayName={displayName} />;
  return <HouseholdApp db={db} email={email} displayName={displayName} photoURL={photoURL} household={household.household} theme={theme} setTheme={setTheme} />;
}

function Onboarding({ db, email, displayName }: { db: Firestore; email: string; displayName: string | null }) {
  const [name, setName] = useState(`${firstName(displayName, email)}'s household`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  return (
    <Centered>
      <div className="w-full max-w-md">
        <Brand />
        <div className="grid gap-5 rounded-3xl bg-white p-6 shadow-sm dark:bg-forest-800">
          <div>
            <h2 className="mb-1 font-semibold">Joining someone?</h2>
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Ask them to add <strong>{email}</strong> in Settings. This screen switches to your shared lists as soon as they do.
            </p>
          </div>
          <div className="border-t border-stone-200 pt-5 dark:border-forest-700">
            <h2 className="mb-2 font-semibold">Starting fresh?</h2>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setBusy(true);
                setError(null);
                createHousehold(db, email, name.trim() || 'Our household')
                  .catch((err: unknown) => setError(friendlyError(err, 'save')))
                  .finally(() => setBusy(false));
              }}
            >
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} aria-label="Household name" />
              <button type="submit" disabled={busy} className={primaryButton}>
                {busy ? <Loader2 className="animate-spin" size={18} /> : null} Create household
              </button>
              {error && <ErrorNotice error={error} />}
            </form>
          </div>
          <button onClick={() => void signOut()} className="text-sm text-stone-500 underline">
            Use a different Google account
          </button>
        </div>
      </div>
    </Centered>
  );
}

function initialMode(): Mode | null {
  const m = new URLSearchParams(window.location.search).get('mode');
  return m === 'hub' || m === 'store' || m === 'lists' || m === 'meals' ? m : null;
}

function HouseholdApp({
  db,
  email,
  displayName,
  photoURL,
  household,
  theme,
  setTheme,
}: {
  db: Firestore;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  household: Household;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
}) {
  const data = useHouseholdData(db, household.id);
  const menus = useMenus(db, household.id);
  const loadedStores = useStores(db, household.id);
  const stores = useMemo(() => loadedStores ?? [], [loadedStores]);
  const [storeId, setStoreId] = usePref<string | null>('store', null);

  const favorites = useFavorites(db, household.id);
  const food = useFood(db, household.id);
  const planWeek = useMemo(() => planDays(), []);
  const plan = useMealPlan(db, household.id, planWeek);
  const repo = useMemo(() => new HouseholdRepo(db, household.id), [db, household.id]);
  const [savedMode, setMode] = usePref<Mode>('mode', 'lists');
  const [urlMode, setUrlMode] = useState<Mode | null>(initialMode);
  const mode = urlMode ?? savedMode;
  const [selectedId, setSelectedId] = usePref<string>('list', 'groceries');
  const [addedAs, setAddedAs] = usePref<string>('addedAs', firstName(displayName, email));
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [newList, setNewList] = useState(false);
  const [reorderLists, setReorderLists] = useState(false);
  const [settings, setSettings] = useState(false);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const undoCount = useRef(0);
  const online = useOnline();
  const install = useInstallPrompt();

  const hasJoined = (household.joined ?? []).includes(email);
  useEffect(() => {
    // The latest snapshot, so the kit's own membership check never sees a stale member list.
    if (!hasJoined) void markJoined(db, { ...household, joined: household.joined ?? [] }, email).catch(() => {});
  }, [hasJoined, db, household, email]);

  // A shopping trip: aisle prompts only appear while one is running, and it ends on its own.
  const [session, setSession] = usePref<{ storeId: string; until: number } | null>('shopping', null);
  const shoppingStoreId = session && session.until > Date.now() && stores.some((st) => st.id === session.storeId) ? session.storeId : null;
  const startShopping = (id: string) => {
    setStoreId(id);
    setSession({ storeId: id, until: Date.now() + 3 * 60 * 60 * 1000 });
  };
  const endShopping = () => setSession(null);
  const aisleStoreId = shoppingStoreId ?? (mode === 'store' ? storeId : null);
  const aisles = useStoreAisles(db, household.id, aisleStoreId);
  const [askAisleFor, setAskAisleFor] = useState<string | null>(null);
  const toggle = (item: ListItem) => {
    repo.toggleCompleted(item);
    // Just checked off in a store, with no aisle on record there yet: offer to note it.
    setAskAisleFor(!item.completed && shoppingStoreId && !aisles.has(stapleKey(item.name)) ? item.id : null);
  };
  const aisleProps = aisleStoreId
    ? {
        aisleFor: (item: ListItem) => aisles.get(stapleKey(item.name)),
        onAisle: (item: ListItem, aisle: string) => {
          repo.setAisle(aisleStoreId, item.name, aisle, addedAs);
          setAskAisleFor(null);
        },
        onDismissAisle: () => setAskAisleFor(null),
      }
    : undefined;
  // Waits for the first stores snapshot, so a saved store is never offered as a new shop.
  const storeBanner = loadedStores && (
    <StoreBanner
      // A fresh banner per screen, so switching to Groceries or Store mode checks again.
      key={mode}
      stores={stores}
      activeStore={stores.find((st) => st.id === shoppingStoreId) ?? null}
      onUseStore={startShopping}
      onCreateFromPlace={(place) =>
        startShopping(repo.createStore(placeLabel(place), [], { location: place.location, osmId: place.osmId, address: place.address }))
      }
      onEnd={endShopping}
    />
  );
  // The tablet stays home, so the errand line is for Lists and Store on the go.
  const errandBanner = <NearbyErrand items={data.items} onDone={toggle} />;
  const shoppingHere =
    mode === 'store' || (mode === 'lists' && ['grocery', 'pantry', 'bulk'].includes(data.lists.find((l) => l.id === selectedId)?.icon ?? ''));

  // Falls back for display only: a just-created list is briefly missing until its snapshot
  // arrives, and resetting the saved choice then would jump back to the first list.
  const selectedList: ShoppingList | undefined = data.lists.find((l) => l.id === selectedId) ?? data.lists[0];

  function switchMode(m: Mode) {
    setUrlMode(null);
    setMode(m);
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }

  const add = (req: AddRequest) => {
    if (!selectedList) return;
    const id = repo.addItem({ ...req, listId: selectedList.id, listIcon: selectedList.icon, addedBy: addedAs });
    // Names the word list could not place get a second opinion from Gemini, in the background.
    if (id && req.category === CATEGORIES.OTHER && FOOD_LIST_ICONS.includes(selectedList.icon) && navigator.onLine) {
      void classifyItem(req.name).then((category) => {
        if (!category) return;
        repo.updateItem(id, { category });
        repo.setStapleCategory(req.name, category);
      });
    }
  };
  const addStaple = (s: Staple) =>
    selectedList && repo.addItem({ listId: selectedList.id, name: s.displayName, category: s.category, quantity: s.defaultQuantity, addedBy: addedAs });

  function offerUndo(removed: ListItem[], how: 'deleted' | 'cleared') {
    if (removed.length === 0) return;
    const id = ++undoCount.current;
    setUndoAction({ id, message: removedMessage(removed, how), undo: () => repo.restoreItems(removed) });
  }
  const deleteItem = (item: ListItem) => {
    repo.deleteItem(item);
    offerUndo([item], 'deleted');
  };
  const clearCompleted = (items: ListItem[]) => offerUndo(repo.clearCompleted(items), 'cleared');

  const modes: { id: Mode; label: string; icon: typeof Home }[] = [
    { id: 'lists', label: 'Lists', icon: ListChecks },
    { id: 'hub', label: 'Kitchen', icon: Home },
    { id: 'store', label: 'Store', icon: ShoppingCart },
    { id: 'meals', label: 'Meals', icon: UtensilsCrossed },
  ];

  return (
    <div className="safe-top flex h-full flex-col">
      {/* Huishouden frame (DESIGN.md): family logo back to the portal, suite name over the app name. */}
      <header className="flex items-center gap-2 border-b border-stone-200 bg-cream px-3 py-2 sm:px-4 dark:border-forest-700 dark:bg-forest-900">
        <a href={PORTAL_URL} className="mr-auto flex items-center gap-2.5 rounded-xl" aria-label="Huishouden home">
          <img src="/icon.svg" alt="" className="h-9 w-9 rounded-xl" />
          <span className="hidden leading-tight sm:block">
            <span className="block text-xs font-medium text-stone-600 dark:text-stone-300">Huishouden</span>
            <span className="block text-base font-bold text-forest-700 dark:text-forest-300">Tasks</span>
          </span>
        </a>
        <nav className="flex rounded-2xl bg-stone-100 p-1 dark:bg-forest-800" aria-label="Mode">
          {modes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => switchMode(id)}
              aria-pressed={mode === id}
              aria-label={label}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium sm:px-3 ${
                mode === id ? 'bg-white shadow-sm dark:bg-forest-600' : 'text-stone-500 dark:text-stone-300'
              }`}
            >
              <Icon size={16} /> <span className="hidden min-[420px]:inline">{label}</span>
            </button>
          ))}
        </nav>
        <span className="ml-auto flex items-center" title={!online ? 'Offline: changes will sync when back online' : data.pendingWrites ? 'Syncing' : 'Synced'}>
          {!online ? (
            <CloudOff size={20} className="text-terracotta" aria-label="Offline" />
          ) : data.pendingWrites ? (
            <Loader2 size={18} className="animate-spin text-stone-400" aria-label="Syncing" />
          ) : null}
        </span>
        <button onClick={() => setSettings(true)} className="rounded-full p-0.5 hover:ring-2 hover:ring-forest-200 dark:hover:ring-forest-600" aria-label="Settings">
          <Avatar photoURL={photoURL} name={addedAs || email} />
        </button>
      </header>

      <main className={`min-h-0 flex-1 overflow-y-auto ${undoAction || askAisleFor ? 'pb-20' : ''}`}>
        {!data.loaded ? (
          <Centered>
            <div className="grid justify-items-center gap-3 text-center">
              <Loader2 className="animate-spin text-forest-500" size={36} />
              {data.error && (
                <p className="max-w-sm text-sm text-stone-500" role="status">
                  Still connecting. Retrying automatically.
                  <span className="mt-1 block text-xs text-stone-400">{data.error}</span>
                </p>
              )}
            </div>
          </Centered>
        ) : !selectedList ? (
          <Centered>
            <div className="grid max-w-sm justify-items-center gap-3 text-center">
              <p className="text-stone-600 dark:text-stone-300">This household has no lists.</p>
              <button onClick={() => repo.restoreDefaultLists()} className={primaryButton}>
                Add the default lists
              </button>
              <button onClick={() => setNewList(true)} className="text-sm text-stone-500 underline">
                Or create your own
              </button>
            </div>
          </Centered>
        ) : mode === 'hub' ? (
          <HubView
            lists={data.lists}
            items={data.items}
            staples={data.staples}
            selectedList={selectedList}
            onSelectList={setSelectedId}
            onAdd={add}
            onAddStaple={addStaple}
            onToggle={toggle}
            onToggleSubtask={(i, id) => repo.toggleSubtask(i, id)}
            aisle={aisleProps}
            onEdit={setEditing}
            onMove={(ordered, from, to) => repo.moveItem(ordered, from, to)}
          />
        ) : mode === 'meals' ? (
          <MealsView
            lists={data.lists}
            items={data.items}
            menus={menus}
            favorites={favorites}
            food={food}
            planWeek={planWeek}
            plan={plan}
            onPlan={(day, type, meal) => planMeal(db, household.id, day, type, meal, email)}
            onUnplan={(day, type) => unplanMeal(db, household.id, day, type)}
            suggest={suggestMeals}
            onSave={(ingredients, meals) => repo.saveMenu(ingredients, meals, addedAs)}
            onDelete={(id) => {
              const menu = menus.find((m) => m.id === id);
              repo.deleteMenu(id);
              if (menu) {
                const undoId = ++undoCount.current;
                setUndoAction({ id: undoId, message: menu.meals.length === 1 ? "Deleted 1 meal idea" : `Deleted ${menu.meals.length} meal ideas`, undo: () => void repo.restoreMenu(menu) });
              }
            }}
            onSaveFavorite={(meal) => repo.saveFavorite(meal, addedAs)}
            onRemoveFavorite={(id) => repo.removeFavorite(id)}
            onAddItems={(listId, names, notes) => names.forEach((name) => repo.addItem({ listId, name, notes, addedBy: addedAs }))}
          />
        ) : mode === 'store' ? (
          <StoreView
            lists={data.lists}
            items={data.items}
            selectedList={selectedList}
            onSelectList={setSelectedId}
            onToggle={toggle}
            onToggleSubtask={(i, id) => repo.toggleSubtask(i, id)}
            aisle={aisleProps}
            onClearCompleted={clearCompleted}
            stores={stores}
            storeId={storeId}
            onSelectStore={(id) => {
              if (id) startShopping(id);
              else {
                setStoreId(null);
                endShopping();
              }
            }}
            aisles={aisles}
            banner={
              <>
                {errandBanner}
                {storeBanner}
              </>
            }
            onCreateStore={(name) => repo.createStore(name, [])}
            onUpdateStore={(id, changes) => repo.updateStore(id, changes)}
            onDeleteStore={(id) => repo.deleteStore(id)}
          />
        ) : (
          <ListsView
            lists={data.lists}
            items={data.items}
            staples={data.staples}
            selectedList={selectedList}
            onSelectList={setSelectedId}
            onNewList={() => setNewList(true)}
            onReorderLists={() => setReorderLists(true)}
            banner={
              <>
                {errandBanner}
                {shoppingHere ? storeBanner : null}
              </>
            }
            onDeleteList={(l) => void repo.deleteList(l.id)}
            onAdd={add}
            onAddStaple={addStaple}
            onToggle={toggle}
            onToggleSubtask={(i, id) => repo.toggleSubtask(i, id)}
            aisle={aisleProps}
            onEdit={setEditing}
            onDelete={deleteItem}
            onClearCompleted={clearCompleted}
            onMove={(ordered, from, to) => repo.moveItem(ordered, from, to)}
          />
        )}
      </main>

      {editing && (
        <EditItemDialog
          item={editing}
          lists={data.lists}
          onSave={(changes) => {
            repo.updateItem(editing.id, changes);
            // A corrected aisle sticks: the next time this item is added it lands there.
            if (changes.category && changes.category !== editing.category) repo.setStapleCategory(changes.name ?? editing.name, changes.category);
          }}
          // The dialog holds the item as it was when opened; restore what is stored now.
          onDelete={() => deleteItem(data.items.find((i) => i.id === editing.id) ?? editing)}
          onClose={() => setEditing(null)}
        />
      )}
      {newList && (
        <NewListDialog
          onCreate={(name, icon, color) => setSelectedId(repo.createList(name, icon, color, data.lists.length))}
          onClose={() => setNewList(false)}
        />
      )}
      {undoAction && (
        <UndoToast
          key={undoAction.id}
          action={undoAction}
          onDismiss={() => setUndoAction((a) => (a?.id === undoAction.id ? null : a))}
        />
      )}
      {askAisleFor && shoppingStoreId && (() => {
        const item = data.items.find((i) => i.id === askAisleFor);
        const store = stores.find((st) => st.id === shoppingStoreId);
        if (!item || !store || undoAction) return null;
        return (
          <AislePrompt
            key={item.id}
            itemName={item.name}
            storeName={store.name}
            onSave={(aisle) => {
              repo.setAisle(store.id, item.name, aisle, addedAs);
              setAskAisleFor(null);
            }}
            onSkip={() => setAskAisleFor(null)}
          />
        );
      })()}
      {reorderLists && <ReorderListsDialog lists={data.lists} onReorder={(ids) => repo.reorderLists(ids)} onClose={() => setReorderLists(false)} />}
      {settings && (
        <SettingsDialog
          household={household}
          myEmail={email}
          addedAs={addedAs}
          setAddedAs={setAddedAs}
          theme={theme}
          setTheme={setTheme}
          install={install}
          onAddMember={(e) => inviteMember(db, household.id, e)}
          onRemoveMember={(e) => removeMember(db, household.id, e)}
          onSignOut={() => void signOut()}
          onClose={() => setSettings(false)}
        />
      )}
    </div>
  );
}
