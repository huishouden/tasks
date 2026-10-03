/**
 * Store chains whose own website search can show where an item is (and, in the store's app, its
 * aisle). Each template was opened in a real browser and showed results for a common item; add a
 * chain only after doing the same. `{q}` is replaced with the URL-encoded item name.
 */
export interface Chain {
  id: string;
  /** What the link says: "Find at Publix". */
  name: string;
  /** Store names that mean this chain, compared as whole words after normalising (see `normalizeStoreName`). */
  names: string[];
  search: string;
}

export const CHAINS: Chain[] = [
  { id: "publix", name: "Publix", names: ["publix"], search: "https://www.publix.com/search?searchTerm={q}" },
  { id: "target", name: "Target", names: ["target", "super target"], search: "https://www.target.com/s?searchTerm={q}" },
  { id: "walmart", name: "Walmart", names: ["walmart"], search: "https://www.walmart.com/search?q={q}" },
  { id: "costco", name: "Costco", names: ["costco"], search: "https://www.costco.com/s?keyword={q}" },
  { id: "sams-club", name: "Sam's Club", names: ["sams club"], search: "https://www.samsclub.com/s/{q}" },
  { id: "bjs", name: "BJ's", names: ["bjs", "bjs wholesale"], search: "https://www.bjs.com/search/{q}/q" },
  { id: "whole-foods", name: "Whole Foods", names: ["whole foods"], search: "https://www.wholefoodsmarket.com/search?text={q}" },
  { id: "heb", name: "H-E-B", names: ["heb", "h e b"], search: "https://www.heb.com/search?q={q}" },
  { id: "aldi", name: "Aldi", names: ["aldi"], search: "https://www.aldi.us/store/aldi/s?k={q}" },
  { id: "trader-joes", name: "Trader Joe's", names: ["trader joes"], search: "https://www.traderjoes.com/home/search?q={q}&section=products" },
  { id: "wegmans", name: "Wegmans", names: ["wegmans"], search: "https://www.wegmans.com/shop/search?query={q}" },
  { id: "sprouts", name: "Sprouts", names: ["sprouts"], search: "https://shop.sprouts.com/store/sprouts/s?k={q}" },
  { id: "meijer", name: "Meijer", names: ["meijer"], search: "https://www.meijer.com/shopping/search.html?text={q}" },
  { id: "hy-vee", name: "Hy-Vee", names: ["hyvee", "hy vee"], search: "https://www.hy-vee.com/aisles-online/search?search={q}" },
  { id: "giant-eagle", name: "Giant Eagle", names: ["giant eagle"], search: "https://www.gianteagle.com/grocery/search?q={q}" },
  { id: "fresh-market", name: "The Fresh Market", names: ["the fresh market"], search: "https://www.thefreshmarket.com/search?q={q}" },
  // Ahold Delhaize stores share one site design.
  { id: "food-lion", name: "Food Lion", names: ["food lion"], search: "https://www.foodlion.com/product-search/{q}" },
  { id: "stop-and-shop", name: "Stop & Shop", names: ["stop and shop", "stop shop"], search: "https://stopandshop.com/product-search/{q}" },
  { id: "giant-food", name: "Giant", names: ["giant food"], search: "https://giantfood.com/product-search/{q}" },
  { id: "hannaford", name: "Hannaford", names: ["hannaford"], search: "https://www.hannaford.com/product-search/{q}" },
  // Kroger's stores share one site design.
  { id: "kroger", name: "Kroger", names: ["kroger"], search: "https://www.kroger.com/search?query={q}&searchType=default_search" },
  { id: "ralphs", name: "Ralphs", names: ["ralphs"], search: "https://www.ralphs.com/search?query={q}&searchType=default_search" },
  { id: "fred-meyer", name: "Fred Meyer", names: ["fred meyer"], search: "https://www.fredmeyer.com/search?query={q}&searchType=default_search" },
  { id: "king-soopers", name: "King Soopers", names: ["king soopers"], search: "https://www.kingsoopers.com/search?query={q}&searchType=default_search" },
  { id: "frys", name: "Fry's", names: ["frys food", "frys marketplace", "frys"], search: "https://www.frysfood.com/search?query={q}&searchType=default_search" },
  { id: "smiths", name: "Smith's", names: ["smiths food", "smiths marketplace"], search: "https://www.smithsfoodanddrug.com/search?query={q}&searchType=default_search" },
  { id: "qfc", name: "QFC", names: ["qfc", "quality food centers"], search: "https://www.qfc.com/search?query={q}&searchType=default_search" },
  { id: "harris-teeter", name: "Harris Teeter", names: ["harris teeter"], search: "https://www.harristeeter.com/search?query={q}&searchType=default_search" },
  { id: "dillons", name: "Dillons", names: ["dillons"], search: "https://www.dillons.com/search?query={q}&searchType=default_search" },
  { id: "marianos", name: "Mariano's", names: ["marianos"], search: "https://www.marianos.com/search?query={q}&searchType=default_search" },
  { id: "pick-n-save", name: "Pick 'n Save", names: ["pick n save"], search: "https://www.picknsave.com/search?query={q}&searchType=default_search" },
  { id: "food-4-less", name: "Food 4 Less", names: ["food 4 less", "food4less"], search: "https://www.food4less.com/search?query={q}&searchType=default_search" },
  // Albertsons' stores share one site design.
  { id: "safeway", name: "Safeway", names: ["safeway"], search: "https://www.safeway.com/shop/search-results.html?q={q}" },
  { id: "albertsons", name: "Albertsons", names: ["albertsons"], search: "https://www.albertsons.com/shop/search-results.html?q={q}" },
  { id: "vons", name: "Vons", names: ["vons"], search: "https://www.vons.com/shop/search-results.html?q={q}" },
  { id: "jewel-osco", name: "Jewel-Osco", names: ["jewelosco", "jewel osco", "jewel"], search: "https://www.jewelosco.com/shop/search-results.html?q={q}" },
  { id: "acme", name: "ACME", names: ["acme markets"], search: "https://www.acmemarkets.com/shop/search-results.html?q={q}" },
  { id: "shaws", name: "Shaw's", names: ["shaws"], search: "https://www.shaws.com/shop/search-results.html?q={q}" },
  { id: "tom-thumb", name: "Tom Thumb", names: ["tom thumb"], search: "https://www.tomthumb.com/shop/search-results.html?q={q}" },
  { id: "randalls", name: "Randalls", names: ["randalls"], search: "https://www.randalls.com/shop/search-results.html?q={q}" },
  { id: "pavilions", name: "Pavilions", names: ["pavilions"], search: "https://www.pavilions.com/shop/search-results.html?q={q}" },
  { id: "star-market", name: "Star Market", names: ["star market"], search: "https://www.starmarket.com/shop/search-results.html?q={q}" },
];

