import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Divvy — Group Expenses',
        short_name: 'Divvy',
        description: 'Split group expenses across currencies.',
        theme_color: '#0d9488',
        background_color: '#fafafa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],

  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },

  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          // Chart.js is dynamically imported by the stats tab; leaving it
          // unassigned keeps it in its own lazy chunk instead of the eager vendor one.
          if (id.includes('/chart.js/') || id.includes('@kurkle')) return
          // Same for the AI fallback (Firebase AI Logic + App Check).
          // Both the `firebase/ai` entry and the `@firebase/ai` package it wraps.
          if (/node_modules\/@?firebase\/(ai|app-check)\//.test(id)) return
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
          if (id.includes('/vue/') || id.includes('pinia') || id.includes('vue-router') || id.includes('vue-i18n')) {
            return 'vue-libs'
          }
          return 'vendor'
        },
      },
    },
  },
})
