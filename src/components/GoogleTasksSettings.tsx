import { useState } from 'react';
import { ListTodo, Loader2 } from 'lucide-react';
import type { Auth } from 'firebase/auth';
import { googleTaskLists, googleTasksToken, type GoogleTaskList } from '@huishouden/pwa-kit/google-tasks';
import { googleAccessMessage } from '@huishouden/pwa-kit/feedback';
import { ghostButton, inputClass } from './ui';
import type { ShoppingList } from '../data/model';
import type { GoogleTasksLink } from '../data/googleTasks';

/**
 * "Google Tasks" in Settings: connect from a tap, then choose which Google list feeds which to-do
 * list; new tasks are offered first. The links live in one household document shared with
 * Groceries, whose shopping lists have their own: those are shown, never changed, here.
 */
export function GoogleTasksSettings({
  auth,
  lists,
  otherLists,
  links,
  onSave,
  onConnected,
}: {
  auth: Auth;
  /** Tasks' to-do lists. */
  lists: ShoppingList[];
  /** Groceries' shopping lists, named when a Google list already goes to one. */
  otherLists: ShoppingList[];
  /** Every link in the household's settings, Groceries' included; saving keeps theirs. */
  links: GoogleTasksLink[];
  onSave: (links: GoogleTasksLink[]) => Promise<void>;
  /** This device has a fresh token: look for new tasks now. */
  onConnected: () => void;
}) {
  const [googleLists, setGoogleLists] = useState<GoogleTaskList[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const token = await googleTasksToken(auth);
      setGoogleLists(await googleTaskLists(token));
      onConnected();
    } catch (e) {
      setError(googleAccessMessage(e, 'Google Tasks') ?? "Couldn't read your Google Tasks lists. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function choose(list: GoogleTaskList, listId: string) {
    const others = links.filter((l) => l.googleListId !== list.id);
    const next = lists.some((l) => l.id === listId) ? [...others, { googleListId: list.id, title: list.title, listId, mode: 'suggest' as const }] : others;
    onSave(next).catch(() => setError("Couldn't save. Try again."));
  }

  const ownIds = new Set(lists.map((l) => l.id));
  const mine = links.filter((l) => ownIds.has(l.listId));
  const groceriesList = (googleListId: string) => {
    const link = links.find((l) => l.googleListId === googleListId && !ownIds.has(l.listId));
    return link ? (otherLists.find((l) => l.id === link.listId)?.name ?? null) : null;
  };
  const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? 'a removed list';
  const what = (l: GoogleTasksLink) => (l.mode === 'add' ? `New tasks in ${l.title} go straight onto ${listName(l.listId)}.` : `New tasks in ${l.title} are offered for ${listName(l.listId)}.`);

  return (
    <section aria-label="Google Tasks" className="grid gap-2">
      <p className="text-sm font-semibold">Google Tasks</p>
      <p className="text-sm text-muted">
        Things you ask the Gemini app or Google Assistant to add to a list land in Google Tasks. Tasks can bring them in. It checks when it opens or comes back
        into view, for an hour after you connect on this device.
      </p>
      {mine.length > 0 && (
        <ul className="grid gap-1 text-sm text-ink-soft">
          {mine.map((l) => (
            <li key={l.googleListId}>{what(l)}</li>
          ))}
        </ul>
      )}
      {googleLists === null ? (
        <button type="button" onClick={() => void connect()} disabled={busy} className={`${ghostButton} justify-self-start border border-line`}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ListTodo size={18} />} {mine.length ? 'Connect again and check now' : 'Connect Google Tasks'}
        </button>
      ) : googleLists.length === 0 ? (
        <p className="text-sm text-muted">Your Google account has no task lists yet.</p>
      ) : (
        <div className="grid gap-2">
          {googleLists.map((g) => {
            const inGroceries = groceriesList(g.id);
            return inGroceries !== null ? (
              <p key={g.id} className="grid gap-1 text-sm text-muted">
                {g.title}
                <span className="text-ink-soft">Goes to {inGroceries} in Groceries</span>
              </p>
            ) : (
            <label key={g.id} className="grid gap-1 text-sm text-muted">
              {g.title}
              <select
                className={inputClass}
                value={mine.find((l) => l.googleListId === g.id)?.listId ?? ''}
                onChange={(e) => choose(g, e.target.value)}
                aria-label={`Bring ${g.title} into`}
              >
                <option value="">Leave in Google Tasks</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    Offer for {l.name}
                  </option>
                ))}
              </select>
            </label>
            );
          })}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </section>
  );
}
