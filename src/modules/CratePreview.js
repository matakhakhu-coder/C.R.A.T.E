// ── src/modules/CratePreview.js ───────────────────────────────────────────────
// Phase 6 — Crate kit preview UI component.
// Renders the upcoming physical kit contents inside the parent dashboard.
// Receives the manifest object computed by CrateRecommender.
//
// Two-function contract (CLAUDE.md):
//   render(manifest) — pure HTML string. Zero DOM. Zero side effects.
//   init(manifest)   — DOM queries and micro-interaction animations only.
//                      Zero innerHTML writes.
//
// HPCSA guardrail: No clinical, diagnostic, or deficit language anywhere.
// All copy is kit-framed: "activity kit", "exploration set", "challenge cards".
//
// POPIA isolation: manifest contains only pseudoUUID. No PII fields referenced.

// ── Dimension display labels ──────────────────────────────────────────────────
const _DIM_LABELS = Object.freeze({
  curiosity:            'Curiosity',
  spatialReasoning:     'Spatial Reasoning',
  systemsThinking:      'Systems Thinking',
  narrativeImagination: 'Narrative Imagination',
  mechanicalIntuition:  'Mechanical Intuition',
  divergentThinking:    'Divergent Thinking',
})

// ── Share allocation styles — full Tailwind class strings ─────────────────────
const _SHARE_STYLE = Object.freeze({
  70: { borderColor: 'border-cr-coral',    badge: 'bg-cr-coral/15 text-cr-coral',    label: 'Core Kit · 70%'              },
  20: { borderColor: 'border-cr-sage',     badge: 'bg-cr-sage/15 text-cr-sage',      label: 'Add-on Bundle · 20%'         },
  10: { borderColor: 'border-cr-cream/20', badge: 'bg-cr-cream/10 text-cr-cream/40', label: 'Exploration Stretch · 10%'   },
})

// =============================================================================
// EXPORTED: render(manifest)
// Returns a complete HTML string — either the empty onboarding state or
// the full kit preview breakdown.
// =============================================================================
export function render(manifest) {
  if (!manifest?.components) return _renderEmpty()
  return _renderManifest(manifest)
}

// =============================================================================
// EXPORTED: init(manifest)
// Runs after the crate zone has been written to the DOM.
// Applies a gentle fade-in highlight to signal a fresh kit update.
// Zero innerHTML writes — visual state only.
// =============================================================================
export function init(manifest) {
  const zone = document.getElementById('cr-crate-zone')
  if (!zone) return

  // Gentle entrance animation: opacity cycle via RAF
  zone.style.opacity = '0'
  requestAnimationFrame(() => {
    zone.style.transition = 'opacity 0.5s ease'
    zone.style.opacity    = '1'
  })
}

// =============================================================================
// PRIVATE RENDER HELPERS
// =============================================================================

// ── _renderEmpty() ────────────────────────────────────────────────────────────
// Shown when no manifest has been generated yet (no play sessions completed).
function _renderEmpty() {
  return `
    <div class="bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 p-6">
      <div class="flex items-center gap-2 mb-3">
        <span class="inline-block w-2 h-2 rounded-full bg-cr-coral flex-shrink-0"></span>
        <h3 class="font-heading text-cr-cream text-sm font-bold">Upcoming Crate Preview</h3>
      </div>
      <p class="font-body text-cr-cream/55 text-sm leading-relaxed mb-5">
        Your first personalised physical kit will assemble automatically once your child
        completes their initial play sequences in the physics sandbox.
      </p>
      <div class="flex flex-wrap gap-2 mb-4">
        <span class="px-2.5 py-1 rounded-full bg-cr-sage/10 text-cr-sage font-body text-xs">Physical kit</span>
        <span class="px-2.5 py-1 rounded-full bg-cr-sage/10 text-cr-sage font-body text-xs">Monthly delivery</span>
        <span class="px-2.5 py-1 rounded-full bg-cr-sage/10 text-cr-sage font-body text-xs">Bilingual cards (EN + AF)</span>
      </div>
      <a href="/sandbox" data-nav
         class="font-body text-cr-sage text-xs hover:text-cr-cream transition-colors underline underline-offset-2">
        Enter sandbox to begin &rarr;
      </a>
    </div>`
}

