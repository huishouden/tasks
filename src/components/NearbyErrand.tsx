import { useEffect, useRef, useState } from 'react';
import { Check, MapPin, X } from 'lucide-react';
import type { ListItem } from '../data/model';
import { distanceMeters } from '../data/stores';
import { currentPosition, locationPermission } from '../lib/location';
import { usePref } from '../lib/prefs';

/** Close enough to stop in: a car park, or across the street. */
const NEAR_METERS = 250;
const SNOOZE_MS = 3 * 60 * 60 * 1000;

/**
 * One slim line when you open the app next to the place of an unfinished errand ("Near Example
 * Cleaners: Drycleaners dropoff"). Reads location only when it is already allowed, when the app
 * comes to the foreground, at most once a minute; it never asks by itself.
 */
export function NearbyErrand({ items, onDone }: { items: ListItem[]; onDone: (item: ListItem) => void }) {
  const [snoozed, setSnoozed] = usePref<Record<string, number>>('snoozedErrands', {});
  const [near, setNear] = useState<ListItem[]>([]);
  const errands = items.filter((i) => !i.completed && i.place);
  const errandsRef = useRef(errands);
  errandsRef.current = errands;
  const lastLookup = useRef(0);
  const hasErrands = errands.length > 0;

  useEffect(() => {
    if (!hasErrands) return;
    const check = async () => {
      if (Date.now() - lastLookup.current < 60_000 || (await locationPermission()) !== 'granted') return;
      lastLookup.current = Date.now();
      try {
        const here = await currentPosition();
        setNear(
          errandsRef.current
            .map((i) => ({ i, d: distanceMeters(here, { lat: i.place!.lat, lng: i.place!.lon }) }))
            .filter((x) => x.d <= NEAR_METERS)
            .sort((a, b) => a.d - b.d)
            .map((x) => x.i),
        );
      } catch {
        // No fix: say nothing.
      }
    };
    void check();
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [hasErrands]);

  const now = Date.now();
  const item = near.find((i) => !i.completed && items.some((x) => x.id === i.id && !x.completed) && !(snoozed[i.id] > now));
  if (!item) return null;
  const others = near.filter((i) => i.id !== item.id && !(snoozed[i.id] > now)).length;
  return (
    <div role="status" aria-label="Nearby errand" className="flex items-center gap-2 rounded-2xl border border-forest-200 bg-white px-3 py-2 text-sm dark:border-forest-600 dark:bg-forest-800">
      <MapPin size={16} className="shrink-0 text-forest-600" />
      <span className="min-w-0 flex-1">
        Near <strong>{item.place!.name}</strong>: {item.name}
        {others > 0 && <span className="text-stone-500"> and {others} more</span>}
      </span>
      <button onClick={() => onDone(item)} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-forest-700 px-3 font-semibold text-white dark:bg-forest-400 dark:text-forest-900">
        <Check size={14} /> Done
      </button>
      <button
        onClick={() => {
          // Keep only snoozes still running, so the stored list does not grow forever.
          const t = Date.now();
          const live = Object.fromEntries(Object.entries(snoozed).filter(([, until]) => until > t));
          setSnoozed({ ...live, [item.id]: t + SNOOZE_MS });
        }}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-forest-700"
        aria-label={`Not now: ${item.name}`}
      >
        <X size={16} />
      </button>
    </div>
  );
}
