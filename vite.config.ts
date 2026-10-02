import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { pwaApp } from '@piekstra/huishouden-pwa-kit/vite';

export default defineConfig({
  server: {
    // Against the real project in development, Firebase's config comes from the deployed site.
    proxy: { '/__/firebase': { target: 'https://huishouden-tasks.web.app', changeOrigin: true } },
  },
  plugins: [
    react(),
    tailwindcss(),
    pwaApp({
      name: 'Huishouden Tasks',
      shortName: 'Tasks',
      description: 'Shared groceries, lists, chores and meal ideas for the kitchen tablet and phones.',
      themeColor: '#1b4332',
      backgroundColor: '#faf9f5',
      includeAssets: ['icon.svg', 'favicon.png', 'apple-touch-icon.png'],
      overrides: {
        manifest: {
          categories: ['productivity', 'lifestyle'],
          shortcuts: [
            { name: 'Kitchen', url: '/?mode=hub', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
            { name: 'Store', url: '/?mode=store', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
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
