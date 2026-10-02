import { distanceMeters, type GeoPoint } from './stores';

/** A shop found near the user in OpenStreetMap. */
export interface NearbyPlace {
  osmId: string;
  name: string;
  /** Short street, e.g. "Main St", used to tell branches of a chain apart. */
  street: string;
  address: string;
  location: GeoPoint;
  distance: number;
}

const SHOP_TYPES = 'supermarket|grocery|greengrocer|wholesale|convenience|department_store|hardware|doityourself|chemist|butcher|bakery';

const STREET_WORDS: [RegExp, string][] = [
  [/\b(north|south|east|west|n|s|e|w)\b\.?\s+/i, ''],
  [/\broad\b/i, 'Rd'],
  [/\bstreet\b/i, 'St'],
  [/\bavenue\b/i, 'Ave'],
  [/\bboulevard\b/i, 'Blvd'],
  [/\bhighway\b/i, 'Hwy'],
  [/\bdrive\b/i, 'Dr'],
  [/\blane\b/i, 'Ln'],
  [/\bparkway\b/i, 'Pkwy'],
];

/** "West Main Street" → "Main St". */
export function shortStreet(street: string): string {
  let s = street.trim();
  for (const [re, to] of STREET_WORDS) s = s.replace(re, to);
  return s.replace(/\s+/g, ' ').trim();
}

/** What the household sees: "Corner Grocer · Main St". */
export function placeLabel(place: Pick<NearbyPlace, 'name' | 'street'>): string {
  return place.street ? `${place.name} · ${place.street}` : place.name;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Parses Overpass JSON into named places, nearest first. */
export function parsePlaces(json: { elements?: OverpassElement[] }, here: GeoPoint): NearbyPlace[] {
  const places: NearbyPlace[] = [];
  for (const e of json.elements ?? []) {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    const name = t.brand || t.name;
    if (!name || lat === undefined || lon === undefined) continue;
    const street = shortStreet(t['addr:street'] ?? '');
    const location = { lat, lng: lon };
    places.push({
      osmId: `${e.type}/${e.id}`,
      name,
      street,
      address: [t['addr:housenumber'], t['addr:street'], t['addr:city']].filter(Boolean).join(' '),
      location,
      distance: distanceMeters(here, location),
    });
  }
  return places.sort((a, b) => a.distance - b.distance);
}

/**
 * Shops within `radius` metres, from OpenStreetMap's free Overpass API (no key, CORS-enabled).
 * 150 m covers a store's car park; the caller treats a failure as "nothing found".
 */
export async function nearbyPlaces(here: GeoPoint, radius = 150): Promise<NearbyPlace[]> {
  const query = `[out:json][timeout:10];nwr(around:${radius},${here.lat},${here.lng})["shop"~"^(${SHOP_TYPES})$"];out center tags 10;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`[${res.status}] OpenStreetMap lookup failed`);
  return parsePlaces(await res.json(), here);
}
