import { useState } from 'react';
import { ListTodo, Loader2 } from 'lucide-react';
import type { Auth } from 'firebase/auth';
import { googleTaskLists, googleTasksToken, type GoogleTaskList } from '@huishouden/pwa-kit/google-tasks';
import { googleAccessMessage } from '@huishouden/pwa-kit/feedback';
import { ghostButton, inputClass } from './ui';
import { isTaskList, type ShoppingList } from '../data/model';
import type { GoogleTasksLink } from '../data/googleTasks';

/**
 * "Google Tasks" in Settings: connect from a tap, then choose which Google list feeds which list.
 * Shopping lists get new tasks added straight away; to-do lists get them offered first.
 */
export function GoogleTasksSettings({
  auth,
  lists,
  links,
  onSave,
  onConnected,
}: {
  auth: Auth;
  lists: ShoppingList[];
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
    const target = lists.find((l) => l.id === listId);
    const next = target ? [...others, { googleListId: list.id, title: list.title, listId, mode: isTaskList(target.icon) ? ('suggest' as const) : ('add' as const) }] : others;
    onSave(next).catch(() => setError("Couldn't save. Try again."));
  }

  const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? 'a removed list';
  const what = (l: GoogleTasksLink) => (l.mode === 'add' ? `New tasks in ${l.title} go straight onto ${listName(l.listId)}.` : `New tasks in ${l.title} are offered for ${listName(l.listId)}.`);

  return (
    <section aria-label="Google Tasks" className="grid gap-2">
      <p className="text-sm font-semibold">Google Tasks</p>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        Things you ask the Gemini app or Google Assistant to add to a list land in Google Tasks. Tasks can bring them in. It checks when it opens or comes back
        into view, for an hour after you connect on this device.
      </p>
      {links.length > 0 && (
        <ul className="grid gap-1 text-sm text-stone-700 dark:text-stone-200">
          {links.map((l) => (
            <li key={l.googleListId}>{what(l)}</li>
          ))}
        </ul>
      )}
      {googleLists === null ? (
        <button type="button" onClick={() => void connect()} disabled={busy} className={`${ghostButton} justify-self-start border border-stone-200 dark:border-forest-600`}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ListTodo size={18} />} {links.length ? 'Connect again and check now' : 'Connect Google Tasks'}
        </button>
      ) : googleLists.length === 0 ? (
        <p className="text-sm text-stone-600 dark:text-stone-300">Your Google account has no task lists yet.</p>
      ) : (
        <div className="grid gap-2">
          {googleLists.map((g) => (
            <label key={g.id} className="grid gap-1 text-sm text-stone-600 dark:text-stone-300">
              {g.title}
              <select
                className={inputClass}
                value={links.find((l) => l.googleListId === g.id)?.listId ?? ''}
                onChange={(e) => choose(g, e.target.value)}
                aria-label={`Bring ${g.title} into`}
              >
                <option value="">Leave in Google Tasks</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {isTaskList(l.icon) ? `Offer for ${l.name}` : `Add to ${l.name}`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
