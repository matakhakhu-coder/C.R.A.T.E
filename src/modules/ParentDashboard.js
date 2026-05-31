// ── src/modules/ParentDashboard.js ───────────────────────────────────────────
// Phase 5 — Parent Dashboard: Growth Trajectory.
// Visualises the child's six activity interest areas using growth-framed copy,
// shows a crate kit preview, and hosts the POPIA one-click data erasure flow.
//
// Two-function contract (CLAUDE.md):
//   render(profileData) — returns a pure HTML template literal string.
//                          Zero DOM access. Zero event listeners. Zero async.
//   init(profileData)   — all DOM queries, event listeners, and profile
//                          update re-hydration happen here.
//
// HPCSA guardrail: No clinical, diagnostic, psychometric, or deficit language
// anywhere in this module — not in UI strings, console logs, or variable names.
// All copy uses: "play style", "interest area", "focus", "building", "exploring".
//
// POPIA isolation: Reads pseudoUUID-keyed localStorage only. Never reads or
// writes parentName, parentEmail, parentPhone, or any Database A field.
// The erasure function purges ALL cr_* keys across both databases.

import * as CratePreview from '@/modules/CratePreview.js'

// ── Module state ──────────────────────────────────────────────────────────────
let _profileListenerActive = false   // Idempotent guard for cr:profileUpdated
let _crateListenerActive   = false   // Idempotent guard for cr:crateReady

// ── Ordered list of dimension keys (matches assessmentTables.js) ──────────────
const _DIM_ORDER = [
  'curiosity', 'spatialReasoning', 'systemsThinking',
  'narrativeImagination', 'mechanicalIntuition', 'divergentThinking',
]

// ── Per-dimension visual config — full Tailwind class strings only ─────────────
const _DIM = {
  curiosity:            { label: 'Curiosity',             borderTop: 'border-cr-sage',     dot: 'bg-cr-sage',  },
  spatialReasoning:     { label: 'Spatial Reasoning',     borderTop: 'border-cr-coral',    dot: 'bg-cr-coral', },
  systemsThinking:      { label: 'Systems Thinking',      borderTop: 'border-cr-cream/30', dot: 'bg-cr-cream', },
  narrativeImagination: { label: 'Narrative Imagination', borderTop: 'border-cr-sage',     dot: 'bg-cr-sage',  },
  mechanicalIntuition:  { label: 'Mechanical Intuition',  borderTop: 'border-cr-coral',    dot: 'bg-cr-coral', },
  divergentThinking:    { label: 'Divergent Thinking',    borderTop: 'border-cr-cream/30', dot: 'bg-cr-cream', },
}

// ── Per-state visual styles — full class strings, no concatenation ─────────────
const _STATE_STYLE = {
  established: {
    tagLabel:  'Strong focus',
    tagClass:  'bg-cr-sage/15 text-cr-sage',
    barWidth:  'w-[88%]',
    barColor:  'bg-cr-sage',
  },
  developing: {
    tagLabel:  'Building focus',
    tagClass:  'bg-cr-coral/15 text-cr-coral',
    barWidth:  'w-[56%]',
    barColor:  'bg-cr-coral/70',
  },
  emerging: {
    tagLabel:  'Emerging interest',
    tagClass:  'bg-cr-cream/10 text-cr-cream/50',
    barWidth:  'w-[22%]',
    barColor:  'bg-cr-cream/30',
  },
}

