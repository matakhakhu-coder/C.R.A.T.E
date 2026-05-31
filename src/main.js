// ── src/main.js ─────────────────────────────────────────────────────────────
// C.R.A.T.E. application orchestrator — Phase 3: Digital Sandbox.
// Single-pass hydration: all render() helpers → ONE innerHTML write → all init()s.
//
// Render paths:
//   /admin    → Admin shell placeholder (Phase 8)
//   /app      → Onboarding wizard | authenticated portal
//   /sandbox  → Physics play environment (this phase)
//   /         → Public marketing shell

import './style.css'
import { createSubscription }  from '@/core/integrations/payment.js'
import { registerParent }      from '@/core/integrations/auth.js'
import { sendOTP, verifyOTP }  from '@/core/integrations/otp.js'
import { storeParentRecord }   from '@/core/integrations/piiStore.js'
// Phase 4: uploadSessionData and assessment now handled by TelemetryCollector pipeline.
// TelemetryCollector receives cr:sessionEnd, calls uploadSessionData, then AssessmentEngine.
import { init as initTelemetryCollector } from '@/modules/TelemetryCollector.js'

// ── DOM mount ─────────────────────────────────────────────────────────────────
const app = document.getElementById('app')

// ── Shared state ──────────────────────────────────────────────────────────────
let _toastTimer    = null
let _previousRoute = null

// ── Phase 2 wizard state ──────────────────────────────────────────────────────
let _appStep       = 1
let _appAccountRef = null
let _appFormData   = { parentName: '', parentEmail: '', parentPhone: '',
                       childNickname: '', childAgeGroup: '' }

// ── Phase 3 sandbox state ─────────────────────────────────────────────────────
// RAF handle — cancelled whenever the sandbox route is left.
let _sandboxRAF       = null
// Active physics bodies array.
let _sandboxBodies    = []
// Dragging state.
let _sandboxDrag      = null   // { body, offX, offY }
let _sandboxDragPrevX = 0
let _sandboxDragPrevY = 0
let _sandboxDragVX    = 0
let _sandboxDragVY    = 0
// Theme cycling.
let _sandboxTheme     = 0
// Telemetry collection.
let _sandboxSigBuffer = {}     // { assessmentKey: eventCount }
let _sandboxSigTimes  = {}     // { sandboxSignal: lastFireMs } for debounce
let _sandboxSessionMs = 0      // Session start timestamp
// Collapse detection.
let _sandboxCollapseMs = 0     // Time of last structural collapse
// First-action tracking.
let _sandboxFirstAct   = false // Has the child made their first action?
// Drag timing for speed variability.
let _sandboxDragLog    = []    // [{ startMs, endMs }] — last 10 drag events
// Canvas bounds tracking for exploration breadth.
let _sandboxTouchZones = new Set() // Grid cell strings 'cx,cy' touched

// ── Physics constants ─────────────────────────────────────────────────────────
const _PHYS = Object.freeze({
  GRAVITY:            0.35,
  RESTITUTION:        0.45,
  GROUND_FRICTION:    0.985,
  ANG_DAMP:           0.93,
  BOUNDARY_VEL_THRESH: 8,    // Speed at which boundary_testing fires
  TOOL_DIST_THRESH:    5,    // Pixel overlap to count as tool interaction
  GRID_CELLS:          8,    // Exploration grid divisions per axis
})

// ── Colour themes (4 presets, child-facing — no clinical labels) ──────────────
const _THEMES = [
  { name: 'forest', palette: ['#7A9A86', '#E07A5F', '#52B788', '#E9C46A'] },
  { name: 'warm',   palette: ['#F4A261', '#E76F51', '#FFBA08', '#E9C46A'] },
  { name: 'cool',   palette: ['#48CAE4', '#0096C7', '#ADE8F4', '#023E8A'] },
  { name: 'earth',  palette: ['#8B5E3C', '#C9AE8C', '#556B2F', '#D4A017'] },
]

// ── Sandbox signal → assessmentTables.js micro-signal key mapping ─────────────
// Directive-named sandbox events map to canonical assessment keys so Phase 4
// AssessmentEngine can process the buffered data without modification.
const _SIG = Object.freeze({
  novelty_exploration:    'explorationBreadth',
  spatial_rotation:       'backtrackingBehavior',
  structural_persistence: 'retryFrequency',
  symbolic_substitution:  'creativeModifications',
  tool_utilization:       'sequencePaths',
  boundary_testing:       'ruleBreakingAttempts',
  time_to_first_action:   'timeToFirstAction',
  optional_interaction:   'optionalInteractions',
  speed_variability:      'speedVariability',
})

// =============================================================================
// PHASE 1 RENDER HELPERS
// =============================================================================

function _renderNavbar() {
  return `
    <nav id="cr-nav"
         class="sticky top-0 z-40 bg-cr-slate/95 backdrop-blur-sm
                border-b border-cr-charcoal shadow-nav">
      <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <a href="/" data-nav
           class="font-heading text-cr-cream text-xl font-extrabold tracking-widest
                  hover:text-cr-sage transition-colors duration-200">C·R·A·T·E</a>
        <div class="hidden md:flex items-center gap-6">
          <a href="/app"   data-nav class="font-body text-cr-cream/60 text-sm hover:text-cr-cream transition-colors">Parent Portal</a>
          <a href="/admin" data-nav class="font-body text-cr-cream/60 text-sm hover:text-cr-cream transition-colors">Admin</a>
          <a href="#pricing" data-scroll class="btn-primary text-sm px-5 py-2.5 min-h-[44px]">Get Started</a>
        </div>
        <button data-mobile-menu-btn aria-label="Open navigation menu" aria-expanded="false"
                class="md:hidden flex flex-col justify-center gap-1.5 w-10 h-10 rounded-lg hover:bg-cr-charcoal transition-colors">
          <span class="block w-5 h-0.5 bg-cr-cream mx-auto"></span>
          <span class="block w-5 h-0.5 bg-cr-cream mx-auto"></span>
          <span class="block w-5 h-0.5 bg-cr-cream mx-auto"></span>
        </button>
      </div>
      <div data-mobile-menu-drawer class="hidden border-t border-cr-charcoal bg-cr-slate">
        <div class="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3">
          <a href="/app"   data-nav class="font-body text-cr-cream/70 text-sm py-2 hover:text-cr-cream">Parent Portal</a>
          <a href="/admin" data-nav class="font-body text-cr-cream/70 text-sm py-2 hover:text-cr-cream">Admin</a>
          <a href="#pricing" data-scroll class="btn-primary text-sm text-center">Get Started</a>
        </div>
      </div>
    </nav>`
}

function _renderHero() {
  return `
    <section class="bg-cr-slate pt-20 pb-24 px-4 text-center">
      <div class="max-w-4xl mx-auto">
        <p class="font-body text-cr-sage text-xs font-semibold uppercase tracking-widest mb-5">
          Developmental Play Assistant &nbsp;·&nbsp; STEAM Interest Exploration Tool
        </p>
        <h1 class="font-heading text-cr-cream text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
          Unlocking Potential<br />Through Play
        </h1>
        <p class="font-body text-cr-cream/65 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-10">
          C.R.A.T.E. silently reads your child's natural play style inside a digital physics sandbox,
          then ships a personalised physical STEAM kit curated to match exactly how their interests are growing.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <a href="#pricing"    data-scroll class="btn-primary w-full sm:w-auto">Choose Your Crate</a>
          <a href="#dimensions" data-scroll class="btn-secondary w-full sm:w-auto">See the 6 Play Dimensions</a>
        </div>
        <div class="mt-16 grid grid-cols-3 gap-6 max-w-md mx-auto">
          <div><p class="font-heading text-cr-coral text-3xl font-extrabold">10</p>
               <p class="font-body text-cr-cream/40 text-xs uppercase tracking-wide mt-1">Play signals tracked</p></div>
          <div><p class="font-heading text-cr-coral text-3xl font-extrabold">6</p>
               <p class="font-body text-cr-cream/40 text-xs uppercase tracking-wide mt-1">Interest dimensions</p></div>
          <div><p class="font-heading text-cr-coral text-3xl font-extrabold">1</p>
               <p class="font-body text-cr-cream/40 text-xs uppercase tracking-wide mt-1">Personalised crate</p></div>
        </div>
      </div>
    </section>`
}

