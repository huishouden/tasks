import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { signInSilently } from '@huishouden/pwa-kit/auth';
import { inviteMember, markJoined, removeMember, saveMyProfile } from '@huishouden/pwa-kit/household';
import { setRole } from '@huishouden/pwa-kit/roles';
import { RoleNote, useRole } from '@huishouden/pwa-kit/react/roles';
import { AppBar } from '@huishouden/pwa-kit/react/app-bar';
import { NotificationsCard } from '@huishouden/pwa-kit/react/push';
import { SectionTabs, cardClass } from '@huishouden/pwa-kit/react/ui';
import { CloudOff, Loader2, Settings } from 'lucide-react';
import type { AddRequest } from './components/AddBar';
import { ErrorNotice } from './components/ErrorNotice';
import { friendlyError, type FriendlyError } from './lib/errors';
import { EditItemDialog, NewListDialog, ReorderListsDialog, SettingsDialog } from './components/dialogs';
import { inputClass, primaryButton } from './components/ui';
import { UndoToast, type UndoAction } from './components/UndoToast';
import { CATEGORIES, firstName, mayChangeItem, removedMessage, type Household, type ListIcon, type ListItem, type ShoppingList, type Staple } from './data/model';

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
  usePublish,
  useHouseholdData,
  useMenus,
  useStoreAisles,
  useStores,
  settled,
} from './data/store';
import { DEMO_AUTH, DEMO_EMAIL, DEMO_HOUSEHOLD, openDemo, suggestDemoMeals } from './data/demo';
import { googleTaskItem, markHandled, saveGoogleTasksLinks, watchTasksSettings, type TasksSettings } from './data/googleTasks';
import { GoogleTasksSettings } from './components/GoogleTasksSettings';
import { GoogleTasksSuggestions, useGoogleTasksSuggestions } from '@huishouden/pwa-kit/react/google-tasks';
import type { GoogleTask } from '@huishouden/pwa-kit/google-tasks';
import { classifyItem, suggestMeals } from './lib/ai';
import { getFirebase, googleClientId, useEmulators } from './lib/firebase';
import { PrefScope, useApplyTheme, useInstallPrompt, useOnline, usePref, type ThemeMode } from './lib/prefs';
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
import { trackView } from '@huishouden/pwa-kit/observability';

type Mode = 'lists' | 'hub' | 'store' | 'meals';