// ── Per-dimension, per-state growth copy (HPCSA compliant) ────────────────────
const _COPY = {
  curiosity: {
    emerging:    'Your builder is currently focusing deeply on specific structural frames rather than exploring alternative components. Deep focus is a valid and rich play style.',
    developing:  'Curiosity is building! Puzzles are presenting an engaging playground. Your builder is demonstrating growing interest in exploration and new tools.',
    established: 'Your builder shows a strong, sustained curiosity — actively seeking new tools, testing unexpected interactions, and ranging widely across the sandbox.',
  },
  spatialReasoning: {
    emerging:    'Your builder is working through spatial arrangement in a grounded, deliberate way. This careful approach often precedes confident spatial leaps.',
    developing:  'Spatial awareness is growing. Your builder is starting to plan layouts before committing and returning to refine their arrangements.',
    established: 'Your builder navigates spatial challenges with confidence — planning layouts, rotating approaches mentally, and building with clear intention.',
  },
  systemsThinking: {
    emerging:    'Your builder currently favours spontaneous action over sequential planning. This exploratory energy captures important signals about how they engage.',
    developing:  'Systems awareness is emerging. Your builder is beginning to notice cause-and-effect patterns and adjust their approach based on what they observe.',
    established: 'Your builder shows strong sequential thinking — methodically planning steps, monitoring their own process, and self-correcting along the way.',
  },
  narrativeImagination: {
    emerging:    'Your builder is currently focused on functional construction rather than decorative elaboration. Focused building is a completely valid creative approach.',
    developing:  'Stories are starting to appear in the builds. Your builder is beginning to give objects context, name things, and layer meaning into their creations.',
    established: 'Your builder is a natural story-maker — decorating, naming, and weaving imaginative narratives into every structure they create.',
  },
  mechanicalIntuition: {
    emerging:    'Your builder is developing their physical intuition one session at a time. Each experiment adds to their growing sense of how objects behave.',
    developing:  'Mechanical understanding is growing. Your builder is starting to predict how forces and structures will respond before testing them.',
    established: 'Your builder has strong mechanical intuition — confidently exploring how objects balance, connect, and respond to physical forces.',
  },
  divergentThinking: {
    emerging:    'Your builder currently favours familiar tools and reliable approaches. This consistency is building a strong foundation to branch from.',
    developing:  'New approaches are starting to emerge. Your builder is beginning to test boundaries and try unexpected combinations of tools.',
    established: 'Your builder is a natural experimenter — generating multiple approaches, pushing limits, and resisting the pull of the obvious solution.',
  },
}

// =============================================================================
// RENDER HELPERS — pure string builders, called only from render()
// =============================================================================

// ── _renderDimensionCard(dimKey, dimData) ─────────────────────────────────────
// Returns one activity interest area card as an HTML string.
// dimData may be null/undefined if no sessions have generated data for this dim.
function _renderDimensionCard(dimKey, dimData) {
  const cfg   = _DIM[dimKey]
  if (!cfg) return ''

  const state  = dimData?.state || 'emerging'
  const style  = _STATE_STYLE[state] || _STATE_STYLE.emerging
  const copy   = _COPY[dimKey]?.[state] || _COPY[dimKey]?.emerging || ''

  return `
    <div class="bg-cr-slate rounded-2xl p-5 border-t-4 ${cfg.borderTop}
                shadow-card hover:shadow-card-hover transition-shadow duration-300">

      <!-- Header: dot + label + state tag -->
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}"></span>
          <h3 class="font-heading text-cr-cream text-sm font-bold">${cfg.label}</h3>
        </div>
        <span class="inline-block px-2 py-0.5 rounded-full font-body text-[10px]
                     font-semibold uppercase tracking-wider flex-shrink-0 ${style.tagClass}">
          ${style.tagLabel}
        </span>
      </div>

      <!-- Interest intensity bar (visual only — no numeric labels) -->
      <div class="w-full h-1.5 bg-cr-charcoal rounded-full overflow-hidden mb-4">
        <div class="h-full rounded-full transition-all duration-700 ${style.barWidth} ${style.barColor}"></div>
      </div>

      <!-- Growth-framed description — HPCSA compliant -->
      <p class="font-body text-cr-cream/60 text-xs leading-relaxed">${copy}</p>

    </div>`
}

// Phase 6: _renderCratePreview removed — CratePreview.render(manifest) is now
// called directly from _renderDashboardContent(). The manifest is loaded from
// cr_sim_orders localStorage and passed through the render chain.

