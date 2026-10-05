import { defineConfig, devices } from '@playwright/test';
import { APP_URL, PORTS, emulatorConfig } from './e2e/ports';

// The kit's CI passes the live site as BASE_URL; by default the staging suite, never production (pwa-kit docs/one-site.md "Bandwidth"): Tasks' path on the suite's
// one site. Specs use relative paths (`./`, `./?mode=x`): a leading `/` would open the portal.
const LIVE_URL = process.env.BASE_URL || `https://huishouden-staging.web.app/tasks/`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // Full app flows against the Auth and Firestore emulators.
      name: 'local',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /(live|screenshots|signed-in)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: APP_URL, viewport: { width: 1280, height: 800 } },
    },
    {
      // README images and CI's before/after: the signed-out sample household at BASE_URL; `bun run screenshots`.
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: LIVE_URL, viewport: { width: 1280, height: 800 } },
    },
    {
      // Read-only smoke test of the deployed site; never signs in or writes data.
      name: 'live',
      testMatch: /live\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: LIVE_URL },
    },
    {
      // Key flows signed in as the invented people of a household of the run's own: on the emulators
      // (`bun run e2e:emulator`, against an emulator build at BASE_URL) and,
      // for the @staging ones, on the staging site (`bun run e2e:signed-in`, the kit's staging job).
      name: 'signed-in',
      testMatch: /signed-in\.spec\.ts/,
      timeout: 60_000,
      use: { ...devices['Desktop Chrome'], baseURL: LIVE_URL },
    },
  ],
  webServer: process.env.PW_LIVE_ONLY
    ? undefined
    : [
        {
          // Ports from the environment (e2e/ports.ts): E2E_PORT_OFFSET=100 for a second run alongside.
          command: `sh e2e/emulators/fetch-rules.sh && bunx firebase emulators:start --config ${emulatorConfig()} --only auth,firestore --project demo-huishouden-tasks`,
          url: `http://127.0.0.1:${PORTS.hub}/emulators`,
          // A clean stop, or the Firestore emulator's Java process outlives the run and holds its port.
          gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: `bunx vite --port ${PORTS.app} --strictPort`,
          // A stand-in OAuth client, so Google API flows reach the kit's Google Identity Services stub.
          env: {
            VITE_USE_EMULATORS: 'true',
            VITE_AUTH_EMULATOR_PORT: String(PORTS.auth),
            VITE_FIRESTORE_EMULATOR_PORT: String(PORTS.firestore),
            VITE_GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
          },
          url: APP_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
});
