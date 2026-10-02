// Runs the app's exact menu prompt against Gemini through Firebase AI Logic, for tuning the prompt
// without deploying. Needs an App Check debug token registered for the Tasks web app, stored in
// ~/.config/hearthlist/appcheck-debug-token.
//
//   bun scripts/menu-probe.ts "eggs, mushrooms, zucchini, steak, rice"
//   MODEL=gemini-3.5-flash-lite bun scripts/menu-probe.ts "…"   # try another model
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { MENU_MODEL, MENU_RESPONSE_SCHEMA, MENU_SYSTEM_INSTRUCTION, menuPrompt, validateMeals, groupMeals, MEAL_LABELS } from '../src/data/menus';

const PROJECT = 'huishouden-piekstra';
const MODEL = process.env.MODEL ?? MENU_MODEL;
const APP_ID = '1:865471112898:web:88de281c1be2181a4afd5b';
const SITE = 'https://huishouden-tasks.web.app';

const available = (process.argv[2] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (available.length === 0) throw new Error('Pass a comma-separated ingredient list.');

const { apiKey } = (await (await fetch(`${SITE}/__/firebase/init.json`)).json()) as { apiKey: string };
const debugToken = readFileSync(`${homedir()}/.config/hearthlist/appcheck-debug-token`, 'utf8').trim();
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
    systemInstruction: { parts: [{ text: MENU_SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: menuPrompt(available) }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: MENU_RESPONSE_SCHEMA },
  }),
});
const body = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[]; error?: { message: string } };
if (!res.ok || !body.candidates) throw new Error(`${res.status}: ${body.error?.message}`);
const raw = JSON.parse(body.candidates[0].content.parts[0].text);
const kept = validateMeals(raw, available);
console.log(`${MODEL}: ${raw.meals.length} meals returned, ${kept.length} kept, ${Date.now() - started} ms\n`);
for (const m of raw.meals) {
  if (!kept.some((k) => k.name === m.name)) console.log(`  dropped: [${m.type}] ${m.name} (${m.parts.flatMap((p: { ingredients: string[] }) => p.ingredients).join(', ')})`);
}
for (const [type, meals] of groupMeals(kept)) {
  console.log(`\n${MEAL_LABELS[type]}`);
  for (const m of meals) {
    console.log(`  ${m.name}`);
    for (const p of m.parts) console.log(`    - ${p.ingredients.join(', ')}: ${p.prep}`);
  }
}