const PORTAL_URL = 'https://huishouden-piekstra.web.app';
const VERSION = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_BUILD_SHA})`;

interface FrameProps {
  user: User | null | undefined;
  dark: boolean;
  signingIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

/** The Huishouden frame (DESIGN.md "Frame"): the kit's app bar over the page. */
function Frame({ user, dark, signingIn, onSignIn, onSignOut, nav, actions, children }: FrameProps & { nav?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <AppBar app="Tasks" glyph="check" portalUrl={PORTAL_URL} version={VERSION} theme={dark ? 'dark' : 'light'} user={user} signingIn={signingIn} onSignIn={onSignIn} onSignOut={onSignOut}>
        {nav}
        {actions}
      </AppBar>
      {children}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 items-center justify-center p-6">{children}</div>;
}

function Spinner() {
  return <Loader2 className="animate-spin text-forest-500" size={36} aria-label="Loading" />;
}

function LoadFailure({ error }: { error: FriendlyError }) {
  return (
    <div className="grid w-full max-w-md gap-3">
      <ErrorNotice error={error} onRetry={() => window.location.reload()} />
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = usePref<ThemeMode>('theme', 'auto');
  const dark = useApplyTheme(theme);
  const auth = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<FriendlyError | null>(null);

  // Signs in without a click when the browser is signed in to Google and has used a Huishouden app.
  const signedOut = auth.status === 'signed-out';
  useEffect(() => {
    const clientId = googleClientId;
    if (signedOut && clientId && !useEmulators) void getFirebase().then(({ auth: firebaseAuth }) => signInSilently(firebaseAuth, clientId));
  }, [signedOut]);

  const onSignIn = useCallback(() => {
    setSigningIn(true);
    setSignInError(null);
    signIn()
      .catch((e: unknown) => setSignInError(friendlyError(e, 'sign-in')))
      .finally(() => setSigningIn(false));
  }, []);
  const onSignOut = useCallback(() => void signOut(), []);
  const user = auth.status === 'signed-in' ? auth.user : auth.status === 'loading' ? undefined : null;
  const frame: FrameProps = { user, dark, signingIn, onSignIn, onSignOut };

  if (auth.status === 'loading') {
    return (
      <Frame {...frame}>
        <Centered>
          <Spinner />
        </Centered>
      </Frame>
    );
  }
  if (auth.status === 'error') {
    return (
      <Frame {...frame}>
        <Centered>
          <LoadFailure error={friendlyError(new Error(auth.message), 'save')} />
        </Centered>
      </Frame>
    );
  }
  if (auth.status === 'signed-out') return <DemoApp frame={frame} theme={theme} setTheme={setTheme} signInError={signInError} />;
  return <SignedIn db={auth.db} auth={auth.auth} email={auth.email} user={auth.user} theme={theme} setTheme={setTheme} frame={frame} />;
}

/** Signed out: the app on an invented household, so it can be tried (and screenshotted) before signing in. */
function DemoApp({ frame, theme, setTheme, signInError }: { frame: FrameProps; theme: ThemeMode; setTheme: (t: ThemeMode) => void; signInError: FriendlyError | null }) {
  const [db, setDb] = useState<Firestore | null>(null);
  useEffect(() => {
    void openDemo().then(setDb);
  }, []);
  if (!db) {
    return (
      <Frame {...frame}>
        <Centered>
          <Spinner />
        </Centered>
      </Frame>
    );
  }
  const banner = (
    <div className={`${cardClass} mx-3 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:mx-4`} role="note">
      <span className="rounded-full bg-terracotta-light px-3 py-0.5 text-sm font-semibold text-terracotta-dark">Sample data</span>
      <p className="min-w-0 flex-1 text-sm text-stone-600 dark:text-stone-300">An invented household; nothing is saved. Sign in for your own.</p>
      {signInError && <ErrorNotice error={signInError} />}
    </div>
  );
  return (
    <PrefScope.Provider value="demo.">
      <HouseholdApp db={db} email={DEMO_EMAIL} displayName="Alex Example" household={DEMO_HOUSEHOLD} theme={theme} setTheme={setTheme} frame={frame} demo banner={banner} />
    </PrefScope.Provider>
  );
}

function SignedIn({ db, auth, email, user, theme, setTheme, frame }: { db: Firestore; auth: Auth; email: string; user: User; theme: ThemeMode; setTheme: (t: ThemeMode) => void; frame: FrameProps }) {
  const household = useHousehold(db, email);
  // Members' names and photos come from their own sign-ins (shown in the portal and beside entries).
  const householdId = household.status === 'ready' ? household.household.id : null;
  useEffect(() => {
    if (householdId) saveMyProfile(db, householdId, user).catch(() => {});
  }, [db, householdId, user]);

  if (household.status === 'loading') {
    return (
      <Frame {...frame}>
        <Centered>
          <Spinner />
        </Centered>
      </Frame>
    );
  }
  if (household.status === 'error') {
    return (
      <Frame {...frame}>
        <Centered>
          <LoadFailure error={friendlyError(new Error(household.message), 'save')} />
        </Centered>
      </Frame>
    );
  }
  if (household.status === 'none') {
    return (
      <Frame {...frame}>
        <Onboarding db={db} email={email} displayName={user.displayName} />
      </Frame>
    );
  }
  return <HouseholdApp db={db} email={email} displayName={user.displayName} household={household.household} theme={theme} setTheme={setTheme} frame={frame} auth={auth} />;
}

function Onboarding({ db, email, displayName }: { db: Firestore; email: string; displayName: string | null }) {
  const [name, setName] = useState(`${firstName(displayName, email)}'s household`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  return (
    <Centered>
      <div className={`${cardClass} grid w-full max-w-md gap-5 p-6`}>
        <div>
          <h2 className="mb-1 font-semibold">Joining someone?</h2>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Ask them to add <strong>{email}</strong> to the household in{' '}
            <a href={PORTAL_URL} className="font-medium text-forest-700 underline underline-offset-2 dark:text-forest-300">
              Huishouden
            </a>{' '}
            or in Tasks' Settings. This screen switches to your shared lists as soon as they do.
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
      </div>
    </Centered>
  );
}

function initialMode(): Mode | null {
  const params = new URLSearchParams(window.location.search);
  // A link to an item (from the household calendar or a reminder) opens it in its list.
  if (params.get('list')) return 'lists';
  const m = params.get('mode');
  return m === 'hub' || m === 'store' || m === 'lists' || m === 'meals' ? m : null;
}

/** The list and item a deep link names (`?list=<id>&item=<id>`), read once on open. */
function linkedItem(): { list: string | null; item: string | null } {
  const params = new URLSearchParams(window.location.search);
  return { list: params.get('list'), item: params.get('item') };
}