const _dimensions = [
  { key: 'curiosity',           label: 'Curiosity',            border: 'border-cr-sage',     dot: 'bg-cr-sage',
    description: 'How eagerly your child investigates new tools, asks "what happens if?", and reaches into unexplored corners of the sandbox. Wide-ranging exploration is a strong signal of active interest in the world.',
    signals: 'Tracked via: Exploration Breadth · Optional Interactions · Rule-Breaking Attempts' },
  { key: 'spatial-reasoning',   label: 'Spatial Reasoning',    border: 'border-cr-coral',    dot: 'bg-cr-coral',
    description: 'How your child plans layouts, rotates objects mentally before placing them, and navigates three-dimensional challenges. Builders who return to refine spatial arrangements are deepening this interest area.',
    signals: 'Tracked via: Sequence Paths · Backtracking Behaviour · Exploration Breadth' },
  { key: 'systems-thinking',    label: 'Systems Thinking',     border: 'border-cr-cream/30', dot: 'bg-cr-cream',
    description: 'How your child sequences actions, spots cause-and-effect chains, and monitors their own process. Methodical players who plan before acting and self-correct along the way are showing this interest growing.',
    signals: 'Tracked via: Sequence Paths · Backtracking Behaviour · Speed Variability' },
  { key: 'narrative-imagination',label: 'Narrative Imagination',border: 'border-cr-sage',    dot: 'bg-cr-sage',
    description: 'How your child decorates, names, and invents stories around their builds. Children who add non-functional flourishes are expressing rich associative thinking and a desire to give objects meaning.',
    signals: 'Tracked via: Optional Interactions · Creative Modifications · Rule-Breaking Attempts' },
  { key: 'mechanical-intuition', label: 'Mechanical Intuition', border: 'border-cr-coral',   dot: 'bg-cr-coral',
    description: 'How your child develops an internal feel for how objects balance, connect, and move under forces. Experimenters who predict physics outcomes before testing them are showing this interest taking shape.',
    signals: 'Tracked via: Creative Modifications · Retry Frequency · Sequence Paths' },
  { key: 'divergent-thinking',  label: 'Divergent Thinking',   border: 'border-cr-cream/30', dot: 'bg-cr-cream',
    description: 'How freely your child generates fresh approaches, tests the rules of the system, and resists stopping at the first solution. High originality and boundary-testing are hallmarks of this interest area.',
    signals: 'Tracked via: Rule-Breaking Attempts · Creative Modifications · Optional Interactions' },
]

function _renderDimensionMatrix() {
  const cards = _dimensions.map(d => `
    <div class="bg-cr-slate rounded-2xl p-6 border-t-4 ${d.border} shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <div class="flex items-center gap-2.5 mb-4">
        <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.dot}"></span>
        <h3 class="font-heading text-cr-cream text-base font-bold">${d.label}</h3>
      </div>
      <p class="font-body text-cr-cream/65 text-sm leading-relaxed mb-4">${d.description}</p>
      <p class="font-body text-cr-cream/25 text-xs leading-relaxed">${d.signals}</p>
    </div>`).join('')
  return `
    <section id="dimensions" class="bg-cr-charcoal py-20 px-4">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-12">
          <p class="font-body text-cr-sage text-xs font-semibold uppercase tracking-widest mb-3">The Play Interest Framework</p>
          <h2 class="font-heading text-cr-cream text-3xl md:text-4xl font-extrabold mb-4">Six Play Interest Areas We Track</h2>
          <p class="font-body text-cr-cream/55 text-base max-w-2xl mx-auto leading-relaxed">
            Every time your child plays in the sandbox, the engine silently maps their behaviour to these six
            activity interest areas — no scores, no labels, just a growing picture of what lights them up.
          </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${cards}</div>
      </div>
    </section>`
}

const _plans = [
  { id: 'starter',   name: 'Starter Kit',     price: 'R650',  period: '/month', tag: null,
    focus: 'Curiosity · Spatial Reasoning',  highlight: false,
    features: ['Monthly personalised physical crate','Physics-based building materials','Standard challenge card set (English)','Basic play interest summary','Pudo or Paxi delivery included'] },
  { id: 'explorer',  name: 'Explorer Pack',   price: 'R850',  period: '/month', tag: 'Most Popular',
    focus: 'Systems Thinking · Mechanical Intuition', highlight: true,
    features: ['Monthly personalised physical crate','Expanded mechanical toolkit & gears','2 bilingual challenge card sets (EN + AF)','Full play trajectory dashboard access','Play-style coaching prompts for parents','Pudo or Paxi delivery included'] },
  { id: 'architect', name: 'Architect Bundle',price: 'R1150', period: '/month', tag: null,
    focus: 'All 6 Interest Areas', highlight: false,
    features: ['Monthly personalised physical crate','Full 6-dimension material set','Custom-printed bilingual challenge cards','Advanced play trajectory insights','Priority Pudo smart locker delivery','Exclusive prototype build components'] },
]

function _renderPricing() {
  const cards = _plans.map(p => {
    const tagHtml = p.tag
      ? `<span class="inline-block mb-3 px-3 py-1 bg-cr-coral text-cr-cream font-body text-xs font-semibold rounded-full uppercase tracking-wider">${p.tag}</span>`
      : `<span class="inline-block mb-3 h-6"></span>`
    const features = p.features.map(f => `
      <li class="flex items-start gap-2">
        <span class="text-cr-sage text-sm mt-0.5 flex-shrink-0">&#10003;</span>
        <span class="font-body text-cr-cream/65 text-sm">${f}</span>
      </li>`).join('')
    const cls = p.highlight ? 'bg-cr-charcoal border-2 border-cr-coral shadow-card-hover' : 'bg-cr-charcoal border border-cr-charcoal/60 shadow-card'
    return `
      <div class="${cls} rounded-2xl p-6 flex flex-col">
        <div class="mb-6">
          ${tagHtml}
          <h3 class="font-heading text-cr-cream text-xl font-bold mb-1">${p.name}</h3>
          <p class="font-body text-cr-sage text-xs mb-4">${p.focus}</p>
          <div class="flex items-baseline gap-1">
            <span class="font-heading text-cr-cream text-4xl font-extrabold">${p.price}</span>
            <span class="font-body text-cr-cream/35 text-sm">${p.period}</span>
          </div>
        </div>
        <ul class="flex flex-col gap-3 mb-8 flex-1">${features}</ul>
        <button data-subscribe="${p.id}" data-tier-name="${p.name}" data-tier-price="${p.price}"
                class="btn-primary w-full text-sm">Subscribe Now</button>
      </div>`
  }).join('')
  return `
    <section id="pricing" class="bg-cr-slate py-20 px-4">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-12">
          <p class="font-body text-cr-sage text-xs font-semibold uppercase tracking-widest mb-3">Subscription Plans</p>
          <h2 class="font-heading text-cr-cream text-3xl md:text-4xl font-extrabold mb-4">Choose Your Crate Plan</h2>
          <p class="font-body text-cr-cream/55 text-base max-w-xl mx-auto leading-relaxed">
            All plans include the digital sandbox, play interest tracking, and your personalised monthly crate
            delivered across South Africa.
          </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">${cards}</div>
        <p class="text-center font-body text-cr-cream/25 text-xs mt-8">
          Simulation mode active · No real payment processed · POPIA compliant · SA delivery only
        </p>
      </div>
    </section>`
}

function _renderFooter() {
  return `
    <footer class="bg-cr-charcoal border-t border-cr-slate py-10 px-4">
      <div class="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <p class="font-heading text-cr-cream text-lg font-extrabold tracking-widest mb-1">C·R·A·T·E</p>
          <p class="font-body text-cr-cream/35 text-xs">Developmental Play Assistant · STEAM Interest Exploration Tool</p>
        </div>
        <div class="flex flex-col items-center md:items-end gap-1.5">
          <p class="font-body text-cr-cream/30 text-xs text-center md:text-right">
            Behavioral play signals and identity records are stored in fully isolated systems.
          </p>
          <p class="font-body text-cr-cream/20 text-xs">
            &copy; ${new Date().getFullYear()} C.R.A.T.E. &middot; All rights reserved &middot; POPIA compliant &middot; South Africa
          </p>
        </div>
      </div>
    </footer>`
}

function _renderPOPIABanner() {
  return `
    <div id="cr-popia-banner"
         class="fixed bottom-0 left-0 right-0 z-50 bg-cr-charcoal border-t-2 border-cr-sage"
         role="complementary" aria-label="Data privacy notice">
      <div class="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div class="flex-1">
          <p class="font-body text-cr-cream text-sm font-semibold mb-1">Your child's play data is kept completely separate from your personal details.</p>
          <p class="font-body text-cr-cream/50 text-xs leading-relaxed">
            Behavioral signals from sandbox play are stored under a randomised identifier only.
            Your name, email, and address are never linked to play records. POPIA compliant &middot; South Africa.
          </p>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <button data-accept-consent class="btn-consent text-sm px-4 py-2 min-h-[44px]">Accept &amp; Continue</button>
          <button data-review-consent class="font-body text-cr-cream/45 text-xs underline underline-offset-2 hover:text-cr-cream transition-colors min-h-[44px] px-2">Review Policy</button>
        </div>
      </div>
    </div>`
}

// =============================================================================
// PHASE 2 RENDER HELPERS
// =============================================================================

