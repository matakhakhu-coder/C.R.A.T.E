// ── src/admin/AdminShell.js ───────────────────────────────────────────────────
// Phase 8 — Admin control shell.
// Parent frame for all internal management views. Never imported by any
// customer-facing module (src/modules/ or src/components/) — isolation enforced
// per CLAUDE.md module placement rules.
//
// Layout: persistent left sidebar nav + #admin-content-mount work area.
// Sub-view swap via swapView(html, initFn) following COGNITIVE_DEBRIEF.md
// sub-view re-hydration pattern.
//
// HPCSA guardrail: Even in internal admin views, all copy uses logistics
// and operations terminology only — never clinical or diagnostic language.

import * as OrderQueue      from '@/admin/OrderQueue.js'
import * as CrateQueueView  from '@/admin/CrateQueueView.js'
import * as TelemetryMonitor from '@/admin/TelemetryMonitor.js'

// ── Active nav state ──────────────────────────────────────────────────────────
let _activeNav = 'orders'

// ── SA supply chain dimension map (for seed manifest generation) ──────────────
const _SEED_SUPPLY = {
  spatialReasoning:     { kitType: 'Spatial Architect',   primary: 'Laserlink Interlocking Pegs', secondary: '3D Rotation Cards',               theme: 'spatial-rotation' },
  curiosity:            { kitType: 'Discovery Builder',   primary: 'Woodinq Multi-slot Baseplate', secondary: 'Discovery Inserts',              theme: 'curiosity-discovery' },
  mechanicalIntuition:  { kitType: 'Mechanics Lab',       primary: 'Balsa Chassis Plates',        secondary: 'Specialized Gears & Axle Winders', theme: 'mechanical-gear' },
  systemsThinking:      { kitType: 'Systems Engineer',    primary: 'Closed-loop Pulley Blocks',   secondary: 'Logic Path Tracker',              theme: 'systems-logic' },
  divergentThinking:    { kitType: 'Innovation Lab',      primary: 'Non-standard Joint Connectors', secondary: 'Rule-breaker Challenge Matrix', theme: 'divergent-innovation' },
  narrativeImagination: { kitType: 'Story Builder',       primary: 'Creative Sticker Packs',      secondary: 'Storytelling Silhouette Inserts', theme: 'narrative-story' },
}

// =============================================================================
// EXPORTED: render()
// Returns the full admin page HTML. No DOM access. No side effects.
// =============================================================================
export function render() {
  const navItems = [
    { id: 'orders',    label: 'Orders Queue',             icon: '&#9776;' },
    { id: 'kitting',   label: 'Fulfillment Kitting',      icon: '&#9632;' },
    { id: 'telemetry', label: 'System Telemetry Health',  icon: '&#9650;' },
  ]

  const navBtns = navItems.map(n => `
    <button data-admin-nav="${n.id}"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl
                   font-body text-sm text-left transition-all duration-200
                   ${_activeNav === n.id
                     ? 'bg-cr-coral/15 text-cr-coral font-semibold'
                     : 'text-cr-cream/55 hover:bg-cr-charcoal/60 hover:text-cr-cream'}">
      <span class="text-base leading-none">${n.icon}</span>
      <span>${n.label}</span>
    </button>`).join('')

  return `
    <div class="min-h-screen bg-cr-slate flex flex-col">

      <!-- Admin header bar -->
      <div class="h-14 bg-cr-charcoal border-b border-cr-slate flex items-center
                  justify-between px-5 flex-shrink-0">
        <div class="flex items-center gap-3">
          <span class="font-heading text-cr-coral text-sm font-bold uppercase tracking-widest">
            Admin Shell
          </span>
          <span class="font-body text-cr-cream/20 text-xs">&#124;</span>
          <span class="font-heading text-cr-cream text-sm font-extrabold tracking-widest">
            C·R·A·T·E
          </span>
        </div>
        <a href="/" data-nav
           class="font-body text-cr-cream/35 text-xs hover:text-cr-cream/70 transition-colors">
          &#8592; Public Site
        </a>
      </div>

      <!-- Shell body -->
      <div class="flex flex-1 overflow-hidden">

        <!-- Left sidebar -->
        <aside class="w-52 flex-shrink-0 bg-cr-charcoal border-r border-cr-slate
                      flex flex-col p-3 gap-1 overflow-y-auto">
          <p class="font-body text-cr-cream/25 text-[10px] uppercase tracking-widest
                    px-4 py-2 font-semibold">Navigation</p>
          ${navBtns}
        </aside>

        <!-- Main work area -->
        <main id="admin-content-mount"
              class="flex-1 overflow-y-auto bg-cr-slate p-6">
          <!-- Sub-views hydrated here by swapView() -->
        </main>

      </div>
    </div>`
}

// =============================================================================
// EXPORTED: init()
// All DOM queries, event delegation, and initial view load.
// =============================================================================
export function init() {
  // Seed demo data on first run
  _seedMockOrders()

  // Wire nav buttons
  document.querySelectorAll('[data-admin-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-admin-nav')
      _setActiveNav(view)
    })
  })

  // Wire public site nav links (data-nav handled by main.js shared handler)
  // — already wired in main.js init() before AdminShell.init() is called

  // Load default view
  _setActiveNav('orders')
}

// =============================================================================
// EXPORTED: swapView(viewHtml, viewInitFn)
// Single-pass re-hydration of the content mount area.
// Pattern from COGNITIVE_DEBRIEF.md Appendix.
// =============================================================================
export function swapView(viewHtml, viewInitFn) {
  const mount = document.getElementById('admin-content-mount')
  if (!mount) return
  mount.innerHTML = viewHtml
  if (typeof viewInitFn === 'function') viewInitFn()
}

