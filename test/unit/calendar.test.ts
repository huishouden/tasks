import { describe, expect, it } from 'vitest';
import { searchPhrases } from '../../src/lib/calendar';

describe('searchPhrases', () => {
  it('drops task words and tries the most specific phrase first', () => {
    expect(searchPhrases('Get car seat checked at fire station')).toEqual(['car seat fire station', 'car seat', 'seat fire', 'fire station']);
  });

  it('falls back to the longest word for one-word topics', () => {
    expect(searchPhrases('Book dentist appointment')).toEqual(['dentist']);
  });

  it('returns nothing when only task words remain', () => {
    expect(searchPhrases('Call and confirm')).toEqual([]);
  });
});