function _renderWizardShell(step, title, bodyHtml) {
  const labels = ['Account', 'Verify', 'Profile', 'Privacy']
  const dots = labels.map((label, i) => {
    const n = i + 1
    const done = n < step, cur = n === step
    const dotCls = done ? 'bg-cr-sage text-cr-cream' : cur ? 'bg-cr-coral text-cr-cream' : 'bg-cr-charcoal text-cr-cream/30 border border-cr-cream/10'
    const txtCls = done ? 'text-cr-sage' : cur ? 'text-cr-coral' : 'text-cr-cream/25'
    return `
      <div class="flex flex-col items-center gap-1.5">
        <div class="w-8 h-8 rounded-full flex items-center justify-center ${dotCls} font-heading text-xs font-bold">
          ${done ? '&#10003;' : n}
        </div>
        <span class="font-body ${txtCls} text-xs hidden sm:block">${label}</span>
      </div>`
  }).join(`<div class="flex-1 h-px bg-cr-charcoal mt-4 mx-1"></div>`)

  return `
    <div class="min-h-screen bg-cr-slate flex flex-col">
      <div class="max-w-2xl mx-auto w-full px-4 pt-6 flex items-center justify-between">
        <a href="/" data-nav class="font-heading text-cr-sage text-xl font-extrabold tracking-widest hover:text-cr-cream transition-colors">C·R·A·T·E</a>
        <a href="/" data-nav class="font-body text-cr-cream/35 text-xs hover:text-cr-cream/70 transition-colors">&#8592; Back to Home</a>
      </div>
      ${step <= 4 ? `
      <div class="max-w-2xl mx-auto w-full px-4 mt-8">
        <div class="flex items-start">${dots}</div>
        <p class="font-body text-cr-cream/30 text-xs text-right mt-2">Step ${step} of 4: ${title}</p>
      </div>` : ''}
      <div class="max-w-2xl mx-auto w-full px-4 mt-6 pb-16 flex-1">
        <div class="bg-cr-slate/60 backdrop-blur-md border border-cr-sage/20 rounded-2xl shadow-card p-6 md:p-8">
          ${bodyHtml}
        </div>
      </div>
    </div>`
}

function _renderField({ id, name, type = 'text', label, placeholder, value = '', inputmode = '' }) {
  return `
    <div>
      <label for="${id}" class="block font-body text-cr-cream/70 text-xs font-medium mb-1.5">${label}</label>
      <input id="${id}" name="${name}" type="${type}" value="${_sanitise(value)}"
             placeholder="${placeholder}" ${inputmode ? `inputmode="${inputmode}"` : ''}
             autocomplete="off"
             class="w-full bg-cr-charcoal border border-cr-charcoal hover:border-cr-sage/40
                    focus:border-cr-sage outline-none rounded-xl px-4 py-3
                    font-body text-cr-cream text-sm placeholder:text-cr-cream/25
                    transition-colors duration-200" />
      <p id="err-${name}" class="font-body text-cr-coral text-xs mt-1 min-h-[1rem]"></p>
    </div>`
}

function _renderWizardStep1(data) {
  return _renderWizardShell(1, 'Account Creation', `
    <h2 class="font-heading text-cr-cream text-2xl font-extrabold mb-2">Create Your Account</h2>
    <p class="font-body text-cr-cream/50 text-sm mb-6 leading-relaxed">
      Your account details are stored securely and completely separate from your child's play activity records.
    </p>
    <form id="wizard-form-1" novalidate class="flex flex-col gap-4">
      ${_renderField({ id: 'f-name',  name: 'parentName',  label: 'Parent Full Name', placeholder: 'e.g. Amahle Dlamini', value: data.parentName })}
      ${_renderField({ id: 'f-email', name: 'parentEmail', type: 'email', label: 'Contact Email', placeholder: 'your@email.co.za', value: data.parentEmail })}
      ${_renderField({ id: 'f-phone', name: 'parentPhone', type: 'tel', inputmode: 'tel', label: 'SA Mobile Number', placeholder: '072 000 0000', value: data.parentPhone })}
      <button type="submit" class="btn-primary w-full mt-2">Continue &rarr;</button>
    </form>`)
}

function _renderWizardStep2(data) {
  const masked = data.parentPhone
    ? data.parentPhone.replace(/^(\+27|0)(\d{2})(\d+)(\d{3})$/, (_, p, a, b, c) => `+27 ${a} *** ${c}`)
    : 'your mobile number'
  return _renderWizardShell(2, 'Mobile Verification', `
    <h2 class="font-heading text-cr-cream text-2xl font-extrabold mb-2">Verify Your Number</h2>
    <p class="font-body text-cr-cream/50 text-sm mb-1 leading-relaxed">
      A 6-digit verification code was sent to <span class="text-cr-sage font-semibold">${_sanitise(masked)}</span>.
    </p>
    <p class="font-body text-cr-coral/80 text-xs mb-6">
      Simulation mode: enter <strong class="font-bold tracking-widest">000000</strong> to proceed.
    </p>
    <div class="flex flex-col gap-4">
      <div>
        <label for="otp-input" class="block font-body text-cr-cream/70 text-xs font-medium mb-1.5">6-Digit Verification Code</label>
        <input id="otp-input" type="text" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code"
               class="w-full bg-cr-charcoal border-2 border-cr-sage/30 hover:border-cr-sage/60 focus:border-cr-sage
                      outline-none rounded-xl px-4 py-4 font-heading text-cr-cream text-3xl tracking-[0.5em] text-center
                      placeholder:text-cr-cream/20 placeholder:text-base placeholder:tracking-normal transition-colors duration-200" />
        <p id="err-otp" class="font-body text-cr-coral text-xs mt-1 min-h-[1rem]"></p>
      </div>
      <p class="font-body text-cr-cream/30 text-xs text-center">
        Code expires in 10:00 &nbsp;&middot;&nbsp;
        <a id="otp-resend" href="#" class="text-cr-sage/70 hover:text-cr-sage underline underline-offset-2 transition-colors">Resend SMS Code</a>
      </p>
      <button id="otp-verify-btn" class="btn-primary w-full">Verify Code &rarr;</button>
    </div>`)
}

function _renderWizardStep3(data) {
  const brackets = [
    { v: '3-5', label: 'Ages 3-5', sub: 'Early Explorer' },
    { v: '6-8', label: 'Ages 6-8', sub: 'Active Builder' },
    { v: '9-12', label: 'Ages 9-12', sub: 'Systems Thinker' },
  ]
  const ageBtns = brackets.map(a => {
    const sel = data.childAgeGroup === a.v
    const cls = sel ? 'bg-cr-sage/20 border-cr-sage text-cr-cream' : 'bg-cr-charcoal border-cr-charcoal/50 text-cr-cream/55 hover:border-cr-sage/30'
    return `<button type="button" data-age="${a.v}"
              class="${cls} rounded-xl border py-4 flex flex-col items-center gap-1 font-body
                     transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cr-sage">
              <span class="text-sm font-semibold">${a.label}</span>
              <span class="text-xs opacity-60">${a.sub}</span>
            </button>`
  }).join('')
  return _renderWizardShell(3, 'Child Profile', `
    <h2 class="font-heading text-cr-cream text-2xl font-extrabold mb-2">Child Profile</h2>
    <p class="font-body text-cr-cream/50 text-sm mb-6 leading-relaxed">
      The nickname is used only to label your dashboard. It is never linked to play activity records.
    </p>
    <form id="wizard-form-3" novalidate class="flex flex-col gap-5">
      ${_renderField({ id: 'f-nickname', name: 'childNickname', label: 'Child Nickname (for profile isolation)', placeholder: 'e.g. Luca, TigerBee, Zara...', value: data.childNickname })}
      <div>
        <p class="font-body text-cr-cream/70 text-xs font-medium mb-2">Age Group</p>
        <div class="grid grid-cols-3 gap-3" id="age-bracket-grid">${ageBtns}</div>
        <p id="err-childAge" class="font-body text-cr-coral text-xs mt-1 min-h-[1rem]"></p>
      </div>
      <button type="submit" class="btn-primary w-full mt-1">Continue &rarr;</button>
    </form>`)
}

