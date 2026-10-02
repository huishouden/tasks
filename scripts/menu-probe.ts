// Runs the app's exact menu prompt against Gemini through Firebase AI Logic, for tuning the prompt
// without deploying. Needs an App Check debug token registered for the Tasks web app, stored in
// ~/.config/huishouden-tasks/appcheck-debug-token.
//
//   bun scripts/menu-probe.ts "eggs, mushrooms, steak" "zucchini, rice"     # have, then on the list
//   DIETS=vegetarian,low-sodium AVOID=olives bun scripts/menu-probe.ts "…" "…"   # diets to try (any from the kit)
//   MODEL=gemini-3.5-flash-lite bun scripts/menu-probe.ts "…"               # try another model
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { DEFAULT_PANTRY, type Diet } from '@huishouden/pwa-kit/food';
import { MENU_MODEL, MENU_RESPONSE_SCHEMA, menuPrompt, menuSystemInstruction, validateMeals, groupMeals, mealIngredients, MEAL_LABELS, type MealContext } from '../src/data/menus';

const PROJECT = 'huishouden-piekstra';
const MODEL = process.env.MODEL ?? MENU_MODEL;
const APP_ID = '1:865471112898:web:88de281c1be2181a4afd5b';
const SITE = 'https://huishouden-tasks.web.app';

const split = (s: string | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const have = split(process.argv[2]);
const onList = split(process.argv[3]);
if (have.length + onList.length === 0) throw new Error('Pass comma-separated ingredients: what you have, then what is on the list.');
const diets = split(process.env.DIETS) as Diet[];
const ctx: MealContext = {
  have,
  onList,
  pantry: DEFAULT_PANTRY,
  food: { people: diets.length || process.env.AVOID ? [{ id: 'p', name: 'Alex', diets, avoid: split(process.env.AVOID) }] : [] },
};

const { apiKey } = (await (await fetch(`${SITE}/__/firebase/init.json`)).json()) as { apiKey: string };
const debugToken = readFileSync(`${homedir()}/.config/huishouden-tasks/appcheck-debug-token`, 'utf8').trim();
const exchange = await fetch(`https://firebaseappcheck.googleapis.com/v1/projects/${PROJECT}/apps/${APP_ID}:exchangeDebugToken?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ debugToken }),
});
const { token } = (await exchange.json()) as { token: string };

const started = Date.now();
const res = await fetch(`https://firebasevertexai.googleapis.com/v1beta/projects/${PROJECT}/models/${MODEL}:generateContent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey, 'X-Firebase-AppCheck': token },
  body: JSON.stringify({
    systemInstruction: { parts: [{ text: menuSystemInstruction(ctx.food) }] },
    contents: [{ role: 'user', parts: [{ text: menuPrompt(ctx) }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: MENU_RESPONSE_SCHEMA },
  }),
});
const body = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[]; error?: { message: string } };
if (!res.ok || !body.candidates) throw new Error(`${res.status}: ${body.error?.message}`);
const raw = JSON.parse(body.candidates[0].content.parts[0].text);
const result = validateMeals(raw, ctx);
console.log(`${MODEL}: ${raw.meals.length} meals returned, ${result.meals.length} kept, ${Date.now() - started} ms`);
console.log(`  dropped for unlisted ingredients: ${result.droppedUnlisted}`);
for (const d of result.droppedDiet) console.log(`  dropped for a diet: ${d.name}: ${d.reason}`);
for (const [type, meals] of groupMeals(result.meals)) {
  console.log(`\n${MEAL_LABELS[type]}`);
  for (const m of meals) {
    const s = mealIngredients(m, ctx);
    const l = m.levels!;
    console.log(`  ${m.name}   [have: ${s.have.join(', ')} | list: ${s.list.join(', ')} | to get: ${s.extra.join(', ')}] heat ${l.heat} acid ${l.acidity} rich ${l.richness} sweet ${l.sweetness}`);
    for (const p of m.parts) console.log(`    - ${p.ingredients.join(', ')}: ${p.prep}`);
  }
}
