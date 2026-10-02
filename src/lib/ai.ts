import { GoogleAIBackend, getAI, getGenerativeModel, type SchemaRequest } from 'firebase/ai';
import { MENU_FALLBACK_MODEL, MENU_MODEL, MENU_RESPONSE_SCHEMA, MENU_SYSTEM_INSTRUCTION, menuPrompt, validateMeals, type Meal } from '../data/menus';
import { ALL_CATEGORIES, CATEGORIES, type Category } from '../data/model';
import { EmptyResultError, friendlyError, withTimeout } from './errors';
import { getFirebase, useEmulators } from './firebase';

declare global {
  interface Window {
    /** Browser tests set these to stand in for Gemini, which has no emulator. */
    __mockMenuResponse?: unknown;
    __mockMenuError?: string;
    __mockCategory?: Category;
  }
}

/** Per-attempt limit; a healthy reply takes 10–30 seconds. */
const ATTEMPT_TIMEOUT_MS = 45_000;

/**
 * Asks Gemini for meal ideas and keeps only those that use what was bought plus kitchen basics.
 * Busy or rate-limited models are retried once, then the lighter model is tried; the last error
 * is rethrown unchanged so the screen can explain it (see friendlyError).
 */
export async function suggestMeals(available: string[]): Promise<Meal[]> {
  if (useEmulators) {
    if (window.__mockMenuError) throw new Error(window.__mockMenuError);
    if (window.__mockMenuResponse === undefined) throw new Error('Meal ideas need Gemini, which is not available against the emulators.');
    const meals = validateMeals(window.__mockMenuResponse, available);
    if (meals.length === 0) throw new EmptyResultError();
    return meals;
  }
  const { app } = await getFirebase();
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const generate = async (model: string) => {
    const result = await withTimeout(
      getGenerativeModel(ai, {
        model,
        systemInstruction: MENU_SYSTEM_INSTRUCTION,
        generationConfig: { responseMimeType: 'application/json', responseSchema: MENU_RESPONSE_SCHEMA as unknown as SchemaRequest },
      }).generateContent(menuPrompt(available)),
      ATTEMPT_TIMEOUT_MS,
    );
    const meals = validateMeals(JSON.parse(result.response.text()), available);
    if (meals.length === 0) throw new EmptyResultError();
    return meals;
  };
  const pause = () => new Promise((r) => setTimeout(r, 1500));
  let model = MENU_MODEL;
  let retried = false;
  for (;;) {
    try {
      return await generate(model);
    } catch (e) {
      const kind = friendlyError(e, 'meals').kind;
      if (kind !== 'busy' && kind !== 'quota') throw e;
      // Busy: one more try on the main model. A daily limit is per model: go straight to the fallback.
      if (model === MENU_MODEL && kind === 'busy' && !retried) {
        retried = true;
      } else if (model === MENU_MODEL) {
        model = MENU_FALLBACK_MODEL;
      } else {
        throw e;
      }
      await pause();
    }
  }
}

/**
 * Asks the light model which aisle an item belongs to, for names the word list could not place
 * (unusual foods, brands, other languages, bad typos). Returns null on any failure: the item just
 * stays under Other, which is never worse than not asking.
 */
export async function classifyItem(name: string): Promise<Category | null> {
  if (useEmulators) return window.__mockCategory ?? null;
  try {
    const { app } = await getFirebase();
    const model = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
      model: MENU_FALLBACK_MODEL,
      systemInstruction:
        'You sort grocery-list entries into supermarket sections for a US household. The entry may be misspelled, abbreviated, a brand name or in another language. Choose the single best section; use "Other" only when it is not something sold in a supermarket.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: { section: { type: 'string', enum: ALL_CATEGORIES } },
          required: ['section'],
        } as unknown as SchemaRequest,
      },
    });
    const result = await withTimeout(model.generateContent(`Entry: ${name}`), 15_000);
    const section = (JSON.parse(result.response.text()) as { section?: string }).section;
    return ALL_CATEGORIES.includes(section as Category) && section !== CATEGORIES.OTHER ? (section as Category) : null;
  } catch {
    return null;
  }
}

if (import.meta.env.DEV) {
  // Lets e2e/ai.spec.ts call the real model through the same code path, without signing in.
  Object.assign(window, { __suggestMeals: suggestMeals });
}
