import { AISLE_ORDER, CATEGORIES, sortItems, type Category, type ListItem } from './model';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface StoreLayout {
  id: string;
  name: string;
  /** Sections in the order this store is walked. Sections missing here follow in the typical order. */
  categoryOrder: Category[];
  /** Optional label per section, e.g. "Aisle 12" or "Back wall". */
  aisleLabels: Partial<Record<Category, string>>;
  location?: GeoPoint | null;
  /** The OpenStreetMap shop this was created from, if detected rather than typed. */
  osmId?: string | null;
  address?: string;
  createdAt: number;
}

/** An item's aisle at one store, learned from what someone typed while shopping. */
export interface LearnedAisle {
  id: string;
  aisle: string;
  name: string;
  updatedAt: number;
  updatedBy: string;
}

/** Numbers sort numerically ("Aisle 2" before "Aisle 10"); words like "Deli" follow, alphabetically. */
export function compareAisles(a: string, b: string): number {
  const na = parseInt(a.replace(/\D+/g, ''), 10);
  const nb = parseInt(b.replace(/\D+/g, ''), 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  if (!isNaN(na) !== !isNaN(nb)) return isNaN(na) ? 1 : -1;
  return a.localeCompare(b, undefined, { numeric: true });
}

/** "12" → "Aisle 12"; anything with letters ("Deli", "Back wall") is kept as typed. */
export function aisleLabel(aisle: string): string {
  const t = aisle.trim();
  return /^\d+[a-z]?$/i.test(t) ? `Aisle ${t.toUpperCase()}` : t;
}

export type StoreGroup = { key: string; title: string; label?: string; items: ListItem[] };

/**
 * Items walked in store order: those with a learned aisle grouped by aisle (numeric order),
 * then the rest by section in the store's walking order.
 */
export function groupWithAisles(items: ListItem[], aisles: Map<string, string>, order?: Category[], sectionLabels?: Partial<Record<Category, string>>, keyOf: (name: string) => string = (n) => n.toLowerCase()): StoreGroup[] {
  const byAisle = new Map<string, ListItem[]>();
  const rest: ListItem[] = [];
  for (const item of items) {
    const aisle = aisles.get(keyOf(item.name));
    if (aisle) byAisle.set(aisle, [...(byAisle.get(aisle) ?? []), item]);
    else rest.push(item);
  }
  const aisleGroups = [...byAisle.keys()].sort(compareAisles).map((a) => ({ key: `aisle:${a}`, title: aisleLabel(a), items: sortItems(byAisle.get(a)!) }));
  const sectionGroups = groupForStore(rest, order).map(([c, group]) => ({ key: `section:${c}`, title: c, label: sectionLabels?.[c], items: group }));
  return [...aisleGroups, ...sectionGroups];
}

/** A store's full walking order: its saved order first, then any sections it does not mention. */
export function fullCategoryOrder(saved: Category[] | undefined): Category[] {
  const known = (saved ?? []).filter((c, i, all) => AISLE_ORDER.includes(c) && all.indexOf(c) === i);
  return [...known, ...AISLE_ORDER.filter((c) => !known.includes(c))];
}

/** Items grouped by section in the given walking order; unknown categories go under Other. */
export function groupForStore(items: ListItem[], order: Category[] = AISLE_ORDER): [Category, ListItem[]][] {
  const full = fullCategoryOrder(order);
  const groups = new Map<Category, ListItem[]>();
  for (const item of items) {
    const key = full.includes(item.category) ? item.category : CATEGORIES.OTHER;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return full.filter((c) => groups.has(c)).map((c) => [c, sortItems(groups.get(c)!)]);
}

/** Great-circle distance in metres. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * The closest saved store within `maxMeters`. 400 m covers a large store and its car park while
 * staying clear of a different store across the road in most plazas.
 */
export function nearestStore(stores: StoreLayout[], here: GeoPoint, maxMeters = 400): StoreLayout | null {
  let best: { store: StoreLayout; d: number } | null = null;
  for (const store of stores) {
    if (!store.location) continue;
    const d = distanceMeters(here, store.location);
    if (d <= maxMeters && (!best || d < best.d)) best = { store, d };
  }
  return best?.store ?? null;
}