function _renderWizardStep4() {
  return _renderWizardShell(4, 'Privacy Agreement', `
    <h2 class="font-heading text-cr-cream text-2xl font-extrabold mb-2">Privacy Agreement</h2>
    <p class="font-body text-cr-cream/50 text-sm mb-4 leading-relaxed">
      Please read our data protection terms and confirm your authorisation.
    </p>
    <div class="bg-cr-charcoal rounded-xl border border-cr-charcoal/80 p-4 mb-5 max-h-52 overflow-y-auto
                font-body text-cr-cream/55 text-xs leading-relaxed scroll-smooth">
      <p class="font-semibold text-cr-cream/80 mb-2">C.R.A.T.E. Data Protection Policy</p>
      <p class="mb-3"><strong class="text-cr-cream/70">1. What we collect.</strong> C.R.A.T.E. operates a developmental play assistant and STEAM interest exploration tool. We collect two strictly isolated categories of data: (a) your personal contact information and (b) anonymised behavioral play signals. These two categories are never stored together, never cross-referenced, and never joined in any query or report.</p>
      <p class="mb-3"><strong class="text-cr-cream/70">2. How we keep them separate.</strong> Personal details are written exclusively to Database A (the PII Store). Play signals are written exclusively to Database B (the Play Signal Engine) under a randomised pseudonymous identifier that contains no name, email, or phone number.</p>
      <p class="mb-3"><strong class="text-cr-cream/70">3. Where your data lives.</strong> Both databases are hosted exclusively within South Africa's borders (AWS Cape Town region, af-south-1, or Azure Johannesburg) in compliance with Section 72 of POPIA. No child data is transferred outside the Republic of South Africa.</p>
      <p class="mb-3"><strong class="text-cr-cream/70">4. Your rights.</strong> As the competent person (parent or legal guardian) you have the right under POPIA to access, correct, and request deletion of all data associated with your account at any time. A one-click deletion tool in your dashboard will permanently erase all records from both databases.</p>
      <p class="mb-3"><strong class="text-cr-cream/70">5. What we do not collect.</strong> We strictly disable raw cursor path tracking, camera access, microphone access, and biometric data of any kind. All sandbox interaction variables are aggregated into mathematical play interest scores on your device before any transmission.</p>
      <p><strong class="text-cr-cream/70">6. Contact.</strong> For data enquiries, correction requests, or deletion requests, contact us at the details listed in your account dashboard once registration is complete.</p>
    </div>
    <label class="flex items-start gap-3 cursor-pointer group mb-5">
      <input id="popia-consent-checkbox" type="checkbox"
             class="mt-0.5 w-5 h-5 flex-shrink-0 rounded border-cr-sage/40 bg-cr-charcoal accent-[#7A9A86] cursor-pointer" />
      <span class="font-body text-cr-cream/70 text-sm leading-relaxed group-hover:text-cr-cream transition-colors">
        I explicitly authorise the processing of developmental play indicators as described above,
        and confirm I am the parent or legal guardian of the child profile being created.
      </span>
    </label>
    <p id="err-consent" class="font-body text-cr-coral text-xs -mt-3 mb-4 min-h-[1rem]"></p>
    <button id="complete-onboarding-btn" class="btn-primary w-full">Complete Registration &rarr;</button>`)
}

function _renderWizardComplete(data, accountRef) {
  const nick = data.childNickname || 'your child'
  const ref  = accountRef || 'CR-SIM-OK'
  return _renderWizardShell(5, 'Complete', `
    <div class="text-center py-4">
      <div class="w-16 h-16 rounded-full bg-cr-sage/20 border-2 border-cr-sage flex items-center justify-center mx-auto mb-6">
        <span class="font-heading text-cr-sage text-3xl font-extrabold">&#10003;</span>
      </div>
      <h2 class="font-heading text-cr-cream text-2xl font-extrabold mb-2">Registration Complete</h2>
      <p class="font-body text-cr-cream/55 text-sm mb-1">
        Welcome to C.R.A.T.E., <strong class="text-cr-cream">${_sanitise(nick)}</strong> is ready to play.
      </p>
      <p class="font-body text-cr-cream/30 text-xs mb-8">
        Account reference: <code class="text-cr-sage font-semibold">${_sanitise(ref)}</code>
      </p>
      <div class="bg-cr-charcoal rounded-xl border border-cr-sage/15 p-4 mb-8 text-left">
        <p class="font-body text-cr-cream/60 text-xs leading-relaxed">
          <span class="text-cr-sage font-semibold">Your data isolation is active.</span>
          Personal account details are in Database A only. ${_sanitise(nick)}'s play signals will be
          stored in Database B only under a randomised identifier containing no personal information.
          Both databases are hosted within South Africa. POPIA compliant.
        </p>
      </div>
      <a href="/sandbox" data-nav class="btn-primary w-full sm:w-auto inline-block text-center">
        Enter Play Sandbox &rarr;
      </a>
      <p class="font-body text-cr-cream/25 text-xs mt-4">Your profile is ready &middot; Play anytime</p>
    </div>`)
}

function _renderAppPortal() {
  const nick = localStorage.getItem('cr_child_nickname') || 'Explorer'
  const age  = localStorage.getItem('cr_child_age_group') || ''
  return `
    <div class="min-h-screen bg-cr-slate flex flex-col">
      <div class="max-w-2xl mx-auto w-full px-4 pt-6 flex items-center justify-between">
        <a href="/" data-nav class="font-heading text-cr-sage text-xl font-extrabold tracking-widest hover:text-cr-cream transition-colors">C·R·A·T·E</a>
        <a href="/" data-nav class="font-body text-cr-cream/35 text-xs hover:text-cr-cream/70 transition-colors">&#8592; Home</a>
      </div>
      <div class="max-w-2xl mx-auto w-full px-4 mt-12 pb-16 flex-1">
        <div class="bg-cr-slate/60 backdrop-blur-md border border-cr-sage/20 rounded-2xl shadow-card p-6 md:p-8 text-center">
          <div class="w-14 h-14 rounded-full bg-cr-sage/20 border-2 border-cr-sage flex items-center justify-center mx-auto mb-5">
            <span class="font-heading text-cr-sage text-2xl font-extrabold">&#10003;</span>
          </div>
          <h2 class="font-heading text-cr-cream text-2xl font-extrabold mb-2">
            Welcome back, <span class="text-cr-sage">${_sanitise(nick)}</span>
          </h2>
          ${age ? `<p class="font-body text-cr-cream/40 text-xs mb-6">Age group: ${_sanitise(age)} &middot; POPIA consent on file</p>` : ''}
          <div class="bg-cr-charcoal rounded-xl border border-cr-charcoal/60 p-5 mb-8 text-left">
            <p class="font-heading text-cr-cream text-sm font-bold mb-2">Phase 3 — Play Sandbox</p>
            <p class="font-body text-cr-cream/50 text-sm leading-relaxed">
              The physics sandbox is ready. Build freely, explore, and let your interests guide you.
              Your play journey is being tracked silently — crate personalisation activates automatically.
            </p>
          </div>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/sandbox" data-nav class="btn-primary text-sm">Enter Play Sandbox &rarr;</a>
            <a href="/"        data-nav class="btn-secondary text-sm">Back to Home</a>
          </div>
        </div>
      </div>
    </div>`
}

// =============================================================================
// PHASE 3 RENDER HELPER — Digital Sandbox
// Returns the full-screen immersive play environment shell.
// HPCSA guardrail: zero scores, timers, level counts, or evaluation labels.
// =============================================================================
function _renderSandbox() {
  const theme  = _THEMES[_sandboxTheme]
  const shapes = [
    { type: 'rect',     label: 'Block',    icon: '&#9632;' },
    { type: 'triangle', label: 'Triangle', icon: '&#9650;' },
    { type: 'wedge',    label: 'Wedge',    icon: '&#9699;' },
    { type: 'lever',    label: 'Lever',    icon: '&#9135;' },
  ]

  const spawnBtns = shapes.map(s => `
    <button data-spawn="${s.type}"
            class="w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl
                   bg-cr-charcoal/60 hover:bg-cr-charcoal border border-cr-cream/5
                   hover:border-cr-sage/20 text-cr-cream/60 hover:text-cr-cream
                   font-body text-xs transition-all duration-200 min-h-[52px]">
      <span class="text-lg leading-none">${s.icon}</span>
      <span class="text-[10px] tracking-wide">${s.label}</span>
    </button>`).join('')

  return `
    <div id="sandbox-root" class="fixed inset-0 bg-cr-slate overflow-hidden touch-none">

      <!-- Full-screen physics canvas — init() sizes it to the viewport -->
      <canvas id="physics-canvas" class="block w-full h-full"></canvas>

      <!-- Floating control sidebar — right side, vertically centred -->
      <!-- HPCSA: no scores, timers, or evaluation controls anywhere in this panel -->
      <div class="fixed right-3 top-1/2 -translate-y-1/2 z-20
                  bg-cr-charcoal/30 backdrop-blur-md border border-cr-sage/10
                  rounded-2xl p-2.5 flex flex-col gap-1.5 shadow-card w-16"
           role="toolbar" aria-label="Sandbox tools">

        <!-- Shape spawn buttons -->
        ${spawnBtns}

        <!-- Divider -->
        <div class="h-px bg-cr-sage/10 my-0.5"></div>

        <!-- Theme toggle — fires symbolic_substitution signal -->
        <button data-theme-toggle
                title="Change colours"
                class="w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl
                       bg-cr-charcoal/60 hover:bg-cr-charcoal border border-cr-cream/5
                       hover:border-cr-sage/20 text-cr-cream/60 hover:text-cr-cream
                       font-body text-xs transition-all duration-200 min-h-[52px]">
          <span class="text-lg leading-none" style="color:${theme.palette[0]}">&#9679;</span>
          <span class="text-[10px] tracking-wide">Colour</span>
        </button>

        <!-- Clear board — fires retryFrequency signal -->
        <button data-sandbox-clear
                title="Clear board"
                class="w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl
                       bg-cr-charcoal/60 hover:bg-cr-charcoal border border-cr-cream/5
                       hover:border-cr-coral/20 text-cr-cream/60 hover:text-cr-coral
                       font-body text-xs transition-all duration-200 min-h-[52px]">
          <span class="text-lg leading-none">&#10005;</span>
          <span class="text-[10px] tracking-wide">Clear</span>
        </button>

        <!-- Divider -->
        <div class="h-px bg-cr-sage/10 my-0.5"></div>

        <!-- Return to portal -->
        <a href="/app" data-nav
           class="w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl
                  bg-cr-charcoal/60 hover:bg-cr-charcoal border border-cr-cream/5
                  hover:border-cr-sage/20 text-cr-cream/40 hover:text-cr-cream
                  font-body text-xs transition-all duration-200 min-h-[52px] text-center
                  no-underline">
          <span class="text-lg leading-none">&#8592;</span>
          <span class="text-[10px] tracking-wide">Exit</span>
        </a>

      </div>
    </div>`
}

