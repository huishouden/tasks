import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { signInSilently } from '@huishouden/pwa-kit/auth';
import { inviteMember, markJoined, removeMember, saveMyProfile } from '@huishouden/pwa-kit/household';
import { setRole } from '@huishouden/pwa-kit/roles';
import { RoleNote, useRole } from '@huishouden/pwa-kit/react/roles';
import { AppBar } from '@huishouden/pwa-kit/react/app-bar';
import { NotificationsCard } from '@huishouden/pwa-kit/react/push';
import { SampleBanner, cardClass } from '@huishouden/pwa-kit/react/ui';
import { CloudOff, Loader2 } from 'lucide-react';
import type { AddRequest } from './components/AddBar';
import { ErrorNotice } from './components/ErrorNotice';
import { friendlyError, type FriendlyError } from './lib/errors';
import { EditItemDialog, NewListDialog, ReorderListsDialog, SettingsDialog } from './components/dialogs';
import { inputClass, primaryButton } from './components/ui';
import { UndoToast, type UndoAction } from './components/UndoToast';
import { GROCERIES_PATH, firstName, listName, mayChangeItem, removedMessage, type Household, type ListItem, type ShoppingList } from './data/model';
import {
  HouseholdRepo,
  createHousehold,
  signIn,
  signOut,
  useAuth,
  useHousehold,
  usePublish,
  useHouseholdData,
} from './data/store';
import { DEMO_AUTH, DEMO_EMAIL, DEMO_HOUSEHOLD, openDemo } from './data/demo';
import { googleTaskItem, markHandled, saveGoogleTasksLinks, watchTasksSettings, type TasksSettings } from './data/googleTasks';
import { GoogleTasksSettings } from './components/GoogleTasksSettings';
import { GoogleTasksSuggestions, useGoogleTasksSuggestions } from '@huishouden/pwa-kit/react/google-tasks';
import type { GoogleTask } from '@huishouden/pwa-kit/google-tasks';
import { getFirebase, googleClientId, useEmulators } from './lib/firebase';
import { PrefScope, useInstallPrompt, useOnline, usePref } from './lib/prefs';
import { ListsView } from './views/ListsView';
import { NearbyErrand } from './components/NearbyErrand';
import { groceriesRedirect } from './lib/groceriesLink';
import { t, useT } from './i18n';
import { richT } from './lib/rich';

