// ── src/main.js ─────────────────────────────────────────────────────────────
// C.R.A.T.E. application orchestrator.
// Enforces the single-pass hydration sequence: all render() output concatenated
// into ONE innerHTML write, then all init() calls in order.
//
// Three exclusive render paths:
//   /admin          → mountAdmin()        — AdminShell only. No customer modules.
//   /app            → mountApp()          — Parent dashboard environment.
//   everything else → mountCustomer()     — Public marketing shell.
//
// URL routing via window.location.pathname only. No router library.
// vercel.json catch-all rewrite serves index.html for all paths.

import './style.css'

// ── DOM references ────────────────────────────────────────────────────────────
const app = document.getElementById('app')

// ── render(path) ──────────────────────────────────────────────────────────────
// Pure function — returns an HTML string based on current route.
// Zero DOM access. Zero event listeners. Zero side effects.
// Null values from BRAND are handled here with safe fallbacks before DOM write.
function render(path) {
  const route = path === '' ? '/' : path

  if (route === '/') {
    return `
      <div class="min-h-screen bg-cr-slate flex flex-col items-center justify-center px-4">
        <div class="text-center max-w-lg">
          <p class="font-heading text-cr-sage text-sm font-bold uppercase tracking-widest mb-3">
            Phase 0 — Substrate Active
          </p>
          <h1 class="font-heading text-cr-cream text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
            C.R.A.T.E.
          </h1>
          <p class="font-body text-cr-cream/70 text-base mb-8">
            Public Marketing Shell Substrate Active
          </p>
          <div class="flex gap-3 justify-center flex-wrap">
            <a href="/app"   data-nav class="btn-secondary text-sm">Parent Dashboard →</a>
            <a href="/admin" data-nav class="btn-secondary text-sm">Admin Shell →</a>
          </div>
        </div>
        <div class="mt-12 px-4 py-3 bg-cr-charcoal rounded-xl font-body text-xs text-cr-cream/50 text-center">
          All integrations in simulation mode &mdash;
          <span class="text-cr-sage">SVVP state</span>
        </div>
      </div>
    `
  }

  if (route === '/app') {
    return `
      <div class="min-h-screen bg-cr-slate flex flex-col items-center justify-center px-4">
        <div class="text-center max-w-lg">
          <p class="font-heading text-cr-sage text-sm font-bold uppercase tracking-widest mb-3">
            Phase 0 — Substrate Active
          </p>
          <h1 class="font-heading text-cr-cream text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
            Parent Dashboard
          </h1>
          <p class="font-body text-cr-cream/70 text-base mb-8">
            Parent Dashboard Environment Active
          </p>
          <a href="/" data-nav class="btn-secondary text-sm">← Back to Home</a>
        </div>
      </div>
    `
  }

  if (route === '/admin') {
    return `
      <div class="min-h-screen bg-cr-slate flex flex-col items-center justify-center px-4">
        <div class="text-center max-w-lg">
          <p class="font-heading text-cr-coral text-sm font-bold uppercase tracking-widest mb-3">
            Admin Only — Phase 0 Substrate Active
          </p>
          <h1 class="font-heading text-cr-cream text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
            Admin Control Shell
          </h1>
          <p class="font-body text-cr-cream/70 text-base mb-8">
            Admin Control Shell Substrate Active
          </p>
          <a href="/" data-nav class="btn-secondary text-sm">← Back to Home</a>
        </div>
      </div>
    `
  }

  // ── 404 — no unhandled nulls or raw errors escape to the DOM ─────────────
  return `
    <div class="min-h-screen bg-cr-slate flex flex-col items-center justify-center px-4">
      <div class="text-center max-w-lg">
        <p class="font-heading text-cr-coral text-sm font-700 uppercase tracking-widest mb-3">
          Route not found
        </p>
        <h1 class="font-heading text-cr-cream text-3xl font-800 mb-4">404</h1>
        <p class="font-body text-cr-cream/70 text-base mb-8">
          The path <code class="text-cr-sage">${_sanitise(path)}</code> does not exist.
        </p>
        <a href="/" data-nav class="btn-secondary text-sm">← Return Home</a>
      </div>
    </div>
  `
}

// ── init(path) ────────────────────────────────────────────────────────────────
// All DOM queries, event listeners, and adapter calls happen here —
// after app.innerHTML has been written by the hydration sequence below.
function init(path) {
  const route = path === '' ? '/' : path
  console.log(`[CRATE] init — route: ${route}`)

  // ── SPA link interception ─────────────────────────────────────────────────
  // Catch all [data-nav] anchor clicks and handle as client-side navigation.
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault()
      const href = link.getAttribute('href')
      window.history.pushState({}, '', href)
      _hydrate(href)
    })
  })

  // ── Route-specific init ───────────────────────────────────────────────────
  if (route === '/') {
    console.log('[CRATE] init — public marketing shell substrate ready')
  }

  if (route === '/app') {
    console.log('[CRATE] init — parent dashboard environment ready')
  }

  if (route === '/admin') {
    console.log('[CRATE] init — admin control shell ready')
  }
}

// ── _hydrate(path) ────────────────────────────────────────────────────────────
// Single-pass hydration: one innerHTML write, then all inits in order.
// Called on initial load and on every popstate / SPA navigation event.
function _hydrate(path) {
  if (!app) {
    console.error('[CRATE] _hydrate — #app element not found in DOM')
    return
  }
  app.innerHTML = render(path)   // ← ONE innerHTML write
  init(path)                     // ← ALL inits after DOM is written
}

// ── _sanitise(str) ────────────────────────────────────────────────────────────
// Prevents raw path strings from injecting markup into the 404 view.
function _sanitise(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Browser history: back/forward navigation ──────────────────────────────────
window.addEventListener('popstate', () => {
  _hydrate(window.location.pathname)
})

// ── Initial load ──────────────────────────────────────────────────────────────
_hydrate(window.location.pathname)