// =============================================================================
// MAIN RENDER — route dispatcher
// =============================================================================
function render(path, ctx = {}) {
  const route = path === '' ? '/' : path

  if (route === '/') {
    return [
      _renderNavbar(),
      _renderHero(),
      _renderDimensionMatrix(),
      _renderPricing(),
      _renderFooter(),
      ctx.consentAccepted ? '' : _renderPOPIABanner(),
    ].join('')
  }

  if (route === '/app') {
    if (ctx.isOnboarded) return _renderAppPortal()
    const d = _appFormData
    if (_appStep === 1) return _renderWizardStep1(d)
    if (_appStep === 2) return _renderWizardStep2(d)
    if (_appStep === 3) return _renderWizardStep3(d)
    if (_appStep === 4) return _renderWizardStep4()
    if (_appStep === 5) return _renderWizardComplete(d, _appAccountRef)
    return _renderWizardStep1(d)
  }

  if (route === '/sandbox') return _renderSandbox()

  if (route === '/admin') {
    return `
      <div class="min-h-screen bg-cr-slate flex flex-col items-center justify-center px-4">
        <div class="text-center max-w-lg">
          <p class="font-heading text-cr-coral text-sm font-bold uppercase tracking-widest mb-3">Admin Only — Coming in Phase 8</p>
          <h1 class="font-heading text-cr-cream text-3xl md:text-4xl font-extrabold mb-4">Admin Control Shell</h1>
          <p class="font-body text-cr-cream/65 text-base mb-8">Order management and crate queue views will be available here.</p>
          <a href="/" data-nav class="btn-secondary text-sm">&#8592; Back to Home</a>
        </div>
      </div>`
  }

  return `
    <div class="min-h-screen bg-cr-slate flex flex-col items-center justify-center px-4">
      <div class="text-center max-w-lg">
        <p class="font-heading text-cr-coral text-sm font-bold uppercase tracking-widest mb-3">Route not found</p>
        <h1 class="font-heading text-cr-cream text-3xl font-extrabold mb-4">404</h1>
        <p class="font-body text-cr-cream/65 text-base mb-8">
          The path <code class="text-cr-sage">${_sanitise(path)}</code> does not exist.
        </p>
        <a href="/" data-nav class="btn-secondary text-sm">&#8592; Return Home</a>
      </div>
    </div>`
}

// =============================================================================
// PHASE 1 INIT
// =============================================================================
function _initMarketingShell() {
  const btn    = document.querySelector('[data-mobile-menu-btn]')
  const drawer = document.querySelector('[data-mobile-menu-drawer]')
  if (btn && drawer) {
    btn.addEventListener('click', () => {
      const open = !drawer.classList.contains('hidden')
      drawer.classList.toggle('hidden', open)
      btn.setAttribute('aria-expanded', String(!open))
    })
  }

  document.querySelectorAll('[data-subscribe]').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.getAttribute('data-subscribe')
      const nm = b.getAttribute('data-tier-name')
      const pr = b.getAttribute('data-tier-price')
      const orig = b.textContent.trim()
      b.disabled = true; b.textContent = 'Processing...'
      b.classList.add('opacity-70', 'cursor-not-allowed')
      try {
        const auth = await registerParent({ email: null, hashedPassword: null, phoneNumber: null })
        const pay  = await createSubscription({ planId: id, billingFrequency: 'monthly', parentRecordId: auth.parentRecordId })
        console.log('[SIM] main.js — checkout complete · planId:', id)
        console.log('[SIM] main.js — orderId:', pay.orderId)
        b.classList.remove('opacity-70', 'cursor-not-allowed')
        b.className = 'btn-consent w-full text-sm cursor-default'
        b.textContent = '&#10003; Confirmed &middot; ' + (pay.orderId || 'SIM-OK')
        _showToast(`${nm} (${pr}) confirmed! Ref: ${pay.orderId || 'SIM-OK'}`, true)
      } catch (e) {
        b.disabled = false; b.textContent = orig
        b.classList.remove('opacity-70', 'cursor-not-allowed')
        _showToast('Something went wrong — please try again', false)
      }
    })
  })

  const banner = document.getElementById('cr-popia-banner')
  const acc    = document.querySelector('[data-accept-consent]')
  const rev    = document.querySelector('[data-review-consent]')
  if (acc && banner) {
    acc.addEventListener('click', () => {
      localStorage.setItem('cr_consent_accepted', 'true')
      banner.classList.add('hidden')
    })
  }
  if (rev) {
    rev.addEventListener('click', () => {
      _showToast('Full data privacy policy available in the registration wizard', true)
    })
  }
}

// =============================================================================
// PHASE 2 INIT
// =============================================================================
function _initApp(ctx) {
  if (ctx.isOnboarded) { console.log('[CRATE] /app — portal view active'); return }
  const s = _appStep
  if (s === 1) _initStep1()
  if (s === 2) _initStep2()
  if (s === 3) _initStep3()
  if (s === 4) _initStep4()
  if (s === 5) _initComplete()
}

