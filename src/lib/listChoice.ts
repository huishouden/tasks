/**
 * Which list is on screen, from the address (`?list=`) and this device's remembered list, and what
 * to do about either. The address wins when it names a list the household has, or one the person
 * just chose (a new list is missing until its snapshot arrives); a stale or foreign id (the sample's
 * list after signing in, a deleted list from an old link) is corrected in the address and never
 * remembered. Before the lists load, nothing is remembered or corrected.
 */
export interface ListChoice {
  /** The list to show (the app falls back to the first when it is missing). */
  shown: string;
  /** Remember this as the device's list, or null. */
  save: string | null;
  /** Write this into the address in place (no history entry), or null. */
  address: string | null;
}

export function listChoice(url: string | null, saved: string, ids: readonly string[] | null, chosen: string | null = null): ListChoice {
  if (!ids) return { shown: url ?? saved, save: null, address: url ? null : saved };
  if (url && (ids.includes(url) || url === chosen)) return { shown: url, save: url !== saved && ids.includes(url) ? url : null, address: null };
  const shown = ids.includes(saved) ? saved : (ids[0] ?? saved);
  return { shown, save: null, address: ids.length && url !== shown ? shown : null };
}
