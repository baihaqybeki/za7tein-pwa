import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      scope: '/',
      injectRegister: 'auto',
      // the app ships its own public/manifest-<role>.json, satu per peran
      manifest: false,
      // JANGAN pakai includeAssets untuk berkas yang sudah cocok globPatterns:
      // entri ganda (satu tanpa revision, satu dengan ?__WB_REVISION__) membuat
      // workbox melempar `add-to-cache-list-conflicting-entries`, precache batal
      // diam-diam, dan offline mati. webp cukup ditambahkan ke globPatterns.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,webp,svg,woff2}'],
        // Handler Web Push ditambahkan ke SW workbox (showNotification + click).
        importScripts: ['/push-sw.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/$/, /^\/documentation/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'image' || request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'sa7tein-static',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
