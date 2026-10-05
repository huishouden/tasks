import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Ports for the local browser tests: the app's dev server, the Auth and Firestore emulators and
 * the emulator suite's own. Defaults are Vite's and Firebase's, with the Firestore websocket and the
 * logging emulator one above Firestore and the hub, so `E2E_PORT_OFFSET` in steps of 10 (10, 20,
 * 100…) moves every one without two runs on one machine (two checkouts, two agents) sharing a
 * port. Each can also be set on its own (`E2E_APP_PORT`, `E2E_AUTH_PORT`, `E2E_FIRESTORE_PORT`,
 * `E2E_FIRESTORE_WS_PORT`, `E2E_HUB_PORT`, `E2E_LOGGING_PORT`). The app learns the emulators' ports from
 * `VITE_AUTH_EMULATOR_PORT` and `VITE_FIRESTORE_EMULATOR_PORT`, which `playwright.config.ts` sets.
 */
const offset = Number(process.env.E2E_PORT_OFFSET) || 0;
const port = (name: string, fallback: number): number => {
  const set = Number(process.env[name]);
  return Number.isInteger(set) && set > 0 ? set : fallback + offset;
};

const firestore = port('E2E_FIRESTORE_PORT', 8080);
const hub = port('E2E_HUB_PORT', 4400);

export const PORTS = {
  app: port('E2E_APP_PORT', 5173),
  auth: port('E2E_AUTH_PORT', 9099),
  firestore,
  firestoreWs: port('E2E_FIRESTORE_WS_PORT', firestore + 1 - offset),
  hub,
  logging: port('E2E_LOGGING_PORT', hub + 1 - offset),
} as const;

/** The app on its dev server, as the `local` project opens it. */
export const APP_URL = `http://localhost:${PORTS.app}/tasks/`;
export const AUTH_EMULATOR = `http://127.0.0.1:${PORTS.auth}`;
export const FIRESTORE_EMULATOR = `http://127.0.0.1:${PORTS.firestore}`;

/**
 * Writes the emulators' config for these ports next to `e2e/emulators/firebase.json` (one file per
 * hub port, so parallel runs don't overwrite each other's) and returns its path.
 */
export function emulatorConfig(): string {
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'emulators');
  const path = join(dir, `firebase.${PORTS.hub}.json`);
  const config = {
    firestore: { rules: 'firestore.rules' },
    emulators: {
      auth: { port: PORTS.auth },
      firestore: { port: PORTS.firestore, websocketPort: PORTS.firestoreWs },
      hub: { port: PORTS.hub },
      logging: { port: PORTS.logging },
      ui: { enabled: false },
      singleProjectMode: true,
    },
  };
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
  return path;
}