/** "H-E-B plus!" → "heb plus"; "Trader Joe's" → "trader joes"; "Publix · Main St" → "publix". */
export function normalizeStoreName(name: string): string {
  return storeDisplayName(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/(\w)[-.'’](?=\w)/g, '$1')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A saved store's name without the branch street the app adds: "Publix · Main St" → "Publix". */
export function storeDisplayName(name: string): string {
  return name.split(' · ')[0].trim();
}

/** The chain a store belongs to, from its OpenStreetMap or typed name; null when it is not one we know. */
export function chainFor(storeName: string): Chain | null {
  const name = ` ${normalizeStoreName(storeName)} `;
  for (const chain of CHAINS) {
    if (chain.names.some((n) => name.includes(` ${n} `))) return chain;
  }
  return null;
}

const NUMBER = String.raw`(?:\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|[½⅓⅔¼¾⅛]|\d+\s*[½⅓⅔¼¾⅛]|a|an|one|two|three|four|five|six|half(?:\s+a)?)`;
const UNIT = String.raw`(?:lbs?|pounds?|oz|ounces?|g|grams?|kg|kilos?|l|liters?|litres?|ml|gal|gallons?|qts?|quarts?|pints?|dozen|doz|packs?|pk|packets?|cans?|bags?|box(?:es)?|bottles?|jars?|bunch(?:es)?|heads?|loaf|loaves|cartons?|ct|count|pieces?|pcs?|bars?|rolls?|sticks?|cups?|tubs?|blocks?)`;
const LEADING = new RegExp(String.raw`^(?:(?:${NUMBER}\s*)?doz(?:en)?\.?(?:\s+of)?|${NUMBER}\s*${UNIT}\.?(?:\s+of)?|\d+(?:[.,]\d+)?\s*x?|x\s*\d+)\s+`, 'i');
const TRAILING = new RegExp(String.raw`\s+(?:x\s*\d+|\d+\s*x|${NUMBER}\s*${UNIT}\.?)$`, 'i');

/**
 * What to type into a store's search for a list item: the name without quantities or notes.
 * "2 lb queso ecuatoriano" → "queso ecuatoriano"; "Eggs (a dozen)" → "Eggs"; "Milk x2" → "Milk".
 */
export function cleanItemQuery(name: string): string {
  let q = name
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    // A note after a separator: "Queso fresco - the soft one", "Bread, whole wheat if they have it".
    .split(/\s+[-–—]\s+|,\s|;\s|:\s/)[0]
    .replace(/\s+/g, ' ')
    .trim();
  for (let i = 0; i < 3; i++) {
    const next = q.replace(LEADING, '').replace(TRAILING, '').trim();
    if (next === q || !next) break;
    q = next;
  }
  return q;
}

export interface StoreLink {
  /** The chain's name, or the store's own name when it is not a chain we know. */
  store: string;
  url: string;
  /** False when the link is a web search because the store has no search we know of. */
  storeSite: boolean;
}

/** A link that opens the store's own search with the item filled in, or a web search for it at that store. */
export function storeSearchLink(storeName: string, itemName: string): StoreLink | null {
  const query = cleanItemQuery(itemName);
  const store = storeDisplayName(storeName);
  if (!query || !store) return null;
  const chain = chainFor(storeName);
  if (chain) return { store: chain.name, url: chain.search.replace('{q}', encodeURIComponent(query)), storeSite: true };
  return { store, url: `https://www.google.com/search?q=${encodeURIComponent(`"${query}" ${store}`)}`, storeSite: false };
}

/** One link per chain (two Publix branches are one search), in the order the stores are given. */
export function storeSearchLinks(storeNames: string[], itemName: string): StoreLink[] {
  const seen = new Set<string>();
  const links: StoreLink[] = [];
  for (const name of storeNames) {
    const link = storeSearchLink(name, itemName);
    const key = link && (chainFor(name)?.id ?? normalizeStoreName(name));
    if (!link || !key || seen.has(key)) continue;
    seen.add(key);
    links.push(link);
  }
  return links;
}