/** The Huishouden portal, at the root of the site Tasks shares (pwa-kit docs/one-site.md). */
const PORTAL_URL = '/';
const VERSION = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_BUILD_SHA})`;

interface FrameProps {
  user: User | null | undefined;
  signingIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

/** The Huishouden frame (DESIGN.md "Frame"): the kit's app bar over the page. */
function Frame({ user, signingIn, onSignIn, onSignOut, onSettings, actions, children }: FrameProps & { onSettings?: () => void; actions?: ReactNode; children: ReactNode }) {
  const t = useT();
  return (
    <div className="flex h-full flex-col">
      <AppBar app={t('app.name')} glyph="check" portalUrl={PORTAL_URL} version={VERSION} user={user} signingIn={signingIn} onSignIn={onSignIn} onSignOut={onSignOut} onSettings={onSettings} settingsLabel={t('settings.open')}>
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
  return <Loader2 className="animate-spin text-forest-500" size={36} aria-label={t('common.loading')} />;
}

function LoadFailure({ error }: { error: FriendlyError }) {
  return (
    <div className="grid w-full max-w-md gap-3">
      <ErrorNotice error={error} onRetry={() => window.location.reload()} />
    </div>
  );
}

export default function App() {
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
  const frame: FrameProps = { user, signingIn, onSignIn, onSignOut };

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
  if (auth.status === 'signed-out') return <DemoApp frame={frame} signInError={signInError} />;
  return <SignedIn db={auth.db} auth={auth.auth} email={auth.email} user={auth.user} frame={frame} />;
}

/** Signed out: the app on an invented household, so it can be tried (and screenshotted) before signing in. */
function DemoApp({ frame, signInError }: { frame: FrameProps; signInError: FriendlyError | null }) {
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
    <SampleBanner
      text={t('demo.banner')}
      notice={signInError ? <ErrorNotice error={signInError} /> : undefined}
      className="mx-3 mt-3 sm:mx-4"
    />
  );
  return (
    <PrefScope.Provider value="demo.">
      <HouseholdApp db={db} email={DEMO_EMAIL} displayName="Alex Example" household={DEMO_HOUSEHOLD} frame={frame} demo banner={banner} />
    </PrefScope.Provider>
  );
}

function SignedIn({ db, auth, email, user, frame }: { db: Firestore; auth: Auth; email: string; user: User; frame: FrameProps }) {
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
  return <HouseholdApp db={db} email={email} displayName={user.displayName} household={household.household} frame={frame} auth={auth} />;
}

function Onboarding({ db, email, displayName }: { db: Firestore; email: string; displayName: string | null }) {
  const t = useT();
  const [name, setName] = useState(() => t('onboarding.suggestedName', { name: firstName(displayName, email) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  return (
    <Centered>
      <div className={`${cardClass} grid w-full max-w-md gap-5 p-6`}>
        <div>
          <h2 className="mb-1 font-semibold">{t('onboarding.joining')}</h2>
          <p className="text-sm text-muted">
            {richT('onboarding.ask', {
              email: <strong translate="no">{email}</strong>,
              portal: (
                // i18n-ignore: the suite's name
                <a href={PORTAL_URL} className="font-medium text-link underline underline-offset-2">
                  Huishouden
                </a>
              ),
            })}
          </p>
        </div>
        <div className="border-t border-line pt-5">
          <h2 className="mb-2 font-semibold">{t('onboarding.fresh')}</h2>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              createHousehold(db, email, name.trim() || t('onboarding.ourHousehold'))
                .catch((err: unknown) => setError(friendlyError(err, 'save')))
                .finally(() => setBusy(false));
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} aria-label={t('onboarding.nameLabel')} />
            <button type="submit" disabled={busy} className={primaryButton}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : null} {t('onboarding.create')}
            </button>
            {error && <ErrorNotice error={error} />}
          </form>
        </div>
      </div>
    </Centered>
  );
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
  frame,
  demo = false,
  banner,
  auth = DEMO_AUTH,
}: {
  db: Firestore;
  email: string;
  displayName: string | null;
  household: Household;
  frame: FrameProps;
  /** The signed-out sample household: nothing is published, nothing leaves the device. */
  demo?: boolean;
  /** Shown above every screen (the sample-data note). */
  banner?: ReactNode;
  /** Firebase Auth, for Google services (Calendar, Google Tasks); none for the sample. */
  auth?: Auth;
}) {
  const t = useT();
  const data = useHouseholdData(db, household.id);
  const role = useRole(household, email);
  // Admins and members change anything; helpers and kids only what they added (the rules check `by`).
  const mayChange = (item: ListItem) => mayChangeItem(item, role.role, email);
  const canSetUp = role.can('change-settings');
  usePublish(db, household.id, email, data, !demo, role.restricted);
  const repo = useMemo(() => new HouseholdRepo(db, household.id, demo), [db, household.id, demo]);
  const [selectedId, setSelectedId] = usePref<string>('list', 'chores');
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
    // An old link to a shopping list or one of its items (from before Groceries had them) opens there.
    const moved = groceriesRedirect(window.location.search, new Set(data.otherLists.map((l) => l.id)));
    if (moved) {
      window.location.replace(moved);
      return;
    }
    const item = link.item ? data.items.find((i) => i.id === link.item) : undefined;
    if (item && mayChangeItem(item, role.role, email)) setEditing(item);
    setLink({ list: null, item: null });
    window.history.replaceState(null, '', window.location.pathname);
  }, [data.loaded, data.items, data.otherLists, link]);
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

  const toggle = (item: ListItem) => repo.toggleCompleted(item, mayChange(item));
  const errandBanner = <NearbyErrand items={data.items} onDone={toggle} />;

  // Google Tasks: what the Gemini app or Google Assistant added there, offered for the chosen to-do
  // lists. The settings document is shared with Groceries, whose shopping lists take their own links.
  const [tasksSettings, setTasksSettings] = useState<TasksSettings | null>(null);
  useEffect(() => (demo ? undefined : watchTasksSettings(db, household.id, setTasksSettings)), [db, household.id, demo]);
  const allLinks = useMemo(() => tasksSettings?.googleTasks ?? [], [tasksSettings]);
  const links = useMemo(() => allLinks.filter((l) => data.lists.some((list) => list.id === l.listId)), [allLinks, data.lists]);
  const takenIn = useMemo(() => new Set([...(tasksSettings?.handled ?? []), ...data.items.flatMap((i) => (i.googleTaskId ? [i.googleTaskId] : []))]), [tasksSettings, data.items]);
  const googleTasks = useGoogleTasksSuggestions({
    auth,
    app: 'tasks',
    // Bringing tasks in records them in the household's settings: admins' and members' devices only.
    listIds: canSetUp ? links.map((l) => l.googleListId) : [],
    isImported: (t) => takenIn.has(t.id),
  });
  const bringIn = useCallback(
    (tasks: GoogleTask[]) => {
      if (!tasksSettings || tasks.length === 0) return;
      for (const t of tasks) {
        const link = links.find((l) => l.googleListId === t.listId);
        const list = data.lists.find((l) => l.id === link?.listId);
        if (link && list) repo.addItem({ ...googleTaskItem(t, link, list.icon, addedAs), by: email });
      }
      void markHandled(db, household.id, tasksSettings, tasks.map((t) => t.id), email).catch(() => {});
    },
    [tasksSettings, links, data.lists, repo, addedAs, db, household.id, email],
  );
  // Links set to add straight away (older settings) still do; each is written under a fixed id, so
  // two devices bringing in the same task write one item.
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
        const list = data.lists.find((l) => l.id === link?.listId);
        return link ? t('googleTasks.forList', { title: link.title, list: list ? listName(list) : t('googleTasks.aList') }) : undefined;
      }}
      onAdd={(t) => bringIn([t])}
      onDismiss={googleTasks.dismiss}
    />
  );

  // Falls back for display only: a just-created list is briefly missing until its snapshot
  // arrives, and resetting the saved choice then would jump back to the first list.
  const selectedList: ShoppingList | undefined = data.lists.find((l) => l.id === selectedId) ?? data.lists[0];

  const add = (req: AddRequest) => {
    if (!selectedList) return;
    repo.addItem({ ...req, listId: selectedList.id, listIcon: selectedList.icon, addedBy: addedAs, by: email });
  };

  function offerUndo(removed: ListItem[], how: 'deleted' | 'cleared') {
    if (removed.length === 0) return;
    const id = ++undoCount.current;
    setUndoAction({ id, message: removedMessage(removed, how), undo: () => repo.restoreItems(removed) });
  }
  const deleteItem = (item: ListItem) => {
    repo.deleteItem(item);
    offerUndo([item], 'deleted');
  };
  const cancelItem = (item: ListItem) => {
    repo.cancelItem(item, email);
    const id = ++undoCount.current;
    setUndoAction({ id, message: t('undo.cancelled', { name: item.name }), undo: () => repo.restoreItems([item]) });
  };
  const clearCompleted = (items: ListItem[]) => offerUndo(repo.clearCompleted(items.filter(mayChange)), 'cleared');

  return (
    <Frame
      {...frame}
      onSettings={() => setSettings(true)}
      actions={
        <span slot="actions" className="flex items-center gap-1">
          {demo ? null : !online ? (
            <CloudOff size={20} className="text-terracotta" aria-label={t('status.offline')} role="img" />
          ) : data.pendingWrites ? (
            <Loader2 size={18} className="animate-spin text-muted" aria-label={t('status.syncing')} role="img" />
          ) : null}
        </span>
      }
    >
      <main className={`min-h-0 flex-1 overflow-y-auto ${undoAction ? 'pb-20' : ''}`}>
        {banner}
        {!data.loaded ? (
          <Centered>
            <div className="grid justify-items-center gap-3 text-center">
              <Loader2 className="animate-spin text-forest-500" size={36} />
              {data.error && (
                <p className="max-w-sm text-sm text-muted" role="status">
                  {t('status.connecting')}
                  <span className="mt-1 block text-xs text-muted">{data.error}</span>
                </p>
              )}
            </div>
          </Centered>
        ) : !selectedList ? (
          <Centered>
            <div className="grid max-w-sm justify-items-center gap-3 text-center">
              <p className="text-muted">{t('lists.none')}</p>
              {canSetUp ? (
                <>
                  <button onClick={() => repo.restoreDefaultLists()} className={primaryButton}>
                    {t('lists.addDefaults')}
                  </button>
                  <button onClick={() => setNewList(true)} className="text-sm text-muted underline">
                    {t('lists.createOwn')}
                  </button>
                </>
              ) : (
                <RoleNote action="change-settings" />
              )}
              <a href={GROCERIES_PATH} className="text-sm font-medium text-link underline underline-offset-2">
                {t('lists.shoppingInGroceries')}
              </a>
            </div>
          </Centered>
        ) : (
          <ListsView
            lists={data.lists}
            items={data.items}
            selectedList={selectedList}
            onSelectList={setSelectedId}
            onNewList={() => setNewList(true)}
            onReorderLists={() => setReorderLists(true)}
            banner={
              <>
                {googleTasksCard}
                {errandBanner}
              </>
            }
            onDeleteList={(l) => void repo.deleteList(l.id)}
            canSetUp={canSetUp}
            mayChange={mayChange}
            onAdd={add}
            onToggle={toggle}
            onToggleSubtask={(i, id) => repo.toggleSubtask(i, id, mayChange(i))}
            onEdit={(item) => mayChange(item) && setEditing(item)}
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
          onSave={(changes) => repo.updateItem(editing.id, changes)}
          // The dialog holds the item as it was when opened; restore what is stored now.
          onDelete={() => deleteItem(data.items.find((i) => i.id === editing.id) ?? editing)}
          onCancel={() => cancelItem(data.items.find((i) => i.id === editing.id) ?? editing)}
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
      {reorderLists && <ReorderListsDialog lists={data.lists} onReorder={(ids) => repo.reorderLists(ids)} onClose={() => setReorderLists(false)} />}
      {settings && (
        <SettingsDialog
          household={household}
          myEmail={email}
          addedAs={addedAs}
          setAddedAs={setAddedAs}
          install={install}
          googleTasks={
            !demo && canSetUp && (
              <GoogleTasksSettings
                auth={auth}
                lists={data.lists}
                otherLists={data.otherLists}
                links={allLinks}
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
              offText={t('notifications.off')}
              onText={t('notifications.on')}
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
