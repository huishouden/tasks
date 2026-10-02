import { describe, expect, it } from 'vitest';
import { parsePlaces, placeLabel, shortStreet } from '../../src/data/places';
import { CATEGORIES as C, URGENCY, type ListItem } from '../../src/data/model';
import { aisleLabel, compareAisles, groupWithAisles } from '../../src/data/stores';

describe('shortStreet', () => {
  it.each([
    ['West Main Street', 'Main St'],
    ['N Federal Highway', 'Federal Hwy'],
    ['Park Avenue', 'Park Ave'],
    ['', ''],
  ])('%s → %s', (input, expected) => expect(shortStreet(input)).toBe(expected));
});

describe('parsePlaces', () => {
  it('names places by brand, with a short street, nearest first', () => {
    const here = { lat: 39.7392, lng: -104.9903 };
    const places = parsePlaces(
      {
        elements: [
          { type: 'way', id: 2, center: { lat: 39.7400, lon: -104.9903 }, tags: { shop: 'supermarket', name: 'Publix Super Market', brand: 'Publix', 'addr:street': 'West Main Street', 'addr:housenumber': '10' } },
          { type: 'node', id: 1, lat: 39.7393, lon: -104.9903, tags: { shop: 'convenience', name: 'Corner Shop' } },
          { type: 'node', id: 3, lat: 39.74, lon: -104.99, tags: { shop: 'supermarket' } },
        ],
      },
      here,
    );
    expect(places.map((p) => placeLabel(p))).toEqual(['Corner Shop', 'Publix · Main St']);
    expect(places[1]).toMatchObject({ osmId: 'way/2', address: '10 West Main Street' });
  });
});

describe('aisles', () => {
  it('sorts numerically, then named areas', () => {
    expect(['Deli', '10', '2', 'Bakery', '2B'].sort(compareAisles)).toEqual(['2', '2B', '10', 'Bakery', 'Deli']);
  });

  it('labels numbers as aisles and keeps words as typed', () => {
    expect(aisleLabel('12')).toBe('Aisle 12');
    expect(aisleLabel('3b')).toBe('Aisle 3B');
    expect(aisleLabel('Back wall')).toBe('Back wall');
  });

  it('groups learned items by aisle first, the rest by section', () => {
    const item = (name: string, category: ListItem['category']): ListItem => ({ id: name, listId: 'g', name, category, quantity: '1', notes: '', addedBy: '', completed: false, urgency: URGENCY.NORMAL, createdAt: 0, updatedAt: 0, completedAt: null });
    const groups = groupWithAisles(
      [item('Milk', C.DAIRY_EGGS), item('Apples', C.PRODUCE), item('Cereal', C.PANTRY), item('Yogurt', C.DAIRY_EGGS)],
      new Map([['milk', '12'], ['cereal', '4']]),
    );
    expect(groups.map((g) => [g.title, g.items.map((i) => i.name)])).toEqual([
      ['Aisle 4', ['Cereal']],
      ['Aisle 12', ['Milk']],
      ['Produce & Greens', ['Apples']],
      ['Dairy & Eggs', ['Yogurt']],
    ]);
  });
});