function _initStep1() {
  const form = document.getElementById('wizard-form-1')
  if (!form) return
  form.addEventListener('submit', e => {
    e.preventDefault()
    const name  = (form.querySelector('[name="parentName"]')?.value  || '').trim()
    const email = (form.querySelector('[name="parentEmail"]')?.value || '').trim()
    const phone = (form.querySelector('[name="parentPhone"]')?.value || '').trim().replace(/\s/g, '')
    let ok = true
    const se = (f, m) => { const el = document.getElementById(`err-${f}`); if (el) el.textContent = m; if (m) ok = false }
    se('parentName',  name.length  >= 2 ? '' : 'Please enter your full name')
    se('parentEmail', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Please enter a valid email address')
    se('parentPhone', /^(\+27|0)(6|7|8)[0-9]{8}$/.test(phone) ? '' : 'Please enter a valid SA mobile number (e.g. 072 000 0000)')
    if (!ok) return
    _appFormData.parentName  = name
    _appFormData.parentEmail = email
    _appFormData.parentPhone = phone
    _appStep = 2; _hydrate('/app')
  })
}

async function _initStep2() {
  try {
    const r = await sendOTP({ phoneNumber: _appFormData.parentPhone, consentSessionId: `cr-session-${Date.now()}` })
    console.log('[SIM] main.js — OTP dispatched · phone present:', !!_appFormData.parentPhone)
    console.log('[SIM] main.js — sentAt:', r.sentAt)
    console.log('[SIM] main.js — enter "000000" to proceed in simulation mode')
  } catch (e) { _showToast('Failed to send verification code', false) }

  const inp = document.getElementById('otp-input')
  const btn = document.getElementById('otp-verify-btn')
  const err = document.getElementById('err-otp')
  const res = document.getElementById('otp-resend')
  if (inp) inp.focus()
  if (btn && inp) {
    btn.addEventListener('click', async () => {
      const code = inp.value.trim()
      if (!/^\d{6}$/.test(code)) { if (err) err.textContent = 'Please enter the 6-digit code'; return }
      if (err) err.textContent = ''
      const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Verifying...'
      try {
        const r = await verifyOTP({ phoneNumber: _appFormData.parentPhone, code, consentSessionId: `cr-session-${Date.now()}` })
        if (r.verified) { _appStep = 3; _hydrate('/app') }
        else { if (err) err.textContent = 'Incorrect code — please try again (use 000000 in sim mode)'; btn.disabled = false; btn.textContent = orig }
      } catch (e) { btn.disabled = false; btn.textContent = orig; _showToast('Verification failed', false) }
    })
  }
  if (res) {
    res.addEventListener('click', async ev => {
      ev.preventDefault(); res.textContent = 'Sending...'
      try { await sendOTP({ phoneNumber: _appFormData.parentPhone, consentSessionId: `cr-resend-${Date.now()}` }); res.textContent = 'Code resent!'; setTimeout(() => { res.textContent = 'Resend SMS Code' }, 3000) }
      catch { res.textContent = 'Resend SMS Code' }
    })
  }
}

function _initStep3() {
  let selAge = _appFormData.childAgeGroup || ''
  const form   = document.getElementById('wizard-form-3')
  const ageBtns = document.querySelectorAll('[data-age]')
  const errAge  = document.getElementById('err-childAge')
  const errNick = document.getElementById('err-childNickname')
  const USEL = 'bg-cr-charcoal border-cr-charcoal/50 text-cr-cream/55 hover:border-cr-sage/30'
  const SEL  = 'bg-cr-sage/20 border-cr-sage text-cr-cream'
  ageBtns.forEach(b => {
    b.addEventListener('click', () => {
      selAge = b.getAttribute('data-age')
      ageBtns.forEach(x => { x.className = `${x.getAttribute('data-age') === selAge ? SEL : USEL} rounded-xl border py-4 flex flex-col items-center gap-1 font-body transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cr-sage` })
      if (errAge) errAge.textContent = ''
    })
  })
  if (!form) return
  form.addEventListener('submit', e => {
    e.preventDefault()
    const nick = (form.querySelector('[name="childNickname"]')?.value || '').trim()
    let ok = true
    if (nick.length < 2) { if (errNick) errNick.textContent = 'Please enter a nickname (at least 2 characters)'; ok = false } else { if (errNick) errNick.textContent = '' }
    if (!selAge) { if (errAge) errAge.textContent = 'Please select an age group'; ok = false } else { if (errAge) errAge.textContent = '' }
    if (!ok) return
    _appFormData.childNickname = nick; _appFormData.childAgeGroup = selAge
    _appStep = 4; _hydrate('/app')
  })
}

function _initStep4() {
  const btn  = document.getElementById('complete-onboarding-btn')
  const chk  = document.getElementById('popia-consent-checkbox')
  const err  = document.getElementById('err-consent')
  if (!btn) return
  btn.addEventListener('click', async () => {
    if (!chk?.checked) { if (err) err.textContent = 'You must explicitly authorise to proceed'; return }
    if (err) err.textContent = ''
    const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Completing registration...'
    try {
      const auth = await registerParent({ email: _appFormData.parentEmail, hashedPassword: null, phoneNumber: _appFormData.parentPhone })
      console.log('[SIM] main.js — auth.registerParent complete · sessionToken present:', !!auth.sessionToken)
      const pii = await storeParentRecord({
        parentName: _appFormData.parentName, parentEmail: _appFormData.parentEmail,
        parentPhone: _appFormData.parentPhone,
        consentLog: { timestamp: new Date().toISOString(), method: 'digital-checkbox', popia_signed: true },
        otpVerificationRecord: { verified: true, verifiedAt: new Date().toISOString() },
      })
      console.log('[SIM] main.js — piiStore.storeParentRecord complete')
      console.log('[SIM] main.js — POPIA isolation: zero play signals in PII payload')
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
      _appAccountRef = `CR-${Date.now().toString(36).toUpperCase()}`
      localStorage.setItem('cr_parent_token',   auth.sessionToken)
      localStorage.setItem('cr_popia_signed',    'true')
      localStorage.setItem('cr_child_uuid',       uuid)
      localStorage.setItem('cr_child_nickname',   _appFormData.childNickname)
      localStorage.setItem('cr_child_age_group',  _appFormData.childAgeGroup)
      console.log('[SIM] main.js — localStorage: tokens stored · cr_child_uuid (zero PII)')
      _appStep = 5; _hydrate('/app')
    } catch (e) { btn.disabled = false; btn.textContent = orig; _showToast('Registration error — please try again', false) }
  })
}

function _initComplete() {
  console.log('[CRATE] onboarding complete — tokens stored, POPIA consent signed')
}

// =============================================================================
// PHASE 3 INIT — Physics Sandbox
// =============================================================================

// ── _initSandbox() — entry point wired from init('/sandbox') ─────────────────
function _initSandbox() {
  const canvas = document.getElementById('physics-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  // Size canvas to full viewport
  function _resizeCanvas() {
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
  }
  _resizeCanvas()
  window.addEventListener('resize', _resizeCanvas)

  // Session start
  _sandboxSessionMs  = Date.now()
  _sandboxBodies     = []
  _sandboxSigBuffer  = {}
  _sandboxSigTimes   = {}
  _sandboxDrag       = null
  _sandboxFirstAct   = false
  _sandboxCollapseMs = 0
  _sandboxDragLog    = []
  _sandboxTouchZones = new Set()

  // Spawn 3 starter blocks so the canvas feels alive immediately
  const theme = _THEMES[_sandboxTheme]
  for (let i = 0; i < 3; i++) {
    _spawnBody('rect', theme.palette[i % theme.palette.length], canvas.width, canvas.height)
  }

  // ── Pointer events ───────────────────────────────────────────────────────
  function _ptFrom(e) {
    if (e.touches) {
      const r = canvas.getBoundingClientRect()
      return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top }
    }
    return { x: e.offsetX, y: e.offsetY }
  }

  function _onPointerDown(e) {
    const { x, y } = _ptFrom(e)
    const body = _bodyAt(x, y)

    // Time-to-first-action: fire once per session
    if (!_sandboxFirstAct) {
      _sandboxFirstAct = true
      const elapsed = Date.now() - _sandboxSessionMs
      _bufferSignal('time_to_first_action', { value: elapsed, unit: 'ms' })
      console.log('[SIM] sandbox — time_to_first_action:', elapsed, 'ms')
    }

    if (body) {
      _sandboxDrag      = { body }
      _sandboxDragPrevX = x
      _sandboxDragPrevY = y
      _sandboxDragVX    = 0
      _sandboxDragVY    = 0
      body.vx = 0; body.vy = 0
      const dragStart = Date.now()
      body._dragStart = dragStart
    }

    _trackExplorationZone(x, y, canvas.width, canvas.height)
  }

  function _onPointerMove(e) {
    if (!_sandboxDrag) return
    const { x, y } = _ptFrom(e)
    const body = _sandboxDrag.body
    _sandboxDragVX = (x - _sandboxDragPrevX) * 0.8
    _sandboxDragVY = (y - _sandboxDragPrevY) * 0.8
    body.x = x; body.y = y
    _sandboxDragPrevX = x; _sandboxDragPrevY = y
    _trackExplorationZone(x, y, canvas.width, canvas.height)

    // Rotation: holding Shift adds angular velocity during drag
    if (e.shiftKey || e.ctrlKey) {
      body.angularVelocity += (Math.random() - 0.5) * 0.08
      _debouncedSignal('spatial_rotation', { value: body.angularVelocity, x, y })
    }
  }

  function _onPointerUp(e) {
    if (!_sandboxDrag) return
    const body = _sandboxDrag.body
    // Toss velocity from drag momentum
    body.vx = _sandboxDragVX
    body.vy = _sandboxDragVY

    // Log drag for speed variability
    if (body._dragStart) {
      _sandboxDragLog.push({ durationMs: Date.now() - body._dragStart })
      if (_sandboxDragLog.length > 10) _sandboxDragLog.shift()
      if (_sandboxDragLog.length >= 4) _checkSpeedVariability()
    }
    _sandboxDrag = null
  }

  // Mouse
  canvas.addEventListener('mousedown', _onPointerDown)
  canvas.addEventListener('mousemove', _onPointerMove)
  canvas.addEventListener('mouseup',   _onPointerUp)
  // Touch (passive: false to prevent scroll)
  canvas.addEventListener('touchstart', e => { e.preventDefault(); _onPointerDown(e) }, { passive: false })
  canvas.addEventListener('touchmove',  e => { e.preventDefault(); _onPointerMove(e) }, { passive: false })
  canvas.addEventListener('touchend',   e => { e.preventDefault(); _onPointerUp(e)   }, { passive: false })

  // ── Sidebar button wiring ─────────────────────────────────────────────────

  // Spawn buttons
  document.querySelectorAll('[data-spawn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type  = btn.getAttribute('data-spawn')
      const theme = _THEMES[_sandboxTheme]
      const color = theme.palette[Math.floor(Math.random() * theme.palette.length)]
      _spawnBody(type, color, canvas.width, canvas.height)
      _debouncedSignal('novelty_exploration', { type, x: canvas.width / 2, y: 60 })
      console.log('[SIM] sandbox — novelty_exploration: spawned', type)
    })
  })

  // Theme toggle
  const themeBtn = document.querySelector('[data-theme-toggle]')
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      _sandboxTheme = (_sandboxTheme + 1) % _THEMES.length
      // Recolour all bodies with new theme
      const palette = _THEMES[_sandboxTheme].palette
      _sandboxBodies.forEach((b, i) => { b.color = palette[i % palette.length] })
      // Update theme dot colour
      const dot = themeBtn.querySelector('span')
      if (dot) dot.style.color = palette[0]
      _debouncedSignal('symbolic_substitution', { theme: _THEMES[_sandboxTheme].name })
      console.log('[SIM] sandbox — symbolic_substitution: theme changed to', _THEMES[_sandboxTheme].name)
    })
  }

  // Clear board
  const clearBtn = document.querySelector('[data-sandbox-clear]')
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      _sandboxBodies   = []
      _sandboxCollapseMs = Date.now()
      _bufferSignal('structural_persistence', { event: 'manual_clear', bodyCount: 0 })
      console.log('[SIM] sandbox — structural_persistence: board cleared (manual)')
    })
  }

  // ── Game loop ─────────────────────────────────────────────────────────────
  let _prevTime = performance.now()

  function _gameLoop(now) {
    _sandboxRAF = requestAnimationFrame(_gameLoop)

    const dt = Math.min((now - _prevTime) / 16, 3) // capped delta, ~1 at 60fps
    _prevTime = now

    const W = canvas.width, H = canvas.height

    // Update physics for all non-dragged bodies
    for (const b of _sandboxBodies) {
      if (_sandboxDrag && _sandboxDrag.body === b) continue
      _physStep(b, W, H)
    }
    // Resolve body-body collisions
    _physCollide(_sandboxBodies, W, H)

    // Draw
    _physDraw(ctx, _sandboxBodies, W, H)

    // Periodic telemetry checks
    _checkStructuralPersistence()
    _checkToolUtilization()
  }

  _sandboxRAF = requestAnimationFrame(_gameLoop)
}

