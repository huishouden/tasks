import { GROCERIES_PATH } from '../data/model';

/** Tasks' old screens that are Groceries' now: Kitchen, Store and Meals. */
const MOVED_MODES = ['hub', 'store', 'meals'];

/**
 * Where an old Tasks link to something that moved to Huishouden Groceries goes now, query kept
 * (bookmarks, manifest shortcuts, agenda entries and reminders made before the split), or null when
 * it stays in Tasks. `shoppingLists` are the household's shopping list ids, once known.
 */
export function groceriesRedirect(search: string, shoppingLists: ReadonlySet<string> = new Set()): string | null {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  const list = params.get('list');
  if ((mode && MOVED_MODES.includes(mode)) || (list && shoppingLists.has(list))) return `${GROCERIES_PATH}${search}`;
  return null;
}
