import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: {
    // Shown in Settings so it is obvious which deploy a device is running.
    __APP_VERSION__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev'),
  },
  server: {
    // Against the real project in development, Firebase's config comes from the deployed site.
    proxy: { '/__/firebase': { target: 'https://huishouden-tasks.web.app', changeOrigin: true } },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'HearthList',
        short_name: 'HearthList',
        description: 'Shared household groceries, lists and chores for the kitchen tablet and phones.',
        theme_color: '#1b4332',
        background_color: '#faf9f5',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'lifestyle'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Kitchen hub', url: '/?mode=hub', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Store mode', url: '/?mode=store', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/index.html',
        // Firebase Auth's redirect handler must reach the network, not the SPA shell.
        navigateFallbackDenylist: [/^\/__\//],
        runtimeCaching: [
          {
            // The Firebase config the app starts from; cached so an installed copy opens offline.
            urlPattern: ({ url }) => url.pathname === '/__/firebase/init.json',
            handler: 'NetworkFirst',
            options: { cacheName: 'firebase-config', networkTimeoutSeconds: 4, expiration: { maxEntries: 1 } },
          },
        ],
      },
    }),
  ],
});