// ── _renderEmptyState() ───────────────────────────────────────────────────────
// Shown when profileData is null or has no completed sessions.
function _renderEmptyState() {
  return `
    <div class="text-center py-8">
      <div class="w-14 h-14 rounded-full bg-cr-charcoal border border-cr-charcoal/60
                  flex items-center justify-center mx-auto mb-4">
        <span class="font-heading text-cr-cream/30 text-2xl">&#9632;</span>
      </div>
      <h3 class="font-heading text-cr-cream text-base font-bold mb-2">
        No play sessions yet
      </h3>
      <p class="font-body text-cr-cream/50 text-sm leading-relaxed max-w-sm mx-auto mb-6">
        Head to the sandbox for your first session. Your builder's play interest journey
        will begin automatically — no setup required.
      </p>
      <a href="/sandbox" data-nav
         class="btn-primary text-sm inline-block">
        Enter Play Sandbox &rarr;
      </a>
    </div>`
}

// ── _renderDashboardContent(profileData, manifest) ───────────────────────────
// Returns the inner profile-specific section of the dashboard.
// Re-hydrated by init() when cr:profileUpdated fires (profile section only).
// Crate zone (#cr-crate-zone) is hot-swapped by cr:crateReady listener.
function _renderDashboardContent(profileData, manifest = null) {
  const hasData = profileData?.sessionCount > 0 && profileData?.dimensions

  // ── Session summary bar ────────────────────────────────────────────────────
  const sessionLine = hasData
    ? `<span class="font-body text-cr-cream/40 text-xs">
         ${profileData.sessionCount} play session${profileData.sessionCount !== 1 ? 's' : ''}
         &nbsp;&middot;&nbsp;
         Last updated ${_formatDate(profileData.lastUpdated)}
       </span>`
    : `<span class="font-body text-cr-cream/30 text-xs">No sessions recorded yet</span>`

  // ── Dimension cards grid ───────────────────────────────────────────────────
  const dimCards = hasData
    ? _DIM_ORDER.map(k => _renderDimensionCard(k, profileData.dimensions[k])).join('')
    : ''

  // ── Calibration notice (if any dimension raised a flag) ───────────────────
  const calFlags   = profileData?.calibrationFlags || {}
  const calFlagged = Object.keys(calFlags).filter(k => calFlags[k])
  const calNotice  = calFlagged.length > 0
    ? `<div class="bg-cr-charcoal rounded-xl border border-cr-cream/10 p-3 flex items-start gap-2 text-xs font-body text-cr-cream/40">
         <span class="text-cr-coral/60 flex-shrink-0">&#9642;</span>
         <span>Some interest areas are still building signal history. More play sessions will sharpen the picture.</span>
       </div>`
    : ''

  return `
    <div class="mb-4 flex items-center justify-between">
      <h2 class="font-heading text-cr-cream text-xl font-extrabold">Play Interest Journey</h2>
      ${sessionLine}
    </div>

    ${hasData ? `
      <!-- Six activity interest area cards -->
      <div id="cr-dashboard-content" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        ${dimCards}
      </div>
      ${calNotice}
    ` : `
      <div id="cr-dashboard-content">
        ${_renderEmptyState()}
      </div>
    `}

    <!-- Crate preview zone — hot-swapped by cr:crateReady in init() -->
    <div id="cr-crate-zone" class="mt-6">${CratePreview.render(manifest)}</div>`
}

// ── _formatDate(isoString) ────────────────────────────────────────────────────
function _formatDate(iso) {
  if (!iso) return 'recently'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return 'recently' }
}