// =============================================================================
// PRIVATE
// =============================================================================

function _setActiveNav(view) {
  _activeNav = view

  // Update nav button active states
  document.querySelectorAll('[data-admin-nav]').forEach(btn => {
    const isActive = btn.getAttribute('data-admin-nav') === view
    btn.className = `w-full flex items-center gap-3 px-4 py-3 rounded-xl font-body
                     text-sm text-left transition-all duration-200 ${
      isActive
        ? 'bg-cr-coral/15 text-cr-coral font-semibold'
        : 'text-cr-cream/55 hover:bg-cr-charcoal/60 hover:text-cr-cream'}`
  })

  // Swap content
  if (view === 'orders')    swapView(OrderQueue.render('all'),      () => OrderQueue.init('all'))
  if (view === 'kitting')   swapView(CrateQueueView.render(),       () => CrateQueueView.init())
  if (view === 'telemetry') swapView(TelemetryMonitor.render(),     () => TelemetryMonitor.init())
}

// ── _seedMockOrders() ─────────────────────────────────────────────────────────
// Populates cr_sim_orders with 3 realistic SA demo orders when storage is empty
// or contains no subscription type entries. Provides a functional demo environment.
function _seedMockOrders() {
  const existing = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
  const hasSubscriptions = existing.some(o => o.type === 'subscription')
  if (hasSubscriptions) return   // Already seeded — do not overwrite real data

  const now = Date.now()
  const ago = (days) => new Date(now - days * 86400000).toISOString()

  const seeds = [
    // ── Seed 1: Explorer Pack, Pudo, Johannesburg, kitting ─────────────────
    {
      type: 'subscription',
      orderId: 'CR-SIM-SEED-A01',
      createdAt: ago(3),
      planId: 'explorer',
      planName: 'Explorer Pack',
      billingFrequency: 'monthly',
      priceZAR: 850,
      deliveryChannel: 'pudo',
      deliveryLocation: { id: 'SEED-PUDO-001', name: 'Pudo Locker — Sandton City, Johannesburg' },
      subscriptionId: 'cr-sim-sub-seed001',
      status: 'kitting',
      pseudoUUID: 'seed-profile-jnb-001',
      crateManifest: _buildManifest('CR-SEED-MAN-A01', 'seed-profile-jnb-001',
        'spatialReasoning', 'systemsThinking', 'narrativeImagination'),
    },
    // ── Seed 2: Starter Kit, Paxi, Cape Town, new ───────────────────────────
    {
      type: 'subscription',
      orderId: 'CR-SIM-SEED-B02',
      createdAt: ago(1),
      planId: 'starter',
      planName: 'Starter Kit',
      billingFrequency: 'monthly',
      priceZAR: 650,
      deliveryChannel: 'paxi',
      deliveryLocation: { id: 'SEED-PAXI-002', name: 'PEP Store — Claremont, Cape Town' },
      subscriptionId: 'cr-sim-sub-seed002',
      status: 'new',
      pseudoUUID: 'seed-profile-cpt-002',
      crateManifest: _buildManifest('CR-SEED-MAN-B02', 'seed-profile-cpt-002',
        'curiosity', 'mechanicalIntuition', 'divergentThinking'),
    },
    // ── Seed 3: Architect Bundle, Pudo, Durban, dispatched ──────────────────
    {
      type: 'subscription',
      orderId: 'CR-SIM-SEED-C03',
      createdAt: ago(7),
      planId: 'architect',
      planName: 'Architect Bundle',
      billingFrequency: 'annual',
      priceZAR: 978,
      deliveryChannel: 'pudo',
      deliveryLocation: { id: 'SEED-PUDO-003', name: 'Pudo Locker — Gateway Theatre, Durban' },
      subscriptionId: 'cr-sim-sub-seed003',
      status: 'dispatched',
      pseudoUUID: 'seed-profile-dbn-003',
      crateManifest: _buildManifest('CR-SEED-MAN-C03', 'seed-profile-dbn-003',
        'mechanicalIntuition', 'divergentThinking', 'spatialReasoning'),
    },
  ]

  // Prepend seeds so they appear first in queue
  const updated = [...seeds, ...existing]
  localStorage.setItem('cr_sim_orders', JSON.stringify(updated))
  console.log('[CRATE] AdminShell: 3 seed orders loaded into cr_sim_orders')
}

// ── _buildManifest helper ─────────────────────────────────────────────────────
function _buildManifest(orderId, pseudoUUID, dim70, dim20, dim10) {
  const p = _SEED_SUPPLY[dim70]  || _SEED_SUPPLY.curiosity
  const s = _SEED_SUPPLY[dim20]  || _SEED_SUPPLY.mechanicalIntuition
  const x = _SEED_SUPPLY[dim10]  || _SEED_SUPPLY.divergentThinking
  return {
    orderId,
    pseudoUUID,
    generatedAt:      new Date().toISOString(),
    isWheelSpinPivot: false,
    components: {
      primary:   { dimension: dim70, share: 70, kitType: p.kitType, items: [p.primary, p.secondary], tagline: p.kitType + ' kit' },
      secondary: { dimension: dim20, share: 20, kitType: s.kitType, items: [s.secondary],            tagline: s.kitType + ' add-on' },
      stretch:   { dimension: dim10, share: 10, kitType: x.kitType, items: [x.secondary],            tagline: x.kitType + ' stretch' },
    },
    challengeCardTheme: p.theme,
    insertTheme:        s.theme,
    stickerSet:         x.theme,
    language:           'bilingual',
    quantity:           1,
    pivotModifier:      null,
  }
}
