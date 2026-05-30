// Architectural decision: @ alias maps to ./src using fileURLToPath + import.meta.url.
// This resolves correctly on both Windows (C:\Users\matam\...) and Linux CI containers
// (GitHub Actions ubuntu-latest, Vercel build machines). String literal '/src' is
// treated as absolute root on Linux — the URL-based approach is cross-platform safe.
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
