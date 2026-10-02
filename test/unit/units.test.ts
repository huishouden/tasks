import { describe, expect, test } from 'vitest';
import { formatDistance, usesMiles } from '../../src/lib/units';

describe('distances follow the device region', () => {
  test('miles in the US and UK, from the language tag or its likely region', () => {
    expect(usesMiles('en-US')).toBe(true);
    expect(usesMiles('en')).toBe(true); // English without a region is most likely the US
    expect(usesMiles('en-GB')).toBe(true);
    expect(usesMiles('es-US')).toBe(true);
    expect(usesMiles('nl-NL')).toBe(false);
    expect(usesMiles('en-CA')).toBe(false);
    expect(usesMiles('not a locale')).toBe(false);
  });
  test('formats', () => {
    expect(formatDistance(0.8, 'en-US')).toBe('0.5 mi');
    expect(formatDistance(30, 'en-US')).toBe('19 mi');
    expect(formatDistance(0.65, 'nl-NL')).toBe('650 m');
    expect(formatDistance(3.14, 'de-DE')).toBe('3.1 km');
  });
});
