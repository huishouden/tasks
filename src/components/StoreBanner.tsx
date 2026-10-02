import { useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, ShoppingCart, X } from 'lucide-react';
import { nearbyPlaces, placeLabel, type NearbyPlace } from '../data/places';
import { nearestStore, type StoreLayout } from '../data/stores';
import { currentPosition, locationPermission } from '../lib/location';
import { usePref } from '../lib/prefs';

const SNOOZE_MS = 12 * 60 * 60 * 1000;
const DONE_SHOPPING_SNOOZE_MS = 3 * 60 * 60 * 1000;

interface Props {
  stores: StoreLayout[];
  activeStore: StoreLayout | null;
  onUseStore: (id: string) => void;
  onCreateFromPlace: (place: NearbyPlace) => void;
  onEnd: () => void;
}

/**
 * One slim line above the list. Never blocks the list: it either names the store you are
 * shopping at, asks once whether you are at a detected shop, or offers to detect one.
 */
export function StoreBanner({ stores, activeStore, onUseStore, onCreateFromPlace, onEnd }: Props) {
  const [snoozed, setSnoozed] = usePref<Record<string, number>>('snoozedPlaces', {});
  const [candidate, setCandidate] = useState<NearbyPlace | null>(null);
  const [permission, setPermission] = useState<PermissionState | 'unsupported' | null>(null);
  const [looking, setLooking] = useState(false);

  const detect = useCallback(async () => {
    setLooking(true);
    try {
      const here = await currentPosition({ fresh: true });
      setPermission('granted');
      const now = Date.now();
      const saved = nearestStore(stores, here);
      if (saved) {
        // A store you just finished shopping at is not picked again while you walk out of it,
        // and not offered again as a new place either.
        if (!(snoozed[`store:${saved.id}`] > now)) onUseStore(saved.id);
        return;
      }
      // Shops already saved as stores come back from OpenStreetMap too; never offer them as new.
      const savedPlaces = new Set(stores.map((st) => st.osmId).filter(Boolean));
      const place = (await nearbyPlaces(here)).find((p) => !savedPlaces.has(p.osmId) && !(snoozed[p.osmId] > now));
      setCandidate(place ?? null);
    } catch {
      // No fix or no network: stay quiet rather than show an error mid-shop.
      setPermission(await locationPermission());
    } finally {
      setLooking(false);
    }
  }, [stores, snoozed, onUseStore]);

  // Checks again whenever the app comes back to the foreground (phone pulled out at the store,
  // or the kitchen tablet woken). Reading the permission is cheap and always done; the location
  // lookup itself runs at most once a minute.
  const lastLookup = useRef(0);
  const detectRef = useRef(detect);
  detectRef.current = detect;
  useEffect(() => {
    if (activeStore) return;
    const check = () => {
      void locationPermission().then((state) => {
        setPermission(state);
        if (state !== 'granted' || Date.now() - lastLookup.current < 60_000) return;
        lastLookup.current = Date.now();
        void detectRef.current();
      });
    };
    check();
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeStore, stores.length]);

  const line = 'flex items-center gap-2 rounded-2xl px-3 py-2 text-sm';

  if (activeStore) {
    return (
      <div role="status" className={`${line} bg-forest-50 text-forest-800 dark:bg-forest-800 dark:text-forest-100`}>
        <ShoppingCart size={16} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          Shopping at <strong>{activeStore.name}</strong>. Check items off and add their aisle if you like.
        </span>
        <button
          onClick={() => {
            setSnoozed({ ...snoozed, [`store:${activeStore.id}`]: Date.now() + DONE_SHOPPING_SNOOZE_MS });
            onEnd();
          }}
          className="shrink-0 rounded-lg px-2 py-1 font-medium hover:bg-forest-100 dark:hover:bg-forest-700"
        >
          Done shopping
        </button>
      </div>
    );
  }

  if (candidate) {
    const label = placeLabel(candidate);
    return (
      <div role="region" aria-label="Detected store" className={`${line} border border-forest-200 bg-white dark:border-forest-600 dark:bg-forest-800`}>
        <MapPin size={16} className="shrink-0 text-forest-600" />
        <span className="min-w-0 flex-1">
          At <strong>{label}</strong>?
        </span>
        <button
          onClick={() => {
            onCreateFromPlace(candidate);
            setCandidate(null);
          }}
          className="shrink-0 rounded-lg bg-forest-700 px-3 py-1 font-semibold text-white dark:bg-forest-400 dark:text-forest-900"
        >
          Yes
        </button>
        <button
          onClick={() => {
            setSnoozed({ ...snoozed, [candidate.osmId]: Date.now() + SNOOZE_MS });
            setCandidate(null);
          }}
          className="shrink-0 rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-forest-700"
          aria-label={`Not at ${label}`}
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  if (permission === 'prompt') {
    return (
      <button onClick={() => void detect()} disabled={looking} className="inline-flex items-center gap-1.5 self-start text-sm text-stone-500 hover:text-forest-700">
        <LocateFixed size={14} className={looking ? 'animate-pulse' : ''} /> {looking ? 'Looking…' : 'At a store? Detect it to learn aisles'}
      </button>
    );
  }
  return null;
}