// =============================================================================
// EXPORTED: render(profileData, manifest)
// Full page HTML — rendered by main.js when ctx.isOnboarded is true.
// manifest is the latest cr_sim_orders[0] entry loaded in _hydrate().
// =============================================================================
export function render(profileData, manifest = null) {
  const nick = profileData?.childNickname
    || localStorage.getItem('cr_child_nickname')
    || 'Explorer'

  return `
    <div class="min-h-screen bg-cr-slate flex flex-col">

      <!-- Top navigation bar -->
      <div class="max-w-4xl mx-auto w-full px-4 pt-6 flex items-center justify-between">
        <a href="/" data-nav
           class="font-heading text-cr-sage text-xl font-extrabold tracking-widest
                  hover:text-cr-cream transition-colors">C·R·A·T·E</a>
        <div class="flex items-center gap-4">
          <a href="/sandbox" data-nav
             class="font-body text-cr-cream/50 text-xs hover:text-cr-cream transition-colors">
            Play Sandbox &rarr;
          </a>
          <a href="/" data-nav
             class="font-body text-cr-cream/35 text-xs hover:text-cr-cream/70 transition-colors">
            &#8592; Home
          </a>
        </div>
      </div>

      <!-- Welcome header -->
      <div class="max-w-4xl mx-auto w-full px-4 mt-8 mb-6">
        <p class="font-body text-cr-sage text-xs font-semibold uppercase tracking-widest mb-1">
          Parent Dashboard
        </p>
        <h1 class="font-heading text-cr-cream text-2xl md:text-3xl font-extrabold">
          Welcome back. Here's how
          <span class="text-cr-sage">${_sanitise(nick)}</span> is playing.
        </h1>
      </div>

      <!-- Main content area -->
      <div class="max-w-4xl mx-auto w-full px-4 pb-16 flex-1">

        <!-- Profile content section — re-hydrated by init() on cr:profileUpdated -->
        <div id="cr-profile-section">
          ${_renderDashboardContent(profileData, manifest)}
        </div>

        <!-- ── POPIA Data Management Zone ──────────────────────────────────── -->
        <!-- Architecturally isolated from profile display above.               -->
        <!-- Never cross-references PII fields with play trajectory data.       -->
        <div class="mt-10 pt-6 border-t border-cr-charcoal">
          <h3 class="font-body text-cr-cream/40 text-xs uppercase tracking-widest font-semibold mb-3">
            Data Management
          </h3>
          <div class="bg-cr-charcoal rounded-2xl border border-cr-coral/20 p-5">
            <p class="font-body text-cr-cream/55 text-sm leading-relaxed mb-1">
              Under the Protection of Personal Information Act (POPIA) you have the right
              to request permanent deletion of all your account data and play records at any time.
            </p>
            <p class="font-body text-cr-cream/35 text-xs leading-relaxed mb-4">
              This action is irreversible. All account details (Database A) and all play signals
              (Database B) will be permanently erased. You will be returned to the home page.
            </p>
            <button
              id="cr-delete-all-btn"
              class="font-body text-cr-coral text-sm font-semibold
                     border border-cr-coral/40 hover:border-cr-coral
                     rounded-xl px-4 py-2.5 min-h-[44px]
                     hover:bg-cr-coral/10 transition-all duration-200
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cr-coral"
            >
              Permanently Delete All Account and Play Records
            </button>
          </div>
        </div>

      </div>
    </div>`
}

// =============================================================================
// EXPORTED: init(profileData)
// All DOM queries and event listeners — runs after app.innerHTML is written.
// =============================================================================
export function init(profileData) {

  // ── Idempotent: bind cr:profileUpdated listener once across all hydrations ─
  if (!_profileListenerActive) {
    _profileListenerActive = true
    document.addEventListener('cr:profileUpdated', _onProfileUpdated)
    console.log('[CRATE] ParentDashboard: cr:profileUpdated listener active')
  }

  // ── Idempotent: bind cr:crateReady listener for hot-swap crate zone ───────
  if (!_crateListenerActive) {
    _crateListenerActive = true
    document.addEventListener('cr:crateReady', (e) => {
      const { manifest } = e.detail || {}
      const zone = document.getElementById('cr-crate-zone')
      if (!zone) return   // Not on dashboard — silently ignore
      zone.innerHTML = CratePreview.render(manifest)
      CratePreview.init(manifest)
      console.log('[CRATE] ParentDashboard: crate zone hot-swapped — orderId:', manifest?.orderId)
    })
    console.log('[CRATE] ParentDashboard: cr:crateReady listener active')
  }

  // ── Wire deletion CTA ─────────────────────────────────────────────────────
  _initDeleteCTA()

  // ── Wire [data-nav] links (sandbox + home) ────────────────────────────────
  // These are also wired by main.js init() shared handler — no duplication
  // since main.js runs its handler BEFORE calling ParentDashboard.init().
}

