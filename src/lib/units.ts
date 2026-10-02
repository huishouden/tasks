/** Regions whose people think in miles and feet for distances (road signs, maps). */
const MILES_REGIONS = new Set(['US', 'GB', 'LR', 'MM']);

/** The device's region from its language ("en-US" → "US"; "en" → its likely region). */
function region(locale: string): string | undefined {
  try {
    return new Intl.Locale(locale).maximize().region;
  } catch {
    return undefined;
  }
}

export function usesMiles(locale: string = navigator.language): boolean {
  return MILES_REGIONS.has(region(locale) ?? '');
}

/** "0.5 mi", "12 mi" where miles are used; "650 m", "3.1 km" elsewhere. */
export function formatDistance(km: number, locale: string = navigator.language): string {
  if (usesMiles(locale)) {
    const mi = km / 1.609344;
    return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  return km < 1 ? `${Math.round(km * 100) * 10} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
