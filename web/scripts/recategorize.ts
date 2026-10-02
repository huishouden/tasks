// Re-files a household's items with the current aisle guesser. Dry run by default; --apply writes.
// Reads and writes with the caller's gcloud credentials (a project owner), so it bypasses the
// security rules: use it only on your own household.
//
//   bun scripts/recategorize.ts <householdId> [--apply]
import { execFileSync } from 'node:child_process';
import { guessCategory } from '../src/data/categorize';
import { CATEGORIES, type ListIcon } from '../src/data/model';

const PROJECT = 'huishouden-piekstra';
const [householdId, flag] = process.argv.slice(2);
if (!householdId) throw new Error('Usage: bun scripts/recategorize.ts <householdId> [--apply]');
const apply = flag === '--apply';
const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/households/${householdId}`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

type Doc = { name: string; fields: Record<string, { stringValue?: string }> };
const get = async (col: string) => ((await (await fetch(`${base}/${col}?pageSize=500`, { headers })).json()) as { documents?: Doc[] }).documents ?? [];

const icons = new Map((await get('lists')).map((d) => [d.name.split('/').pop()!, d.fields.icon?.stringValue as ListIcon]));
let changed = 0;
for (const d of await get('items')) {
  const name = d.fields.name?.stringValue ?? '';
  const current = d.fields.category?.stringValue;
  const listIcon = icons.get(d.fields.listId?.stringValue ?? '');
  const next = guessCategory(name, listIcon);
  // Only move items the guesser can now place; never overwrite a real aisle with Other.
  if (next === current || next === CATEGORIES.OTHER) continue;
  changed++;
  console.log(`${apply ? 'moved' : 'would move'}: ${name.slice(0, 60)} | ${current} → ${next}`);
  if (apply) {
    const res = await fetch(`${d.name.replace(/^projects/, 'https://firestore.googleapis.com/v1/projects')}?updateMask.fieldPaths=category`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields: { category: { stringValue: next } } }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  }
}
console.log(`${changed} item(s) ${apply ? 'moved' : 'to move'}`);