// =============================================================================
// PRIVATE: event handlers & helpers
// =============================================================================

// ── _onProfileUpdated(event) ─────────────────────────────────────────────────
// Handles cr:profileUpdated dispatched by AssessmentEngine after every session.
// Re-renders only the profile section — outer shell and POPIA zone are stable.
function _onProfileUpdated(event) {
  const { profile } = event.detail || {}
  if (!profile) return

  const section = document.getElementById('cr-profile-section')
  if (!section) return   // Not on the dashboard — silently ignore

  // Enrich incoming profile with localStorage display fields
  const enriched = {
    ...profile,
    childNickname: localStorage.getItem('cr_child_nickname') || 'Explorer',
    childAgeGroup: localStorage.getItem('cr_child_age_group') || '',
  }

  // Load latest manifest for the crate zone
  let latestManifest = null
  try {
    const ordersRaw = localStorage.getItem('cr_sim_orders')
    if (ordersRaw) { const orders = JSON.parse(ordersRaw); latestManifest = orders[0] || null }
  } catch { /* ignore */ }

  // Single-pass re-hydration of the profile section only
  section.innerHTML = _renderDashboardContent(enriched, latestManifest)

  // Rebind deletion CTA — new DOM element, previous listener is gone
  _initDeleteCTA()

  console.log('[CRATE] ParentDashboard: profile section re-hydrated — session', profile.sessionCount)
}

// ── _initDeleteCTA() ─────────────────────────────────────────────────────────
// Binds the two-step deletion confirmation to #cr-delete-all-btn.
// Called on initial init() and after every profile section re-hydration.
function _initDeleteCTA() {
  const btn = document.getElementById('cr-delete-all-btn')
  if (!btn) return

  let _pendingConfirm = false

  btn.addEventListener('click', () => {
    if (!_pendingConfirm) {
      // Step 1 — arm the confirmation
      _pendingConfirm = true
      btn.textContent  = 'Tap again to permanently confirm full data deletion'
      btn.classList.add('bg-cr-coral/10', 'border-cr-coral', 'text-cr-coral')
      // Auto-reset after 6 seconds if user doesn't confirm
      setTimeout(() => {
        if (_pendingConfirm) {
          _pendingConfirm  = false
          btn.textContent  = 'Permanently Delete All Account and Play Records'
          btn.classList.remove('bg-cr-coral/10')
        }
      }, 6000)
      return
    }

    // Step 2 — execute erasure
    _executeDataErasure()
  })
}

// ── _executeDataErasure() ────────────────────────────────────────────────────
// Cascading sweep across all cr_* localStorage entries.
// Covers Database A (PII) and Database B (play signals) equivalents.
// Navigates to / via hard redirect to reset all module-level state cleanly.
function _executeDataErasure() {
  // Collect all cr_* keys before iterating (avoids index mutation during loop)
  const toDelete = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('cr_')) toDelete.push(key)
  }

  toDelete.forEach(k => {
    localStorage.removeItem(k)
  })

  console.log(
    '[CRATE] ParentDashboard: data erasure complete —',
    toDelete.length, 'records purged:',
    toDelete.join(', '),
  )

  // Hard redirect to / — resets all module-level state and lands on marketing page
  window.location.href = '/'
}

// ── _sanitise(str) ────────────────────────────────────────────────────────────
// Prevents raw strings from injecting markup into the welcome header.
function _sanitise(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
