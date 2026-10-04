import { getHome, homePoint, type HouseholdHome } from '@huishouden/pwa-kit/home';
import type { NearPoint } from '@huishouden/pwa-kit/places';

/** A position from the device: latitude and longitude in degrees. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

declare global {
  interface Window {
    /** Browser tests stand in for the device's position. */
    __mockPosition?: { lat: number; lon: number };
  }
}

/** Whether location may be read without asking ('granted'), would ask ('prompt'), or is off. */
export async function locationPermission(): Promise<PermissionState | 'unsupported'> {
  if (window.__mockPosition) return 'granted';
  if (!('geolocation' in navigator)) return 'unsupported';
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return 'prompt';
  }
}

/**
 * Where the device is now. Asks for permission the first time; read only on demand or when the
 * app comes to the foreground, never stored (DESIGN.md, "Use where you are").
 */
export function currentPosition({ fresh = false }: { fresh?: boolean } = {}): Promise<GeoPoint> {
  if (window.__mockPosition) return Promise.resolve({ lat: window.__mockPosition.lat, lng: window.__mockPosition.lon });
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), reject, {
      enableHighAccuracy: fresh,
      timeout: 10_000,
      maximumAge: fresh ? 0 : 60_000,
    }),
  );
}

/** Where a nearby search is centred: the device ("Near you") or the household's home ("Near home"). */
export interface SearchCentre {
  point: NearPoint;
  from: 'here' | 'home';
  /** With `from: 'home'`: whether a tap could still ask for the device's position (it isn't off or missing). */
  canAsk: boolean;
}

/** Location is off or missing on this device and the household has no home to search from. */
export class LocationOff extends Error {
  constructor() {
    super('Location is off and the household has no home');
    this.name = 'LocationOff';
  }
}

/**
 * Where "Find nearby" looks. The device's position when location is already allowed; otherwise the
 * household's home, without asking. `ask` (a tap on "Use my location") asks for the position even
 * when there is a home. With no home, asks as before; `LocationOff` when location is off as well.
 * A position that can't be read falls back to home too.
 */
export async function searchCentre({ ask = false, home = getHome() }: { ask?: boolean; home?: HouseholdHome } = {}): Promise<SearchCentre> {
  const permission = await locationPermission();
  const atHome = homePoint(home);
  const canAsk = permission === 'granted' || permission === 'prompt';
  if (permission === 'granted' || (permission === 'prompt' && (ask || !atHome))) {
    try {
      const here = await currentPosition();
      return { point: { lat: here.lat, lon: here.lng }, from: 'here', canAsk };
    } catch (e) {
      if (!atHome) throw (e as GeolocationPositionError)?.code === 1 ? new LocationOff() : e;
      // Denied at the prompt: home from now on, and no button that would only be refused again.
      return { point: atHome, from: 'home', canAsk: canAsk && (e as GeolocationPositionError)?.code !== 1 };
    }
  }
  if (atHome) return { point: atHome, from: 'home', canAsk };
  throw new LocationOff();
}
