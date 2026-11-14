import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  root: 'src/web',
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIME__: JSON.stringify(Math.floor(Date.now() / 1000)),
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      manifestFilename: 'manifest.webmanifest',
      // Icons are precached by globPatterns; the plugin adds the manifest itself.
      includeManifestIcons: false,
      manifest: {
        name: 'Baywatch – Santander',
        short_name: 'Baywatch',
        lang: 'cs',
        display: 'standalone',
        start_url: './',
        scope: './',
        theme_color: '#ffffff',
        background_color: '#eef5f9',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['**/data/**'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/data\//],
        cleanupOutdatedCaches: true,
        // Last forecast for offline use; matched by path suffix so any base path works.
        // status.json is never cached: offline there is no current fetcher status to show.
        runtimeCaching: [
          {
            urlPattern: /\/data\/forecast\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'baywatch-forecast', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: '../../dist/site',
    emptyOutDir: true,
  },
  test: {
    root: '.',
    include: ['src/**/*.test.ts'],
  },
});
