// ── src/modules/CrateRecommender.js ──────────────────────────────────────────
// Phase 6 — 70/20/10 Crate Curation Engine.
// Consumes the child's six-dimension interest profile, applies the inventory
// postponement allocation strategy, builds a physical kit manifest, routes it
// to the POD adapter, and dispatches cr:crateReady for the dashboard to consume.
//
// Architecture:
//   init() wires two listeners — cr:profileUpdated triggers automatic
//   manifest regeneration after every play session; cr:wheelSpinDetected
//   arms a one-shot pivot modifier for the next manifest's challenge cards.
//   generateCrateManifest(profile) is the pure computation + dispatch path.
//
// 70/20/10 allocation:
//   70% Primary   — highest interest score   → core kit type + structural chassis
//   20% Secondary — second highest score     → accessory component bundle
//   10% Stretch   — LOWEST interest score    → gentle cross-over stimulation
//
// HPCSA guardrail: No clinical, diagnostic, or evaluation terminology in any
// string, variable name, console log, or comment. All copy is kit-framed:
// "exploration component", "activity kit", "challenge card theme".
//
// POPIA isolation: Uses pseudoUUID from profile only. Never reads parentName,
// parentEmail, parentPhone, or any Database A field.

import { dispatchPrintJob } from '@/core/integrations/pod.js'

// ── Module state ──────────────────────────────────────────────────────────────
let _initialized     = false   // Idempotent guard for init()
let _wheelSpinActive = false   // One-shot pivot flag armed by cr:wheelSpinDetected

// ── Canonical dimension order (matches assessmentTables.js) ───────────────────
const _DIM_KEYS = [
  'curiosity', 'spatialReasoning', 'systemsThinking',
  'narrativeImagination', 'mechanicalIntuition', 'divergentThinking',
]

// ── SA supply chain asset map ─────────────────────────────────────────────────
// Component names reference local manufacturing partners (Woodinq, Laserlink).
// kitType is the human-readable crate name used in the preview UI.
const _SUPPLY = Object.freeze({
  curiosity: Object.freeze({
    kitType:            'Discovery Builder',
    primaryItem:        'Woodinq Multi-slot Baseplate',
    secondaryItem:      'Discovery Inserts',
    challengeCardTheme: 'curiosity-discovery',
    tagline:            'Structured exploration base with open-ended insert slots',
  }),
  spatialReasoning: Object.freeze({
    kitType:            'Spatial Architect',
    primaryItem:        'Laserlink Interlocking Pegs',
    secondaryItem:      '3D Rotation Cards',
    challengeCardTheme: 'spatial-rotation',
    tagline:            'Precision-cut peg system for three-dimensional building',
  }),
  systemsThinking: Object.freeze({
    kitType:            'Systems Engineer',
    primaryItem:        'Closed-loop Pulley Blocks',
    secondaryItem:      'Logic Path Tracker',
    challengeCardTheme: 'systems-logic',
    tagline:            'Mechanical loop system with sequential challenge tracker',
  }),
  narrativeImagination: Object.freeze({
    kitType:            'Story Builder',
    primaryItem:        'Creative Sticker Packs',
    secondaryItem:      'Storytelling Silhouette Inserts',
    challengeCardTheme: 'narrative-story',
    tagline:            'Character silhouette inserts with open narrative prompts',
  }),
  mechanicalIntuition: Object.freeze({
    kitType:            'Mechanics Lab',
    primaryItem:        'Balsa Chassis Plates',
    secondaryItem:      'Specialized Gears & Axle Winders',
    challengeCardTheme: 'mechanical-gear',
    tagline:            'Lightweight chassis system with precision gear assemblies',
  }),
  divergentThinking: Object.freeze({
    kitType:            'Innovation Lab',
    primaryItem:        'Non-standard Joint Connectors',
    secondaryItem:      'Rule-breaker Challenge Matrix',
    challengeCardTheme: 'divergent-innovation',
    tagline:            'Unconventional connectors that reward boundary-testing builds',
  }),
})

// ── Wheel-spin pivot modifier text ────────────────────────────────────────────
// Applied to challenge cards when the child triggers the wheel-spin threshold.
const _PIVOT_TEXT = '[PIVOT] Tactile Re-routing Assignment: Transition physical blocks ' +
  'to hands-on structural testing to navigate past active playground friction.'

// =============================================================================
// PUBLIC API
// =============================================================================

// ── init() ───────────────────────────────────────────────────────────────────
// Binds event listeners. Must be called once at application startup.
// Idempotent — safe to call on every /app hydration.
export function init() {
  if (_initialized) return
  _initialized = true

  // Auto-regenerate manifest on every profile update
  document.addEventListener('cr:profileUpdated', (e) => {
    const { profile } = e.detail || {}
    if (profile?.dimensions) {
      generateCrateManifest(profile).catch(() => {})
    }
  })

  // Arm the one-shot pivot modifier when wheel-spin is detected
  document.addEventListener('cr:wheelSpinDetected', () => {
    _wheelSpinActive = true
    console.log('[SIM] CrateRecommender: wheel-spin signal received — pivot modifier armed for next kit')
  })

  console.log('[SIM] CrateRecommender: initialized — listening for cr:profileUpdated, cr:wheelSpinDetected')
}