// ── Physics: single body step ─────────────────────────────────────────────────
function _physStep(b, W, H) {
  b.vy += _PHYS.GRAVITY
  b.x  += b.vx
  b.y  += b.vy
  b.angle += b.angularVelocity
  b.angularVelocity *= _PHYS.ANG_DAMP

  const hw = b.width / 2, hh = b.height / 2

  // Floor
  if (b.y + hh >= H - 8) {
    b.y  = H - 8 - hh
    b.vy = b.vy < 0 ? b.vy : -Math.abs(b.vy) * _PHYS.RESTITUTION
    b.vx *= _PHYS.GROUND_FRICTION
    if (Math.abs(b.vy) < 0.6) b.vy = 0
    b.onGround = true
    b.angularVelocity *= 0.85
  } else { b.onGround = false }

  // Ceiling
  if (b.y - hh <= 0) { b.y = hh; b.vy = Math.abs(b.vy) * _PHYS.RESTITUTION }

  // Left wall
  if (b.x - hw <= 0) {
    b.x  = hw
    const spd = Math.abs(b.vx)
    b.vx = spd * _PHYS.RESTITUTION
    if (spd > _PHYS.BOUNDARY_VEL_THRESH) {
      _debouncedSignal('boundary_testing', { velocity: spd, wall: 'left', x: b.x, y: b.y })
      console.log('[SIM] sandbox — boundary_testing: left wall hit at v=', spd.toFixed(2))
    }
  }

  // Right wall
  if (b.x + hw >= W) {
    b.x  = W - hw
    const spd = Math.abs(b.vx)
    b.vx = -spd * _PHYS.RESTITUTION
    if (spd > _PHYS.BOUNDARY_VEL_THRESH) {
      _debouncedSignal('boundary_testing', { velocity: spd, wall: 'right', x: b.x, y: b.y })
      console.log('[SIM] sandbox — boundary_testing: right wall hit at v=', spd.toFixed(2))
    }
  }
}

// ── Physics: AABB body-body collision resolution ──────────────────────────────
function _physCollide(bodies) {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j]
      const dx   = b.x - a.x, dy = b.y - a.y
      const overX = (a.width  + b.width)  / 2 - Math.abs(dx)
      const overY = (a.height + b.height) / 2 - Math.abs(dy)
      if (overX <= 0 || overY <= 0) continue

      if (overX < overY) {
        const sx = dx > 0 ? 1 : -1
        a.x -= sx * overX / 2; b.x += sx * overX / 2
        const rvx = b.vx - a.vx
        const imp = rvx * (1 + _PHYS.RESTITUTION) / 2
        a.vx += imp; b.vx -= imp
      } else {
        const sy = dy > 0 ? 1 : -1
        a.y -= sy * overY / 2; b.y += sy * overY / 2
        const rvy = b.vy - a.vy
        const imp = rvy * (1 + _PHYS.RESTITUTION) / 2
        a.vy += imp; b.vy -= imp
        // Add gentle angular impulse for visual interest
        a.angularVelocity += (Math.random() - 0.5) * 0.03
        b.angularVelocity += (Math.random() - 0.5) * 0.03
      }
    }
  }
}

// ── Physics: canvas draw ──────────────────────────────────────────────────────
function _physDraw(ctx, bodies, W, H) {
  // Background
  ctx.fillStyle = '#2F3E46'
  ctx.fillRect(0, 0, W, H)

  // Subtle grid
  ctx.strokeStyle = 'rgba(122,154,134,0.05)'
  ctx.lineWidth   = 1
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  // Floor strip
  ctx.fillStyle = 'rgba(122,154,134,0.12)'
  ctx.fillRect(0, H - 8, W, 8)

  // Bodies
  for (const b of bodies) {
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.rotate(b.angle)
    ctx.fillStyle   = b.color
    ctx.strokeStyle = 'rgba(244,241,222,0.12)'
    ctx.lineWidth   = 1.5

    switch (b.type) {
      case 'rect':
      case 'lever':
        ctx.beginPath()
        ctx.rect(-b.width / 2, -b.height / 2, b.width, b.height)
        ctx.fill(); ctx.stroke()
        break
      case 'triangle':
        ctx.beginPath()
        ctx.moveTo(0, -b.height / 2)
        ctx.lineTo(b.width / 2, b.height / 2)
        ctx.lineTo(-b.width / 2, b.height / 2)
        ctx.closePath(); ctx.fill(); ctx.stroke()
        break
      case 'wedge':
        ctx.beginPath()
        ctx.moveTo(-b.width / 2, b.height / 2)
        ctx.lineTo(b.width / 2, b.height / 2)
        ctx.lineTo(-b.width / 2, -b.height / 2)
        ctx.closePath(); ctx.fill(); ctx.stroke()
        break
    }

    // Drag highlight
    if (_sandboxDrag && _sandboxDrag.body === b) {
      ctx.strokeStyle = 'rgba(244,241,222,0.45)'
      ctx.lineWidth   = 2.5
      ctx.beginPath()
      if (b.type === 'rect' || b.type === 'lever') {
        ctx.rect(-b.width / 2, -b.height / 2, b.width, b.height)
      } else {
        ctx.arc(0, 0, Math.max(b.width, b.height) / 2, 0, Math.PI * 2)
      }
      ctx.stroke()
    }

    ctx.restore()
  }

  // Empty canvas hint
  if (bodies.length === 0) {
    ctx.font      = '15px Inter, sans-serif'
    ctx.fillStyle = 'rgba(244,241,222,0.18)'
    ctx.textAlign = 'center'
    ctx.fillText('Tap a shape on the right to start building', W / 2, H / 2)
    ctx.textAlign = 'left'
  }
}

