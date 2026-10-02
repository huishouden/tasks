import { defineConfig, devices } from '@playwright/test';

// The kit's CI passes the live site as BASE_URL.
const LIVE_URL = process.env.BASE_URL ?? 'https://huishouden-tasks.web.app';

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
      testIgnore: /(live|ai|screenshots)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173', viewport: { width: 1280, height: 800 } },
    },
    {
      // Regenerates docs/screenshots from a sample household; `bun run screenshots`.
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' },
    },
    {
      // Real Gemini through the app's own code, App Check satisfied by a local debug token.
      // Run with `bun run e2e:ai`; skipped unless the token file exists.
      name: 'ai',
      testMatch: /ai\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5174' },
    },
    {
      // Read-only smoke test of the deployed site; never signs in or writes data.
      name: 'live',
      testMatch: /live\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: LIVE_URL },
    },
  ],
  webServer: process.env.PW_LIVE_ONLY
    ? undefined
    : process.env.PW_AI
      ? [{ command: 'bunx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: true, timeout: 60_000 }]
      : [
        {
          command: 'sh e2e/emulators/fetch-rules.sh && bunx firebase emulators:start --config e2e/emulators/firebase.json --only auth,firestore --project demo-huishouden-tasks',
          url: 'http://127.0.0.1:4400/emulators',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: 'bunx vite --port 5173 --strictPort',
          env: { VITE_USE_EMULATORS: 'true' },
          url: 'http://localhost:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
});