// ── generateCrateManifest(profile) ──────────────────────────────────────────
// Core 70/20/10 algorithm. Computes the manifest, saves to cr_sim_orders,
// calls the POD adapter, and dispatches cr:crateReady.
//
// profile: the full profile object from AssessmentEngine / localStorage.
//          Must contain profile.dimensions and profile.pseudoUUID.
//
// Returns the manifest object, or null if the profile has no dimension data.
export async function generateCrateManifest(profile) {
  const dims = profile?.dimensions
  if (!dims) return null

  // ── Step 1: Score each dimension ──────────────────────────────────────────
  // Score = established_posterior × 2 + developing_posterior × 1
  // Weights established interest most heavily, developing second.
  const scored = _DIM_KEYS.map(key => {
    const data = dims[key] || {}
    const post = data.posteriors || {}
    return {
      key,
      score: (post.established ?? 0) * 2 + (post.developing ?? 0),
      state: data.state || 'emerging',
    }
  })

  // Sort descending so index 0 = strongest, index 5 = weakest
  scored.sort((a, b) => b.score - a.score)

  // ── Step 2: Apply 70/20/10 allocation ────────────────────────────────────
  const primary70   = scored[0]   // strongest interest → core kit
  const secondary20 = scored[1]   // second strongest → accessory bundle
  const stretch10   = scored[5]   // weakest → gentle cross-over stimulation

  const p = _SUPPLY[primary70.key]   || _SUPPLY.curiosity
  const s = _SUPPLY[secondary20.key] || _SUPPLY.spatialReasoning
  const x = _SUPPLY[stretch10.key]   || _SUPPLY.divergentThinking

  // ── Step 3: Consume wheel-spin pivot flag (one-shot) ──────────────────────
  const pivotActive = _wheelSpinActive
  _wheelSpinActive  = false   // Reset immediately — one pivot per detection

  const orderId = `CR-${Date.now().toString(36).toUpperCase()}`

  // ── Step 4: Assemble manifest ─────────────────────────────────────────────
  const manifest = {
    orderId,
    pseudoUUID:       profile.pseudoUUID || 'anon',
    generatedAt:      new Date().toISOString(),
    isWheelSpinPivot: pivotActive,

    // 70/20/10 component breakdown
    components: Object.freeze({
      primary: {
        dimension: primary70.key,
        share:     70,
        kitType:   p.kitType,
        items:     [p.primaryItem, p.secondaryItem],
        tagline:   p.tagline,
      },
      secondary: {
        dimension: secondary20.key,
        share:     20,
        kitType:   s.kitType,
        items:     [s.secondaryItem],
        tagline:   s.tagline,
      },
      stretch: {
        dimension: stretch10.key,
        share:     10,
        kitType:   x.kitType,
        items:     [x.secondaryItem],
        tagline:   x.tagline,
      },
    }),

    // POD print job fields (pod.js adapter contract)
    challengeCardTheme: p.challengeCardTheme,
    insertTheme:        s.challengeCardTheme,
    stickerSet:         x.challengeCardTheme,
    language:           'bilingual',   // EN + AF — local cross-cultural adaptation
    quantity:           1,

    pivotModifier:      pivotActive ? _PIVOT_TEXT : null,
  }

  // ── Step 5: Persist to order queue ───────────────────────────────────────
  try {
    const orders = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
    orders.unshift(manifest)
    if (orders.length > 20) orders.length = 20   // Rolling window — prevent unbounded growth
    localStorage.setItem('cr_sim_orders', JSON.stringify(orders))
  } catch (err) {
    console.warn('[SIM] CrateRecommender: order queue write failed:', err?.message)
  }

  // ── Step 6: Dispatch POD print job ────────────────────────────────────────
  try {
    await dispatchPrintJob({
      orderId:            manifest.orderId,
      challengeCardTheme: manifest.challengeCardTheme,
      insertTheme:        manifest.insertTheme,
      stickerSet:         manifest.stickerSet,
      language:           manifest.language,
      quantity:           manifest.quantity,
    })
  } catch (err) {
    console.warn('[SIM] CrateRecommender: pod.js dispatch failed silently:', err?.message)
  }

  // ── Step 7: Log and dispatch cr:crateReady ────────────────────────────────
  console.log('[SIM] CrateRecommender: 70/20/10 calculation committed')
  console.log('[SIM] CrateRecommender: orderId:', manifest.orderId)
  console.log('[SIM] CrateRecommender: primary (70%) —', primary70.key, '→', p.kitType)
  console.log('[SIM] CrateRecommender: secondary (20%) —', secondary20.key, '→', s.kitType)
  console.log('[SIM] CrateRecommender: stretch (10%) —', stretch10.key, '→', x.kitType)
  if (pivotActive) {
    console.log('[SIM] CrateRecommender: [PIVOT] modifier applied — challenge cards re-routed')
  }

  document.dispatchEvent(new CustomEvent('cr:crateReady', {
    detail: { pseudoUUID: manifest.pseudoUUID, manifest },
  }))

  return manifest
}
