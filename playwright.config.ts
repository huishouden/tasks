import { defineConfig, devices } from '@playwright/test';

// The kit's CI passes the live site as BASE_URL; by default production, Tasks' path on the suite's
// one site. Specs use relative paths (`./`, `./?mode=x`): a leading `/` would open the portal.
const LIVE_URL = process.env.BASE_URL ?? 'https://huishouden-piekstra.web.app/tasks/';

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
      testIgnore: /(live|ai|screenshots|signed-in)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173/tasks/', viewport: { width: 1280, height: 800 } },
    },
    {
      // README images and CI's before/after: the signed-out sample household at BASE_URL; `bun run screenshots`.
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: LIVE_URL, viewport: { width: 1280, height: 800 } },
    },
    {
      // Real Gemini through the app's own code, App Check satisfied by a local debug token.
      // Run with `bun run e2e:ai`; skipped unless the token file exists.
      name: 'ai',
      testMatch: /ai\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5174/tasks/' },
    },
    {
      // Read-only smoke test of the deployed site; never signs in or writes data.
      name: 'live',
      testMatch: /live\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: LIVE_URL },
    },
    {
      // Key flows signed in as the staging project's invented test users (`bun run e2e:signed-in`,
      // run by the kit's staging job against huishouden-staging-tasks.web.app/tasks/).
      name: 'signed-in',
      testMatch: /signed-in\.spec\.ts/,
      timeout: 60_000,
      use: { ...devices['Desktop Chrome'], baseURL: LIVE_URL },
    },
  ],
  webServer: process.env.PW_LIVE_ONLY
    ? undefined
    : process.env.PW_AI
      ? [{ command: 'bunx vite --port 5174 --strictPort', url: 'http://localhost:5174/tasks/', reuseExistingServer: true, timeout: 60_000 }]
      : [
        {
          command: 'sh e2e/emulators/fetch-rules.sh && bunx firebase emulators:start --config e2e/emulators/firebase.json --only auth,firestore --project demo-huishouden-tasks',
          url: 'http://127.0.0.1:4400/emulators',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: 'bunx vite --port 5173 --strictPort',
          // A stand-in OAuth client, so Google API flows reach the kit's Google Identity Services stub.
          env: { VITE_USE_EMULATORS: 'true', VITE_GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com' },
          url: 'http://localhost:5173/tasks/',
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
});