// ── Spawn a new physics body ──────────────────────────────────────────────────
function _spawnBody(type, color, W, H) {
  const dims = { rect: [58, 38], triangle: [54, 54], wedge: [64, 44], lever: [118, 16] }
  const [w, h] = dims[type] || dims.rect
  const x = W / 2 + (Math.random() - 0.5) * W * 0.4
  _sandboxBodies.push({
    id:              `b-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    x,  y:           -h,   // spawn above canvas, falls in
    vx:              (Math.random() - 0.5) * 4,
    vy:              1,
    width:           w, height: h,
    type,   color,
    angle:           (Math.random() - 0.5) * 0.3,
    angularVelocity: (Math.random() - 0.5) * 0.04,
    mass:            (w * h) / 2500,
    onGround:        false,
  })
}

// ── Hit-test: return topmost body at (x, y) ───────────────────────────────────
function _bodyAt(x, y) {
  for (let i = _sandboxBodies.length - 1; i >= 0; i--) {
    const b = _sandboxBodies[i]
    if (x >= b.x - b.width / 2 && x <= b.x + b.width / 2 &&
        y >= b.y - b.height / 2 && y <= b.y + b.height / 2) return b
  }
  return null
}

// ── Track exploration breadth (grid-zone coverage) ────────────────────────────
function _trackExplorationZone(x, y, W, H) {
  const cx = Math.floor(x / W * _PHYS.GRID_CELLS)
  const cy = Math.floor(y / H * _PHYS.GRID_CELLS)
  const key = `${cx},${cy}`
  if (!_sandboxTouchZones.has(key)) {
    _sandboxTouchZones.add(key)
    const ratio = _sandboxTouchZones.size / (_PHYS.GRID_CELLS * _PHYS.GRID_CELLS)
    _bufferSignal('novelty_exploration', { value: ratio, zones: _sandboxTouchZones.size })
    if (_sandboxTouchZones.size % 4 === 0) {
      console.log('[SIM] sandbox — explorationBreadth ratio:', ratio.toFixed(2))
    }
  }
}

// ── Check structural persistence (rebuild after collapse) ─────────────────────
function _checkStructuralPersistence() {
  if (!_sandboxCollapseMs) return
  const timeSince = Date.now() - _sandboxCollapseMs
  if (timeSince > 0 && timeSince < 5000 && _sandboxBodies.length > 0) {
    const isActive = _sandboxBodies.some(b => Math.abs(b.vy) > 1 || !b.onGround)
    if (isActive) {
      _debouncedSignal('structural_persistence', { event: 'rebuild', msAfterCollapse: timeSince })
      console.log('[SIM] sandbox — structural_persistence: rebuild within', timeSince, 'ms of collapse')
      _sandboxCollapseMs = 0 // Reset so we don't fire repeatedly
    }
  }
}

// ── Check tool utilization (wedge/lever contact with rect/triangle) ───────────
function _checkToolUtilization() {
  const tools = _sandboxBodies.filter(b => b.type === 'wedge' || b.type === 'lever')
  const others = _sandboxBodies.filter(b => b.type === 'rect' || b.type === 'triangle')
  for (const t of tools) {
    for (const o of others) {
      const dx = Math.abs(o.x - t.x) - (o.width + t.width) / 2
      const dy = Math.abs(o.y - t.y) - (o.height + t.height) / 2
      if (dx < _PHYS.TOOL_DIST_THRESH && dy < _PHYS.TOOL_DIST_THRESH) {
        _debouncedSignal('tool_utilization', { tool: t.type, object: o.type, x: t.x, y: t.y })
        console.log('[SIM] sandbox — tool_utilization:', t.type, 'contacts', o.type)
        return // Only fire once per frame check
      }
    }
  }
}

// ── Speed variability from drag history ──────────────────────────────────────
function _checkSpeedVariability() {
  if (_sandboxDragLog.length < 4) return
  const durations = _sandboxDragLog.map(d => d.durationMs)
  const mean = durations.reduce((a, b) => a + b, 0) / durations.length
  const variance = durations.reduce((a, b) => a + (b - mean) ** 2, 0) / durations.length
  const stdDev = Math.sqrt(variance)
  _debouncedSignal('speed_variability', { stdDevMs: stdDev, mean })
  if (stdDev > 300) console.log('[SIM] sandbox — speedVariability stdDev:', stdDev.toFixed(0), 'ms')
}

// ── Debounced signal fire: max 1 per signal type per 2 seconds ────────────────
function _debouncedSignal(name, data) {
  const now = Date.now()
  if (_sandboxSigTimes[name] && now - _sandboxSigTimes[name] < 2000) return
  _sandboxSigTimes[name] = now
  _bufferSignal(name, data)
}

// ── Buffer a signal event for batch session upload ────────────────────────────
function _bufferSignal(sandboxName, data) {
  const key = _SIG[sandboxName] || sandboxName
  if (!_sandboxSigBuffer[key]) _sandboxSigBuffer[key] = 0
  _sandboxSigBuffer[key]++
}

// ── Flush buffered signals — dispatches cr:sessionEnd for Phase 4 pipeline ───
// Phase 4 architecture: this function no longer calls uploadSessionData directly.
// It dispatches cr:sessionEnd with the full session payload.
// TelemetryCollector._onSessionEnd() receives it and runs the full pipeline:
//   GAP computation → localStorage history → uploadSessionData → AssessmentEngine
//
// Deficit fix: directive used cr_parent_token as pseudoUUID — that is the auth
// token (PII-adjacent). Correct anonymous identifier is cr_child_uuid per CLAUDE.md.
function _flushSandboxSession() {
  const keys = Object.keys(_sandboxSigBuffer)
  if (keys.length === 0) return

  const pseudoUUID = localStorage.getItem('cr_child_uuid') || 'anon-sandbox'
  const signals    = { ...JSON.parse(JSON.stringify(_sandboxSigBuffer)) }
  const sessionMs  = Date.now() - _sandboxSessionMs
  const sessionId  = `cr-sandbox-${Date.now()}`

  // Dispatch cr:sessionEnd — TelemetryCollector handles the rest
  document.dispatchEvent(new CustomEvent('cr:sessionEnd', {
    detail: {
      pseudoUUID,
      signals,
      sessionMs,
      bodyCount: _sandboxBodies.length,
      sessionId,
    },
  }))

  console.log('[SIM] sandbox — cr:sessionEnd dispatched · signals:', JSON.stringify(signals))
  _sandboxSigBuffer = {}
}

// =============================================================================
// MAIN INIT
// =============================================================================
function init(path, ctx = {}) {
  const route = path === '' ? '/' : path
  console.log(`[CRATE] init — route: ${route}`)

  // SPA nav (all routes)
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault()
      const href = link.getAttribute('href')
      window.history.pushState({}, '', href)
      _hydrate(href)
    })
  })

  // Smooth scroll (non-sandbox routes)
  document.querySelectorAll('[data-scroll]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault()
      const t = document.querySelector(link.getAttribute('href'))
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const d = document.querySelector('[data-mobile-menu-drawer]')
      if (d && !d.classList.contains('hidden')) d.classList.add('hidden')
    })
  })

  if (route === '/')         _initMarketingShell()
  if (route === '/app')      _initApp(ctx)
  if (route === '/sandbox')  _initSandbox()
}

// =============================================================================
// UTILITIES
// =============================================================================
function _showToast(message, isSuccess = true) {
  const toast = document.getElementById('cr-toast')
  if (!toast) return
  clearTimeout(_toastTimer)
  toast.textContent = message
  toast.className = [
    'fixed top-6 left-1/2 -translate-x-1/2 z-50',
    'px-5 py-3 rounded-2xl font-body text-sm font-medium text-cr-cream',
    'shadow-card-hover pointer-events-none transition-all duration-300',
    isSuccess ? 'bg-cr-sage' : 'bg-cr-coral',
  ].join(' ')
  _toastTimer = setTimeout(() => { toast.classList.add('opacity-0'); setTimeout(() => toast.classList.add('hidden'), 300) }, 4000)
}

function _sanitise(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// =============================================================================
// HYDRATION ORCHESTRATOR
// =============================================================================
function _hydrate(path) {
  if (!app) { console.error('[CRATE] _hydrate — #app not found'); return }

  const route = path === '' ? '/' : path

  // Cancel sandbox loop and flush session before navigating away
  if (_sandboxRAF) {
    cancelAnimationFrame(_sandboxRAF)
    _sandboxRAF = null
    _flushSandboxSession() // fire-and-forget: SIM path completes synchronously
    window.removeEventListener('resize', () => {})
  }

  // Reset wizard on fresh /app visit
  if (route === '/app' && _previousRoute !== '/app') {
    const onb = !!localStorage.getItem('cr_parent_token') && localStorage.getItem('cr_popia_signed') === 'true'
    if (!onb) { _appStep = 1; _appFormData = { parentName: '', parentEmail: '', parentPhone: '', childNickname: '', childAgeGroup: '' }; _appAccountRef = null }
  }
  _previousRoute = route

  const ctx = {
    consentAccepted: localStorage.getItem('cr_consent_accepted') === 'true',
    isOnboarded:     !!localStorage.getItem('cr_parent_token') && localStorage.getItem('cr_popia_signed') === 'true',
  }

  app.innerHTML = render(path, ctx)   // ONE innerHTML write
  init(path, ctx)                     // ALL inits after DOM written
}

// ── Browser history ────────────────────────────────────────────────────────────
window.addEventListener('popstate', () => { _hydrate(window.location.pathname) })

// ── Flush sandbox signals on page unload ─────────────────────────────────────
// Dispatches cr:sessionEnd synchronously. TelemetryCollector's localStorage
// write (Step 3) is synchronous so session data is preserved even if the
// async uploadSessionData call doesn't complete before the page closes.
window.addEventListener('beforeunload', () => {
  if (Object.keys(_sandboxSigBuffer).length > 0) _flushSandboxSession()
})

// ── Phase 4: Initialize TelemetryCollector once at module load ───────────────
// Binds the cr:sessionEnd listener on document before the first hydration.
// This ensures the collector is ready regardless of which route loads first.
initTelemetryCollector()

// ── Initial load ──────────────────────────────────────────────────────────────
_hydrate(window.location.pathname)