function HouseholdApp({
  db,
  email,
  displayName,
  household,
  theme,
  setTheme,
  frame,
  demo = false,
  banner,
  auth = DEMO_AUTH,
}: {
  db: Firestore;
  email: string;
  displayName: string | null;
  household: Household;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  frame: FrameProps;
  /** The signed-out sample household: nothing is published, nothing leaves the device. */
  demo?: boolean;
  /** Shown above every screen (the sample-data note). */
  banner?: ReactNode;
  /** Firebase Auth, for Google services (Calendar, Google Tasks); none for the sample. */
  auth?: Auth;
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
  const role = useRole(household, email);
  // Admins and members change anything; helpers and kids only what they added (the rules check `by`).
  const mayChange = (item: ListItem) => mayChangeItem(item, role.role, email);
  const canSetUp = role.can('change-settings');
  usePublish(db, household.id, email, data, plan, !demo, role.restricted);
  const repo = useMemo(() => new HouseholdRepo(db, household.id, demo), [db, household.id, demo]);
  const [savedMode, setMode] = usePref<Mode>('mode', 'lists');
  const [urlMode, setUrlMode] = useState<Mode | null>(initialMode);
  const mode = urlMode ?? savedMode;
  // Anonymous counts of which views are used, per visit (the portal's /privacy page).
  useEffect(() => {
    trackView(mode);
  }, [mode]);
  const [selectedId, setSelectedId] = usePref<string>('list', 'groceries');
  const [link, setLink] = useState(linkedItem);
  useEffect(() => {
    if (link.list) setSelectedId(link.list);
    // Only on open: the link chose the list once, and the person moves on from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [addedAs, setAddedAs] = usePref<string>('addedAs', firstName(displayName, email));
  const [editing, setEditing] = useState<ListItem | null>(null);
  useEffect(() => {
    if (!data.loaded || (!link.list && !link.item)) return;
    const item = link.item ? data.items.find((i) => i.id === link.item) : undefined;
    if (item && mayChangeItem(item, role.role, email)) setEditing(item);
    setLink({ list: null, item: null });
    window.history.replaceState(null, '', window.location.pathname);
  }, [data.loaded, data.items, link]);
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
      onCreateFromPlace={
        canSetUp
          ? (place) => startShopping(repo.createStore(placeLabel(place), [], { location: place.location, osmId: place.osmId, address: place.address }))
          : undefined
      }
      onEnd={endShopping}
    />
  );
  // The tablet stays home, so the errand line is for Lists and Store on the go.
  const errandBanner = <NearbyErrand items={data.items} onDone={toggle} />;

  // Google Tasks: what the Gemini app or Google Assistant added there, brought into the chosen lists.
  const [tasksSettings, setTasksSettings] = useState<TasksSettings | null>(null);
  useEffect(() => (demo ? undefined : watchTasksSettings(db, household.id, setTasksSettings)), [db, household.id, demo]);
  const links = useMemo(() => tasksSettings?.googleTasks ?? [], [tasksSettings]);
  const takenIn = useMemo(() => new Set([...(tasksSettings?.handled ?? []), ...data.items.flatMap((i) => (i.googleTaskId ? [i.googleTaskId] : []))]), [tasksSettings, data.items]);
  const googleTasks = useGoogleTasksSuggestions({
    auth,
    app: 'tasks',
    listIds: links.map((l) => l.googleListId),
    isImported: (t) => takenIn.has(t.id),
  });
  const bringIn = useCallback(
    (tasks: GoogleTask[]) => {
      if (!tasksSettings || tasks.length === 0) return;
      for (const t of tasks) {
        const link = links.find((l) => l.googleListId === t.listId);
        const list = data.lists.find((l) => l.id === link?.listId);
        if (link && list) repo.addItem(googleTaskItem(t, link, list.icon, addedAs));
      }
      void markHandled(db, household.id, tasksSettings, tasks.map((t) => t.id), email).catch(() => {});
    },
    [tasksSettings, links, data.lists, repo, addedAs, db, household.id, email],
  );
  // Shopping lists take new tasks straight away; each is written under a fixed id, so two devices
  // bringing in the same task write one item.
  const autoAdd = googleTasks.suggestions.filter((t) => links.find((l) => l.googleListId === t.listId)?.mode === 'add');
  const autoKey = autoAdd.map((t) => t.id).join(',');
  useEffect(() => {
    if (data.loaded && autoKey) bringIn(autoAdd);
    // autoAdd is derived from autoKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey, data.loaded, bringIn]);
  const offered = googleTasks.suggestions.filter((t) => links.find((l) => l.googleListId === t.listId)?.mode === 'suggest');
  const googleTasksCard = (
    <GoogleTasksSuggestions
      suggestions={offered}
      listTitle={(id) => {
        const link = links.find((l) => l.googleListId === id);
        return link ? `${link.title}, for ${data.lists.find((l) => l.id === link.listId)?.name ?? 'a list'}` : undefined;
      }}
      onAdd={(t) => bringIn([t])}
      onDismiss={googleTasks.dismiss}
    />
  );
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
    const id = repo.addItem({ ...req, listId: selectedList.id, listIcon: selectedList.icon, addedBy: addedAs, by: email });
    // Names the word list could not place get a second opinion from Gemini, in the background.
    if (!demo && id && req.category === CATEGORIES.OTHER && FOOD_LIST_ICONS.includes(selectedList.icon) && navigator.onLine) {
      void classifyItem(req.name).then((category) => {
        if (!category) return;
        repo.updateItem(id, { category });
        repo.setStapleCategory(req.name, category);
      });
    }
  };
  const addStaple = (s: Staple) =>
    selectedList && repo.addItem({ listId: selectedList.id, name: s.displayName, category: s.category, quantity: s.defaultQuantity, addedBy: addedAs, by: email });

  function offerUndo(removed: ListItem[], how: 'deleted' | 'cleared') {
    if (removed.length === 0) return;
    const id = ++undoCount.current;
    setUndoAction({ id, message: removedMessage(removed, how), undo: () => repo.restoreItems(removed) });
  }
  const deleteItem = (item: ListItem) => {
    repo.deleteItem(item);
    offerUndo([item], 'deleted');
  };
  const clearCompleted = (items: ListItem[]) => offerUndo(repo.clearCompleted(items.filter(mayChange)), 'cleared');

  const modes: { id: Mode; label: string }[] = [
    { id: 'lists', label: 'Lists' },
    { id: 'hub', label: 'Kitchen' },
    { id: 'store', label: 'Store' },
    { id: 'meals', label: 'Meals' },
  ];

  return (
    <Frame
      {...frame}
      nav={<SectionTabs tabs={modes} tab={mode} onTab={(id) => switchMode(id as Mode)} />}
      actions={
        <span slot="actions" className="flex items-center gap-1">
          {demo ? null : !online ? (
            <CloudOff size={20} className="text-terracotta" aria-label="Offline: changes sync when back online" role="img" />
          ) : data.pendingWrites ? (
            <Loader2 size={18} className="animate-spin text-stone-600 dark:text-stone-300" aria-label="Syncing" role="img" />
          ) : null}
          <button onClick={() => setSettings(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-forest-700" aria-label="Settings">
            <Settings size={20} />
          </button>
        </span>
      }
    >
      <main className={`min-h-0 flex-1 overflow-y-auto ${undoAction || askAisleFor ? 'pb-20' : ''}`}>
        {banner}
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
              {canSetUp ? (
                <>
                  <button onClick={() => repo.restoreDefaultLists()} className={primaryButton}>
                    Add the default lists
                  </button>
                  <button onClick={() => setNewList(true)} className="text-sm text-stone-500 underline">
                    Or create your own
                  </button>
                </>
              ) : (
                <RoleNote action="change-settings" />
              )}
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
            onEdit={(item) => mayChange(item) && setEditing(item)}
            mayChange={mayChange}
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
            plan={plan ?? []}
            onPlan={(day, type, meal) => settled(planMeal(db, household.id, day, type, meal, email), demo)}
            onUnplan={(day, type) => settled(unplanMeal(db, household.id, day, type), demo)}
            suggest={demo ? suggestDemoMeals : suggestMeals}
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
            onAddItems={(listId, names, notes) => names.forEach((name) => repo.addItem({ listId, name, notes, addedBy: addedAs, by: email }))}
            readOnly={!canSetUp}
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
            canSetUp={canSetUp}
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
                {googleTasksCard}
                {errandBanner}
                {shoppingHere ? storeBanner : null}
              </>
            }
            onDeleteList={(l) => void repo.deleteList(l.id)}
            canSetUp={canSetUp}
            mayChange={mayChange}
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
          googleTasks={
            !demo && (
              <GoogleTasksSettings
                auth={auth}
                lists={data.lists}
                links={links}
                onSave={(next) => saveGoogleTasksLinks(db, household.id, next, email)}
                onConnected={() => void googleTasks.scan()}
              />
            )
          }
          notifications={
            !demo && <NotificationsCard
              db={db}
              householdId={household.id}
              user={{ email }}
              app="tasks"
              vapidKey={import.meta.env.VITE_VAPID_PUBLIC_KEY}
              offText="Get a notification here an hour before a task is due, and on the morning of a task due that day."
              onText="On. This device tells you an hour before a task is due, and on the morning of a task due that day."
              plain
            />
          }
          onAddMember={(e, r) => inviteMember(db, { ...household, roles: household.roles ?? {} }, e, r)}
          onRemoveMember={(e) => removeMember(db, { ...household, roles: household.roles ?? {} }, e)}
          onSetRole={(e, r) => setRole(db, { ...household, roles: household.roles ?? {} }, e, r)}
          onClose={() => setSettings(false)}
        />
      )}
    </Frame>
  );
}
