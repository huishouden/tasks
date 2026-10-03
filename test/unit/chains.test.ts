import { describe, expect, it } from 'vitest';
import { CHAINS, chainFor, cleanItemQuery, normalizeStoreName, storeSearchLink, storeSearchLinks } from '../../src/data/chains';

describe('chainFor', () => {
  it.each([
    ['Publix', 'publix'],
    ['Publix Super Market', 'publix'],
    ['Publix Super Market at Main Street', 'publix'],
    ['Publix · Main St', 'publix'],
    ['Walmart Supercenter', 'walmart'],
    ['Wal-Mart Neighborhood Market', 'walmart'],
    ['Costco Wholesale', 'costco'],
    ['Whole Foods Market', 'whole-foods'],
    ['H-E-B plus!', 'heb'],
    ['HEB', 'heb'],
    ['SuperTarget', null],
    ['Super Target', 'target'],
    ['Safeway', 'safeway'],
    ['Jewel-Osco', 'jewel-osco'],
    ["Trader Joe's", 'trader-joes'],
    ["Pick 'n Save", 'pick-n-save'],
    ['Stop & Shop', 'stop-and-shop'],
    ['Hy-Vee', 'hy-vee'],
    ["Smith's Food and Drug", 'smiths'],
    ['Giant Eagle', 'giant-eagle'],
    ["Sam's Club", 'sams-club'],
    ['Kroger Marketplace', 'kroger'],
    ['Harris Teeter', 'harris-teeter'],
  ])('%s → %s', (name, id) => {
    expect(chainFor(name)?.id ?? null).toBe(id);
  });

  it('matches whole words only, so a shop that merely contains a chain name is not that chain', () => {
    expect(chainFor('Targetville Hardware')).toBeNull();
    expect(chainFor('Publixia Deli')).toBeNull();
    expect(chainFor('Corner Grocer')).toBeNull();
  });

  it('has a search template with exactly one {q} for every chain', () => {
    for (const chain of CHAINS) {
      expect(chain.search.split('{q}')).toHaveLength(2);
      expect(chain.search).toMatch(/^https:\/\//);
      for (const n of chain.names) expect(normalizeStoreName(n)).toBe(n);
    }
    expect(new Set(CHAINS.map((c) => c.id)).size).toBe(CHAINS.length);
  });
});

describe('cleanItemQuery', () => {
  it.each([
    ['2 lb queso ecuatoriano', 'queso ecuatoriano'],
    ['2lbs chicken thighs', 'chicken thighs'],
    ['1/2 gallon whole milk', 'whole milk'],
    ['½ lb ham', 'ham'],
    ['a dozen eggs', 'eggs'],
    ['dozen eggs', 'eggs'],
    ['3 cans of black beans', 'black beans'],
    ['2 bananas', 'bananas'],
    ['Milk x2', 'Milk'],
    ['chicken thighs 2 lbs', 'chicken thighs'],
    ['Eggs (a dozen)', 'Eggs'],
    ['Queso fresco - the soft one', 'Queso fresco'],
    ['Bread, whole wheat if they have it', 'Bread'],
    ['2% milk', '2% milk'],
    ['7up', '7up'],
    ['Box fan', 'Box fan'],
    ['Jalapeños', 'Jalapeños'],
    ['  queso   ecuatoriano ', 'queso ecuatoriano'],
  ])('%s → %s', (name, query) => {
    expect(cleanItemQuery(name)).toBe(query);
  });
});

describe('storeSearchLink', () => {
  it("opens the chain's own search with the item filled in", () => {
    expect(storeSearchLink('Publix Super Market · Main St', '2 lb queso ecuatoriano')).toEqual({
      store: 'Publix',
      url: 'https://www.publix.com/search?searchTerm=queso%20ecuatoriano',
      storeSite: true,
    });
    expect(storeSearchLink('Safeway', 'Ben & Jerry’s')?.url).toBe('https://www.safeway.com/shop/search-results.html?q=Ben%20%26%20Jerry%E2%80%99s');
  });

  it('puts the item in the path for stores that search that way', () => {
    expect(storeSearchLink('Food Lion', 'queso ecuatoriano')?.url).toBe('https://www.foodlion.com/product-search/queso%20ecuatoriano');
  });

  it('searches the web for the item at a store it does not know', () => {
    expect(storeSearchLink('Corner Grocer · Main St', 'queso ecuatoriano')).toEqual({
      store: 'Corner Grocer',
      url: `https://www.google.com/search?q=${encodeURIComponent('"queso ecuatoriano" Corner Grocer')}`,
      storeSite: false,
    });
  });

  it('gives nothing for an empty name', () => {
    expect(storeSearchLink('Publix', '  ')).toBeNull();
    expect(storeSearchLink('', 'milk')).toBeNull();
  });
});

describe('storeSearchLinks', () => {
  it('gives one link per chain, in the order given', () => {
    const links = storeSearchLinks(['Publix · Main St', 'Corner Grocer', 'Publix · Oak Ave', 'Costco Wholesale'], 'milk');
    expect(links.map((l) => l.store)).toEqual(['Publix', 'Corner Grocer', 'Costco']);
  });
});
