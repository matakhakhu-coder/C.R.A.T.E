// Architectural decision: @ alias maps to /src for clean cross-module imports.
// Adapters use @/core/flags.js and @/core/manifest.js throughout.
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
