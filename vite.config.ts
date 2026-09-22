import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

/** Short commit of this build: from CI when available, else the local checkout. */
function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  // Shown in the footer and pre-filled into bug reports.
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit()),
  },
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
