import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { pwaApp } from '@huishouden/pwa-kit/vite';

const BASE = '/tasks/';

export default defineConfig({
  test: {
    // The kit ships extensionless ESM imports (resolved by bundlers and bun, not by Node), so the unit
    // tests run it through Vite like the app does.
    server: { deps: { inline: [/@huishouden\/pwa-kit/] } },
    // Vitest serves from `/` whatever the base; links the app builds expect its path on the site.
    env: { BASE_URL: BASE },
  },
  server: {
    // Against the real project in development, Firebase's config comes from the deployed site.
    proxy: { '/__/firebase': { target: 'https://huishouden-piekstra.web.app', changeOrigin: true } },
  },
  plugins: [
    react(),
    tailwindcss(),
    pwaApp({
      // Tasks' path on the suite's one site (pwa-kit docs/one-site.md).
      base: BASE,
      name: 'Huishouden Tasks',
      shortName: 'Tasks',
      description: 'Shared lists and chores',
      url: 'https://huishouden-piekstra.web.app/tasks/',
      // Shows the shared sender's reminders (pwa-kit push) and opens their links into Tasks.
      push: true,
      themeColor: '#1b4332',
      backgroundColor: '#faf9f5',
      includeAssets: ['icon.svg', 'favicon.png', 'apple-touch-icon.png', 'og.png'],
      overrides: {
        manifest: {
          categories: ['productivity', 'lifestyle'],
          shortcuts: [
            { name: 'Kitchen', url: `${BASE}?mode=hub`, icons: [{ src: `${BASE}pwa-192.png`, sizes: '192x192' }] },
            { name: 'Store', url: `${BASE}?mode=store`, icons: [{ src: `${BASE}pwa-192.png`, sizes: '192x192' }] },
          ],
        },
        workbox: {
          runtimeCaching: [
            // Inter, so installed copies keep the suite's typeface offline.
            ...[/^https:\/\/fonts\.googleapis\.com\/.*/i, /^https:\/\/fonts\.gstatic\.com\/.*/i].map((urlPattern, i) => ({
              urlPattern,
              handler: 'CacheFirst' as const,
              options: { cacheName: i ? 'gstatic-fonts' : 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 31_536_000 }, cacheableResponse: { statuses: [0, 200] } },
            })),
            {
              // The Firebase config the app can start from; cached so an installed copy opens offline.
              urlPattern: ({ url }) => url.pathname === '/__/firebase/init.json',
              handler: 'NetworkFirst',
              options: { cacheName: 'firebase-config', networkTimeoutSeconds: 4, expiration: { maxEntries: 1 } },
            },
          ],
        },
      },
    }),
  ],
});
