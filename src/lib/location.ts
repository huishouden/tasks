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
