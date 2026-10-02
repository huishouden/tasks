import { describe, expect, it } from 'vitest';
import { AISLE_ORDER, CATEGORIES, URGENCY, type ListItem } from '../../src/data/model';
import { distanceMeters, fullCategoryOrder, groupForStore, nearestStore, type StoreLayout } from '../../src/data/stores';

function item(name: string, category: ListItem['category']): ListItem {
  return { id: name, listId: 'g', name, category, quantity: '1', notes: '', addedBy: '', completed: false, urgency: URGENCY.NORMAL, createdAt: 0, updatedAt: 0, completedAt: null };
}

function store(name: string, location: StoreLayout['location'], categoryOrder: StoreLayout['categoryOrder'] = []): StoreLayout {
  return { id: name, name, categoryOrder, aisleLabels: {}, location, createdAt: 0 };
}

describe('fullCategoryOrder', () => {
  it('puts the saved order first and fills in the rest in typical order', () => {
    const order = fullCategoryOrder([CATEGORIES.FROZEN, CATEGORIES.DAIRY_EGGS]);
    expect(order.slice(0, 3)).toEqual([CATEGORIES.FROZEN, CATEGORIES.DAIRY_EGGS, CATEGORIES.PRODUCE]);
    expect([...order].sort()).toEqual([...AISLE_ORDER].sort());
  });

  it('ignores unknown and duplicate sections', () => {
    expect(fullCategoryOrder(['Nope' as never, CATEGORIES.BAKERY, CATEGORIES.BAKERY])[0]).toBe(CATEGORIES.BAKERY);
    expect(fullCategoryOrder(['Nope' as never]).length).toBe(AISLE_ORDER.length);
  });
});

describe('groupForStore', () => {
  it('groups in the store walking order', () => {
    const groups = groupForStore(
      [item('Milk', CATEGORIES.DAIRY_EGGS), item('Peas', CATEGORIES.FROZEN), item('Apples', CATEGORIES.PRODUCE)],
      [CATEGORIES.FROZEN, CATEGORIES.DAIRY_EGGS],
    );
    expect(groups.map(([c]) => c)).toEqual([CATEGORIES.FROZEN, CATEGORIES.DAIRY_EGGS, CATEGORIES.PRODUCE]);
  });
});

describe('nearestStore', () => {
  // Two points about 1.1 km apart on the same street in Denver.
  const publix = store('Publix', { lat: 39.7392, lng: -104.9903 });
  const target = store('Target', { lat: 39.7392, lng: -104.9774 });

  it('measures distance in metres', () => {
    expect(distanceMeters(publix.location!, target.location!)).toBeGreaterThan(1000);
    expect(distanceMeters(publix.location!, target.location!)).toBeLessThan(1200);
  });

  it('picks the closest store within 400 m, and none when far from all', () => {
    expect(nearestStore([publix, target], { lat: 39.7394, lng: -104.9901 })?.name).toBe('Publix');
    expect(nearestStore([publix, target], { lat: 39.7392, lng: -104.9776 })?.name).toBe('Target');
    expect(nearestStore([publix, target], { lat: 39.76, lng: -105.01 })).toBeNull();
  });

  it('skips stores without a saved location', () => {
    expect(nearestStore([store('Costco', null)], { lat: 0, lng: 0 })).toBeNull();
  });
});