// ── _renderManifest(manifest) ────────────────────────────────────────────────
// Full kit preview when a manifest exists.
function _renderManifest(manifest) {
  const { components, orderId, generatedAt, language, pivotModifier, isWheelSpinPivot } = manifest

  const primaryStyle   = _SHARE_STYLE[70]
  const secondaryStyle = _SHARE_STYLE[20]
  const stretchStyle   = _SHARE_STYLE[10]

  const primaryLabel   = _DIM_LABELS[components.primary?.dimension]   || 'Exploration'
  const secondaryLabel = _DIM_LABELS[components.secondary?.dimension] || 'Building'
  const stretchLabel   = _DIM_LABELS[components.stretch?.dimension]   || 'Discovery'

  const dateStr = generatedAt
    ? new Date(generatedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
    : 'Upcoming'

  const pivotNotice = isWheelSpinPivot && pivotModifier
    ? `<div class="mt-4 p-3 bg-cr-coral/10 border border-cr-coral/20 rounded-xl">
         <p class="font-body text-cr-coral text-xs leading-relaxed">
           <strong class="font-semibold">[PIVOT] </strong>${_sanitise(pivotModifier.replace('[PIVOT] ', ''))}
         </p>
       </div>`
    : ''

  return `
    <div class="bg-cr-charcoal rounded-2xl border border-cr-coral/20 overflow-hidden">

      <!-- Kit header -->
      <div class="px-5 pt-5 pb-4 border-b border-cr-charcoal/60 flex items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="inline-block w-2 h-2 rounded-full bg-cr-coral flex-shrink-0"></span>
            <h3 class="font-heading text-cr-cream text-sm font-bold">Upcoming Crate</h3>
          </div>
          <p class="font-heading text-cr-cream text-xl font-extrabold">
            ${_sanitise(components.primary?.kitType || 'Explorer Kit')}
          </p>
          <p class="font-body text-cr-sage text-xs mt-0.5">${_sanitise(primaryLabel)} · ${_sanitise(components.primary?.tagline || '')}</p>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="font-body text-cr-cream/30 text-[10px] uppercase tracking-wider">${dateStr}</p>
          <p class="font-body text-cr-cream/20 text-[10px]">${_sanitise(orderId || '')}</p>
        </div>
      </div>

      <!-- 70/20/10 component zones -->
      <div class="p-5 flex flex-col gap-3">

        <!-- 70% Primary component -->
        <div class="rounded-xl border-l-4 ${primaryStyle.borderColor} bg-cr-slate/40 p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="inline-block px-2 py-0.5 rounded-full font-body text-[10px] font-semibold uppercase tracking-wider ${primaryStyle.badge}">
              ${primaryStyle.label}
            </span>
          </div>
          <ul class="flex flex-col gap-1">
            ${(components.primary?.items || []).map(item => `
              <li class="flex items-start gap-2 font-body text-cr-cream/65 text-sm">
                <span class="text-cr-coral flex-shrink-0 mt-0.5">&#10003;</span>
                <span>${_sanitise(item)}</span>
              </li>`).join('')}
          </ul>
        </div>

        <!-- 20% Secondary component -->
        <div class="rounded-xl border-l-4 ${secondaryStyle.borderColor} bg-cr-slate/40 p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="inline-block px-2 py-0.5 rounded-full font-body text-[10px] font-semibold uppercase tracking-wider ${secondaryStyle.badge}">
              ${secondaryStyle.label}
            </span>
            <span class="font-body text-cr-cream/30 text-xs">${_sanitise(secondaryLabel)} focus</span>
          </div>
          <ul class="flex flex-col gap-1">
            ${(components.secondary?.items || []).map(item => `
              <li class="flex items-start gap-2 font-body text-cr-cream/65 text-sm">
                <span class="text-cr-sage flex-shrink-0 mt-0.5">&#10003;</span>
                <span>${_sanitise(item)}</span>
              </li>`).join('')}
          </ul>
        </div>

        <!-- 10% Stretch component -->
        <div class="rounded-xl border-l-4 ${stretchStyle.borderColor} bg-cr-slate/40 p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="inline-block px-2 py-0.5 rounded-full font-body text-[10px] font-semibold uppercase tracking-wider ${stretchStyle.badge}">
              ${stretchStyle.label}
            </span>
            <span class="font-body text-cr-cream/30 text-xs">${_sanitise(stretchLabel)} exploration</span>
          </div>
          <ul class="flex flex-col gap-1">
            ${(components.stretch?.items || []).map(item => `
              <li class="flex items-start gap-2 font-body text-cr-cream/65 text-sm">
                <span class="text-cr-cream/35 flex-shrink-0 mt-0.5">&#10003;</span>
                <span>${_sanitise(item)}</span>
              </li>`).join('')}
          </ul>
        </div>

      </div>

      <!-- Challenge cards footer -->
      <div class="px-5 pb-5 flex flex-col gap-3">
        <div class="bg-cr-slate/40 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <span class="font-body text-cr-cream/40 text-xs">Challenge cards included:</span>
          <span class="px-2.5 py-0.5 rounded-full bg-cr-sage/10 text-cr-sage font-body text-xs">
            ${language === 'bilingual' ? 'Bilingual — English &amp; Afrikaans' : _sanitise(language)}
          </span>
          <span class="px-2.5 py-0.5 rounded-full bg-cr-sage/10 text-cr-sage font-body text-xs">
            Double-sided print
          </span>
        </div>
        ${pivotNotice}
      </div>

    </div>`
}

// ── _sanitise(str) ────────────────────────────────────────────────────────────
function _sanitise(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
