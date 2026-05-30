// ── src/main.js ─────────────────────────────────────────────────────────────
// C.R.A.T.E. application orchestrator — Phase 2: Parent Onboarding & POPIA Consent.
// Enforces the single-pass hydration sequence: all render() helpers concatenated
// into ONE innerHTML write, then all init() calls in order.
//
// Three exclusive render paths (CLAUDE.md §Architecture Constraints):
//   /admin          → AdminShell only. No customer modules.
//   /app            → Onboarding wizard (unauthenticated) | Portal (authenticated)
//   everything else → Public marketing shell.
//
// URL routing via window.location.pathname only. No router library.
// vercel.json catch-all rewrite serves index.html for all paths.

import './style.css'
import { createSubscription }  from '@/core/integrations/payment.js'
import { registerParent }      from '@/core/integrations/auth.js'
import { sendOTP, verifyOTP }  from '@/core/integrations/otp.js'
import { storeParentRecord }   from '@/core/integrations/piiStore.js'

// ── DOM mount point ───────────────────────────────────────────────────────────
const app = document.getElementById('app')

// ── Shared state ──────────────────────────────────────────────────────────────
let _toastTimer    = null
let _previousRoute = null   // Used to detect fresh /app visits and reset wizard

// ── Wizard state (Phase 2) ────────────────────────────────────────────────────
// Module-level: persists across step hydrations, resets on fresh /app visit.
// localStorage keys written on completion: cr_parent_token, cr_popia_signed,
// cr_child_uuid, cr_child_nickname, cr_child_age_group.
let _appStep       = 1
let _appAccountRef = null
let _appFormData   = {
  parentName:    '',
  parentEmail:   '',
  parentPhone:   '',
  childNickname: '',
  childAgeGroup: '',
}

// =============================================================================
// PHASE 1 RENDER HELPERS — unchanged from Phase 1 (Public Marketing Shell)
// Pure HTML-string builders. Zero DOM access. Zero side effects. Zero async.
// =============================================================================

// ── Navbar ────────────────────────────────────────────────────────────────────
function _renderNavbar() {
  return `
    <nav
      id="cr-nav"
      class="sticky top-0 z-40 bg-cr-slate/95 backdrop-blur-sm border-b border-cr-charcoal shadow-nav"
    >
      <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <a href="/" data-nav
           class="font-heading text-cr-cream text-xl font-extrabold tracking-widest
                  hover:text-cr-sage transition-colors duration-200">
          C·R·A·T·E
        </a>
        <div class="hidden md:flex items-center gap-6">
          <a href="/app" data-nav
             class="font-body text-cr-cream/60 text-sm hover:text-cr-cream transition-colors">
            Parent Portal
          </a>
          <a href="/admin" data-nav
             class="font-body text-cr-cream/60 text-sm hover:text-cr-cream transition-colors">
            Admin
          </a>
          <a href="#pricing" data-scroll class="btn-primary text-sm px-5 py-2.5 min-h-[44px]">
            Get Started
          </a>
        </div>
        <button
          data-mobile-menu-btn
          aria-label="Open navigation menu"
          aria-expanded="false"
          class="md:hidden flex flex-col justify-center gap-1.5 w-10 h-10 rounded-lg
                 hover:bg-cr-charcoal transition-colors"
        >
          <span class="block w-5 h-0.5 bg-cr-cream mx-auto transition-all duration-200"></span>
          <span class="block w-5 h-0.5 bg-cr-cream mx-auto transition-all duration-200"></span>
          <span class="block w-5 h-0.5 bg-cr-cream mx-auto transition-all duration-200"></span>
        </button>
      </div>
      <div data-mobile-menu-drawer class="hidden border-t border-cr-charcoal bg-cr-slate">
        <div class="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3">
          <a href="/app"   data-nav class="font-body text-cr-cream/70 text-sm py-2 hover:text-cr-cream">Parent Portal</a>
          <a href="/admin" data-nav class="font-body text-cr-cream/70 text-sm py-2 hover:text-cr-cream">Admin</a>
          <a href="#pricing" data-scroll class="btn-primary text-sm text-center">Get Started</a>
        </div>
      </div>
    </nav>
  `
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function _renderHero() {
  return `
    <section class="bg-cr-slate pt-20 pb-24 px-4 text-center">
      <div class="max-w-4xl mx-auto">
        <p class="font-body text-cr-sage text-xs font-semibold uppercase tracking-widest mb-5">
          Developmental Play Assistant &nbsp;·&nbsp; STEAM Interest Exploration Tool
        </p>
        <h1 class="font-heading text-cr-cream text-4xl sm:text-5xl lg:text-6xl font-extrabold
                   leading-tight mb-6">
          Unlocking Potential<br />Through Play
        </h1>
        <p class="font-body text-cr-cream/65 text-base md:text-lg max-w-2xl mx-auto
                  leading-relaxed mb-10">
          C.R.A.T.E. silently reads your child's natural play style inside a digital
          physics sandbox, then ships a personalised physical STEAM kit — curated to
          match exactly how their interests are growing right now.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <a href="#pricing" data-scroll class="btn-primary w-full sm:w-auto">Choose Your Crate</a>
          <a href="#dimensions" data-scroll class="btn-secondary w-full sm:w-auto">See the 6 Play Dimensions</a>
        </div>
        <div class="mt-16 grid grid-cols-3 gap-6 max-w-md mx-auto">
          <div>
            <p class="font-heading text-cr-coral text-3xl font-extrabold">10</p>
            <p class="font-body text-cr-cream/40 text-xs uppercase tracking-wide mt-1">Play signals tracked</p>
          </div>
          <div>
            <p class="font-heading text-cr-coral text-3xl font-extrabold">6</p>
            <p class="font-body text-cr-cream/40 text-xs uppercase tracking-wide mt-1">Interest dimensions</p>
          </div>
          <div>
            <p class="font-heading text-cr-coral text-3xl font-extrabold">1</p>
            <p class="font-body text-cr-cream/40 text-xs uppercase tracking-wide mt-1">Personalised crate</p>
          </div>
        </div>
      </div>
    </section>
  `
}

// ── Dimension matrix data (HPCSA guardrail: zero clinical terminology) ─────────
const _dimensions = [
  {
    key:         'curiosity',
    label:       'Curiosity',
    border:      'border-cr-sage',
    dot:         'bg-cr-sage',
    description: 'How eagerly your child investigates new tools, asks "what happens if?", ' +
                 'and reaches into unexplored corners of the sandbox. Wide-ranging exploration ' +
                 'is a strong signal of active interest in the world.',
    signals:     'Tracked via: Exploration Breadth · Optional Interactions · Rule-Breaking Attempts',
  },
  {
    key:         'spatial-reasoning',
    label:       'Spatial Reasoning',
    border:      'border-cr-coral',
    dot:         'bg-cr-coral',
    description: 'How your child plans layouts, rotates objects mentally before placing them, ' +
                 'and navigates three-dimensional challenges. Builders who return to refine ' +
                 'spatial arrangements are deepening this interest area.',
    signals:     'Tracked via: Sequence Paths · Backtracking Behaviour · Exploration Breadth',
  },
  {
    key:         'systems-thinking',
    label:       'Systems Thinking',
    border:      'border-cr-cream/30',
    dot:         'bg-cr-cream',
    description: 'How your child sequences actions, spots cause-and-effect chains, and monitors ' +
                 'their own process. Methodical players who plan before acting and self-correct ' +
                 'along the way are showing this interest growing.',
    signals:     'Tracked via: Sequence Paths · Backtracking Behaviour · Speed Variability',
  },
  {
    key:         'narrative-imagination',
    label:       'Narrative Imagination',
    border:      'border-cr-sage',
    dot:         'bg-cr-sage',
    description: 'How your child decorates, names, and invents stories around their builds. ' +
                 'Children who add non-functional flourishes are expressing rich associative ' +
                 'thinking and a desire to give objects meaning.',
    signals:     'Tracked via: Optional Interactions · Creative Modifications · Rule-Breaking Attempts',
  },
  {
    key:         'mechanical-intuition',
    label:       'Mechanical Intuition',
    border:      'border-cr-coral',
    dot:         'bg-cr-coral',
    description: 'How your child develops an internal feel for how objects balance, connect, ' +
                 'and move under forces. Experimenters who predict physics outcomes before ' +
                 'testing them are showing this interest taking shape.',
    signals:     'Tracked via: Creative Modifications · Retry Frequency · Sequence Paths',
  },
  {
    key:         'divergent-thinking',
    label:       'Divergent Thinking',
    border:      'border-cr-cream/30',
    dot:         'bg-cr-cream',
    description: 'How freely your child generates fresh approaches, tests the rules of the ' +
                 'system, and resists stopping at the first solution. High originality and ' +
                 'boundary-testing are the hallmarks of this interest area.',
    signals:     'Tracked via: Rule-Breaking Attempts · Creative Modifications · Optional Interactions',
  },
]

function _renderDimensionMatrix() {
  const cards = _dimensions.map(d => `
    <div class="bg-cr-slate rounded-2xl p-6 border-t-4 ${d.border}
                shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <div class="flex items-center gap-2.5 mb-4">
        <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.dot}"></span>
        <h3 class="font-heading text-cr-cream text-base font-bold">${d.label}</h3>
      </div>
      <p class="font-body text-cr-cream/65 text-sm leading-relaxed mb-4">${d.description}</p>
      <p class="font-body text-cr-cream/25 text-xs leading-relaxed">${d.signals}</p>
    </div>
  `).join('')

  return `
    <section id="dimensions" class="bg-cr-charcoal py-20 px-4">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-12">
          <p class="font-body text-cr-sage text-xs font-semibold uppercase tracking-widest mb-3">
            The Play Interest Framework
          </p>
          <h2 class="font-heading text-cr-cream text-3xl md:text-4xl font-extrabold mb-4">
            Six Play Interest Areas We Track
          </h2>
          <p class="font-body text-cr-cream/55 text-base max-w-2xl mx-auto leading-relaxed">
            Every time your child plays in the sandbox, the engine silently maps their
            behaviour to these six activity interest areas — no scores, no labels,
            just a growing picture of what lights them up.
          </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${cards}</div>
      </div>
    </section>
  `
}

// ── Pricing plan data ─────────────────────────────────────────────────────────
const _plans = [
  {
    id: 'starter', name: 'Starter Kit', price: 'R650', period: '/month',
    tag: null, focus: 'Curiosity · Spatial Reasoning', highlight: false,
    features: [
      'Monthly personalised physical crate',
      'Physics-based building materials',
      'Standard challenge card set (English)',
      'Basic play interest summary',
      'Pudo or Paxi delivery included',
    ],
  },
  {
    id: 'explorer', name: 'Explorer Pack', price: 'R850', period: '/month',
    tag: 'Most Popular', focus: 'Systems Thinking · Mechanical Intuition', highlight: true,
    features: [
      'Monthly personalised physical crate',
      'Expanded mechanical toolkit & gears',
      '2 bilingual challenge card sets (EN + AF)',
      'Full play trajectory dashboard access',
      'Play-style coaching prompts for parents',
      'Pudo or Paxi delivery included',
    ],
  },
  {
    id: 'architect', name: 'Architect Bundle', price: 'R1150', period: '/month',
    tag: null, focus: 'All 6 Interest Areas', highlight: false,
    features: [
      'Monthly personalised physical crate',
      'Full 6-dimension material set',
      'Custom-printed bilingual challenge cards',
      'Advanced play trajectory insights',
      'Priority Pudo smart locker delivery',
      'Exclusive prototype build components',
    ],
  },
]

function _renderPricing() {
  const cards = _plans.map(p => {
    const tagHtml = p.tag
      ? `<span class="inline-block mb-3 px-3 py-1 bg-cr-coral text-cr-cream font-body text-xs font-semibold rounded-full uppercase tracking-wider">${p.tag}</span>`
      : `<span class="inline-block mb-3 h-6"></span>`
    const featureList = p.features.map(f => `
      <li class="flex items-start gap-2">
        <span class="text-cr-sage text-sm mt-0.5 flex-shrink-0">✓</span>
        <span class="font-body text-cr-cream/65 text-sm">${f}</span>
      </li>
    `).join('')
    const cardClass = p.highlight
      ? 'bg-cr-charcoal border-2 border-cr-coral shadow-card-hover'
      : 'bg-cr-charcoal border border-cr-charcoal/60 shadow-card'
    return `
      <div class="${cardClass} rounded-2xl p-6 flex flex-col">
        <div class="mb-6">
          ${tagHtml}
          <h3 class="font-heading text-cr-cream text-xl font-bold mb-1">${p.name}</h3>
          <p class="font-body text-cr-sage text-xs mb-4">${p.focus}</p>
          <div class="flex items-baseline gap-1">
            <span class="font-heading text-cr-cream text-4xl font-extrabold">${p.price}</span>
            <span class="font-body text-cr-cream/35 text-sm">${p.period}</span>
          </div>
        </div>
        <ul class="flex flex-col gap-3 mb-8 flex-1">${featureList}</ul>
        <button data-subscribe="${p.id}" data-tier-name="${p.name}" data-tier-price="${p.price}"
                class="btn-primary w-full text-sm">
          Subscribe Now
        </button>
      </div>
    `
  }).join('')

  return `
    <section id="pricing" class="bg-cr-slate py-20 px-4">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-12">
          <p class="font-body text-cr-sage text-xs font-semibold uppercase tracking-widest mb-3">Subscription Plans</p>
          <h2 class="font-heading text-cr-cream text-3xl md:text-4xl font-extrabold mb-4">Choose Your Crate Plan</h2>
          <p class="font-body text-cr-cream/55 text-base max-w-xl mx-auto leading-relaxed">
            All plans include the digital sandbox, play interest tracking,
            and your personalised monthly crate — delivered across South Africa.
          </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">${cards}</div>
        <p class="text-center font-body text-cr-cream/25 text-xs mt-8">
          Simulation mode active · No real payment processed · POPIA compliant · SA delivery only
        </p>
      </div>
    </section>
  `
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
            © ${new Date().getFullYear()} C.R.A.T.E. · All rights reserved · POPIA compliant · South Africa
          </p>
        </div>
      </div>
    </footer>
  `
}

function _renderPOPIABanner() {
  return `
    <div id="cr-popia-banner"
         class="fixed bottom-0 left-0 right-0 z-50 bg-cr-charcoal border-t-2 border-cr-sage"
         role="complementary" aria-label="Data privacy notice">
      <div class="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div class="flex-1">
          <p class="font-body text-cr-cream text-sm font-semibold mb-1">
            Your child's play data is kept completely separate from your personal details.
          </p>
          <p class="font-body text-cr-cream/50 text-xs leading-relaxed">
            Behavioral signals from sandbox play are stored under a randomised identifier only.
            Your name, email, and address are never linked to play records. POPIA compliant · South Africa.
          </p>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <button data-accept-consent class="btn-consent text-sm px-4 py-2 min-h-[44px]">
            Accept &amp; Continue
          </button>
          <button data-review-consent
                  class="font-body text-cr-cream/45 text-xs underline underline-offset-2
                         hover:text-cr-cream transition-colors min-h-[44px] px-2">
            Review Policy
          </button>
        </div>
      </div>
    </div>
  `
}

// =============================================================================
// PHASE 2 RENDER HELPERS — Onboarding wizard & authenticated portal
// =============================================================================

// ── Wizard outer shell ────────────────────────────────────────────────────────
// Renders the frosted-glass card wrapper with progress stepper and back link.
// step 1–4 = wizard; step 5 = complete. title appears in step counter.
function _renderWizardShell(step, title, bodyHtml) {
  const stepLabels = ['Account', 'Verify', 'Profile', 'Privacy']
  const dots = stepLabels.map((label, i) => {
    const n        = i + 1
    const isDone   = n < step
    const isCur    = n === step
    const dotCls   = isDone  ? 'bg-cr-sage text-cr-cream'
                   : isCur   ? 'bg-cr-coral text-cr-cream'
                   :           'bg-cr-charcoal text-cr-cream/30 border border-cr-cream/10'
    const txtCls   = isDone  ? 'text-cr-sage'
                   : isCur   ? 'text-cr-coral'
                   :           'text-cr-cream/25'
    return `
      <div class="flex flex-col items-center gap-1.5">
        <div class="w-8 h-8 rounded-full flex items-center justify-center ${dotCls}
                    font-heading text-xs font-bold transition-all duration-300">
          ${isDone ? '✓' : n}
        </div>
        <span class="font-body ${txtCls} text-xs hidden sm:block">${label}</span>
      </div>
    `
  }).join(`<div class="flex-1 h-px bg-cr-charcoal mt-4 mx-1"></div>`)

  return `
    <div class="min-h-screen bg-cr-slate flex flex-col">

      <!-- Minimal top bar -->
      <div class="max-w-2xl mx-auto w-full px-4 pt-6 flex items-center justify-between">
        <a href="/" data-nav
           class="font-heading text-cr-sage text-xl font-extrabold tracking-widest
                  hover:text-cr-cream transition-colors">
          C·R·A·T·E
        </a>
        <a href="/" data-nav
           class="font-body text-cr-cream/35 text-xs hover:text-cr-cream/70 transition-colors">
          ← Back to Home
        </a>
      </div>

      <!-- Progress stepper (hidden on step 5 / complete) -->
      ${step <= 4 ? `
      <div class="max-w-2xl mx-auto w-full px-4 mt-8">
        <div class="flex items-start">${dots}</div>
        <p class="font-body text-cr-cream/30 text-xs text-right mt-2">
          Step ${step} of 4: ${title}
        </p>
      </div>` : ''}

      <!-- Frosted terminal glass card -->
      <div class="max-w-2xl mx-auto w-full px-4 mt-6 pb-16 flex-1">
        <div class="bg-cr-slate/60 backdrop-blur-md border border-cr-sage/20 rounded-2xl
                    shadow-card p-6 md:p-8">
          ${bodyHtml}
        </div>
      </div>

    </div>
  `
}

// ── Shared input field builder ────────────────────────────────────────────────
function _renderField({ id, name, type = 'text', label, placeholder, value = '', inputmode = '' }) {
  return `
    <div>
      <label for="${id}" class="block font-body text-cr-cream/70 text-xs font-medium mb-1.5">
        ${label}
      </label>
      <input
        id="${id}"
        name="${name}"
        type="${type}"
        value="${_sanitise(value)}"
        placeholder="${placeholder}"
        ${inputmode ? `inputmode="${inputmode}"` : ''}
        autocomplete="off"
        class="w-full bg-cr-charcoal border border-cr-charcoal hover:border-cr-sage/40
               focus:border-cr-sage outline-none rounded-xl px-4 py-3
               font-body text-cr-cream text-sm placeholder:text-cr-cream/25
               transition-colors duration-200"
      />
      <p id="err-${name}" class="font-body text-cr-coral text-xs mt-1 min-h-[1rem]"></p>
    </div>
  `
}

// ── Step 1: Account Details ───────────────────────────────────────────────────
function _renderWizardStep1(data) {
  const body = `
    <h2 class="font-heading text-cr-cream text-2xl font-extrabold mb-2">Create Your Account</h2>
    <p class="font-body text-cr-cream/50 text-sm mb-6 leading-relaxed">
      Your account details are stored securely and are completely separate from
      your child's play activity records.
    </p>
    <form id="wizard-form-1" novalidate class="flex flex-col gap-4">
      ${_renderField({ id: 'f-name',  name: 'parentName',  label: 'Parent Full Name',
                       placeholder: 'e.g. Amahle Dlamini', value: data.parentName })}
      ${_renderField({ id: 'f-email', name: 'parentEmail', type: 'email', label: 'Contact Email',
                       placeholder: 'your@email.co.za',    value: data.parentEmail })}
      ${_renderField({ id: 'f-phone', name: 'parentPhone', type: 'tel', inputmode: 'tel',
                       label: 'SA Mobile Number', placeholder: '072 000 0000',
                       value: data.parentPhone })}
      <button type="submit" class="btn-primary w-full mt-2">
        Continue &rarr;
      </button>
    </form>
  `
  return _renderWizardShell(1, 'Account Creation', body)
}

// ── Step 2: OTP Verification ──────────────────────────────────────────────────
function _renderWizardStep2(data) {
  const maskedPhone = data.parentPhone
    ? data.parentPhone.replace(/^(\+27|0)(\d{2})(\d+)(\d{3})$/, (_, p, a, b, c) => `+27 ${a} *** ${c}`)
    : 'your mobile number'

  const body = `
    <h2 class="font-heading text-cr-cream text-2xl font-extrabold mb-2">Verify Your Number</h2>
    <p class="font-body text-cr-cream/50 text-sm mb-1 leading-relaxed">
      A 6-digit verification code was sent to
      <span class="text-cr-sage font-semibold">${_sanitise(maskedPhone)}</span>.
    </p>
    <p class="font-body text-cr-coral/80 text-xs mb-6">
      Simulation mode: enter <strong class="font-bold tracking-widest">000000</strong> to proceed.
    </p>

    <div class="flex flex-col gap-4">
      <div>
        <label for="otp-input" class="block font-body text-cr-cream/70 text-xs font-medium mb-1.5">
          6-Digit Verification Code
        </label>
        <input
          id="otp-input"
          type="text"
          inputmode="numeric"
          maxlength="6"
          placeholder="000000"
          autocomplete="one-time-code"
          class="w-full bg-cr-charcoal border-2 border-cr-sage/30 hover:border-cr-sage/60
                 focus:border-cr-sage outline-none rounded-xl px-4 py-4
                 font-heading text-cr-cream text-3xl tracking-[0.5em] text-center
                 placeholder:text-cr-cream/20 placeholder:text-base placeholder:tracking-normal
                 transition-colors duration-200"
        />
        <p id="err-otp" class="font-body text-cr-coral text-xs mt-1 min-h-[1rem]"></p>
      </div>

      <p class="font-body text-cr-cream/30 text-xs text-center">
        Code expires in 10:00 &nbsp;·&nbsp;
        <a id="otp-resend" href="#"
           class="text-cr-sage/70 hover:text-cr-sage underline underline-offset-2 transition-colors">
          Resend SMS Code
        </a>
      </p>

      <button id="otp-verify-btn" class="btn-primary w-full">
        Verify Code &rarr;
      </button>
    </div>
  `
  return _renderWizardShell(2, 'Mobile Verification', body)
}

// ── Step 3: Child Profile ─────────────────────────────────────────────────────
function _renderWizardStep3(data) {
  const ageBrackets = [
    { id: 'age-3-5',  value: '3-5',  label: 'Ages 3–5',  sub: 'Early Explorer' },
    { id: 'age-6-8',  value: '6-8',  label: 'Ages 6–8',  sub: 'Active Builder' },
    { id: 'age-9-12', value: '9-12', label: 'Ages 9–12', sub: 'Systems Thinker' },
  ]

  const ageButtons = ageBrackets.map(a => {
    const isSelected = data.childAgeGroup === a.value
    const cls = isSelected
      ? 'bg-cr-sage/20 border-cr-sage text-cr-cream'
      : 'bg-cr-charcoal border-cr-charcoal/50 text-cr-cream/55 hover:border-cr-sage/30'
    return `
      <button type="button" data-age="${a.value}"
              class="${cls} rounded-xl border py-4 flex flex-col items-center gap-1
                     font-body transition-all duration-200 focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-cr-sage">
        <span class="text-sm font-semibold">${a.label}</span>
        <span class="text-xs opacity-60">${a.sub}</span>
      </button>
    `
  }).join('')

  const body = `
    <h2 class="font-heading text-cr-cream text-2xl font-extrabold mb-2">Child Profile</h2>
    <p class="font-body text-cr-cream/50 text-sm mb-6 leading-relaxed">
      The nickname is used only to label your dashboard. No real name is required —
      it is never linked to play activity records.
    </p>
    <form id="wizard-form-3" novalidate class="flex flex-col gap-5">
      ${_renderField({ id: 'f-nickname', name: 'childNickname',
                       label: 'Child Nickname (for profile isolation)',
                       placeholder: 'e.g. Luca, TigerBee, Zara…',
                       value: data.childNickname })}

      <div>
        <p class="font-body text-cr-cream/70 text-xs font-medium mb-2">Age Group</p>
        <div class="grid grid-cols-3 gap-3" id="age-bracket-grid">
          ${ageButtons}
        </div>
        <p id="err-childAge" class="font-body text-cr-coral text-xs mt-1 min-h-[1rem]"></p>
      </div>

      <button type="submit" class="btn-primary w-full mt-1">
        Continue &rarr;
      </button>
    </form>
  `
  return _renderWizardShell(3, 'Child Profile', body)
}

// ── Step 4: POPIA Consent Agreement ──────────────────────────────────────────
function _renderWizardStep4() {
  const body = `
    <h2 class="font-heading text-cr-cream text-2xl font-extrabold mb-2">Privacy Agreement</h2>
    <p class="font-body text-cr-cream/50 text-sm mb-4 leading-relaxed">
      Please read our data protection terms and confirm your authorisation before we
      create your account.
    </p>

    <!-- Scrollable policy container -->
    <div class="bg-cr-charcoal rounded-xl border border-cr-charcoal/80 p-4 mb-5
                max-h-52 overflow-y-auto font-body text-cr-cream/55 text-xs leading-relaxed
                scroll-smooth">

      <p class="font-semibold text-cr-cream/80 mb-2">C.R.A.T.E. Data Protection Policy</p>

      <p class="mb-3">
        <strong class="text-cr-cream/70">1. What we collect.</strong> C.R.A.T.E. operates
        a developmental play assistant and STEAM interest exploration tool. We collect two
        strictly isolated categories of data: (a) your personal contact information
        (parent name, email, mobile number, delivery address) and (b) anonymised behavioral
        play signals from the digital sandbox (action sequences, timing patterns, exploration
        paths). These two categories are never stored together, never cross-referenced, and
        never joined in any query or report.
      </p>

      <p class="mb-3">
        <strong class="text-cr-cream/70">2. How we keep them separate.</strong> Personal
        details are written exclusively to Database A (the PII Store). Play signals are
        written exclusively to Database B (the Play Signal Engine) under a randomised
        pseudonymous identifier that contains no name, email, or phone number. Only a
        secure internal token mapping layer — never accessible from your dashboard — links
        these two identifiers for the sole purpose of account deletion requests.
      </p>

      <p class="mb-3">
        <strong class="text-cr-cream/70">3. Where your data lives.</strong> Both databases
        are hosted exclusively within South Africa's borders (AWS Cape Town region,
        af-south-1, or Azure Johannesburg) in compliance with Section 72 of the Protection
        of Personal Information Act (POPIA). No child data of any kind is transferred to
        servers outside the Republic of South Africa.
      </p>

      <p class="mb-3">
        <strong class="text-cr-cream/70">4. Your rights.</strong> As the competent person
        (parent or legal guardian) you have the right under POPIA to access, correct, and
        request deletion of all data associated with your account at any time. A one-click
        deletion tool in your dashboard will permanently erase all records from both
        Database A and Database B, including all backup states, within our stated SLA.
      </p>

      <p class="mb-3">
        <strong class="text-cr-cream/70">5. What we do not collect.</strong> We strictly
        disable raw cursor path tracking, camera access, microphone access, and biometric
        data of any kind. All sandbox interaction variables are aggregated into mathematical
        play interest scores on your device before any transmission. We do not sell, share,
        or license any data to third parties for any purpose.
      </p>

      <p>
        <strong class="text-cr-cream/70">6. Contact.</strong> For data enquiries, correction
        requests, or deletion requests, contact us at the details listed in your account
        dashboard once registration is complete.
      </p>

    </div>

    <!-- Mandatory consent checkbox -->
    <label class="flex items-start gap-3 cursor-pointer group mb-5">
      <input
        id="popia-consent-checkbox"
        type="checkbox"
        class="mt-0.5 w-5 h-5 flex-shrink-0 rounded border-cr-sage/40 bg-cr-charcoal
               text-cr-sage accent-[#7A9A86] cursor-pointer"
      />
      <span class="font-body text-cr-cream/70 text-sm leading-relaxed group-hover:text-cr-cream transition-colors">
        I explicitly authorise the processing of developmental play indicators as described above,
        and confirm I am the parent or legal guardian of the child profile being created.
      </span>
    </label>
    <p id="err-consent" class="font-body text-cr-coral text-xs -mt-3 mb-4 min-h-[1rem]"></p>

    <button id="complete-onboarding-btn" class="btn-primary w-full">
      Complete Registration &rarr;
    </button>
  `
  return _renderWizardShell(4, 'Privacy Agreement', body)
}

// ── Step 5: Registration complete ────────────────────────────────────────────
function _renderWizardComplete(data, accountRef) {
  const nickname = data.childNickname || 'your child'
  const ref      = accountRef || 'CR-SIM-OK'

  const body = `
    <div class="text-center py-4">

      <!-- Success badge -->
      <div class="w-16 h-16 rounded-full bg-cr-sage/20 border-2 border-cr-sage
                  flex items-center justify-center mx-auto mb-6">
        <span class="font-heading text-cr-sage text-3xl font-extrabold">✓</span>
      </div>

      <h2 class="font-heading text-cr-cream text-2xl font-extrabold mb-2">
        Registration Complete
      </h2>
      <p class="font-body text-cr-cream/55 text-sm mb-1">
        Welcome to C.R.A.T.E., <strong class="text-cr-cream">${_sanitise(nickname)}</strong>
        is ready to play.
      </p>
      <p class="font-body text-cr-cream/30 text-xs mb-8">
        Account reference: <code class="text-cr-sage font-semibold">${_sanitise(ref)}</code>
      </p>

      <!-- Data isolation confirmation -->
      <div class="bg-cr-charcoal rounded-xl border border-cr-sage/15 p-4 mb-8 text-left">
        <p class="font-body text-cr-cream/60 text-xs leading-relaxed">
          <span class="text-cr-sage font-semibold">Your data isolation is active.</span>
          Personal account details are stored in Database A only.
          ${_sanitise(nickname)}'s play signals will be stored in Database B only,
          under a randomised identifier containing no personal information.
          Both databases are hosted within South Africa. POPIA compliant.
        </p>
      </div>

      <a href="/app" data-nav class="btn-primary w-full sm:w-auto inline-block text-center">
        Enter Play Sandbox Core &rarr;
      </a>
      <p class="font-body text-cr-cream/25 text-xs mt-4">
        Phase 3 sandbox coming soon · Your profile is ready
      </p>

    </div>
  `
  return _renderWizardShell(5, 'Complete', body)
}

// ── Onboarded portal (already registered — pre-Phase 3 interstitial) ─────────
function _renderAppPortal() {
  const nickname = localStorage.getItem('cr_child_nickname') || 'Explorer'
  const ageGroup = localStorage.getItem('cr_child_age_group') || ''

  return `
    <div class="min-h-screen bg-cr-slate flex flex-col">
      <div class="max-w-2xl mx-auto w-full px-4 pt-6 flex items-center justify-between">
        <a href="/" data-nav
           class="font-heading text-cr-sage text-xl font-extrabold tracking-widest hover:text-cr-cream transition-colors">
          C·R·A·T·E
        </a>
        <a href="/" data-nav
           class="font-body text-cr-cream/35 text-xs hover:text-cr-cream/70 transition-colors">
          ← Home
        </a>
      </div>
      <div class="max-w-2xl mx-auto w-full px-4 mt-12 pb-16 flex-1">
        <div class="bg-cr-slate/60 backdrop-blur-md border border-cr-sage/20 rounded-2xl shadow-card p-6 md:p-8 text-center">
          <div class="w-14 h-14 rounded-full bg-cr-sage/20 border-2 border-cr-sage
                      flex items-center justify-center mx-auto mb-5">
            <span class="font-heading text-cr-sage text-2xl font-extrabold">✓</span>
          </div>
          <h2 class="font-heading text-cr-cream text-2xl font-extrabold mb-2">
            Welcome back, <span class="text-cr-sage">${_sanitise(nickname)}</span>
          </h2>
          ${ageGroup ? `<p class="font-body text-cr-cream/40 text-xs mb-6">Age group: ${_sanitise(ageGroup)} · POPIA consent on file</p>` : ''}
          <div class="bg-cr-charcoal rounded-xl border border-cr-charcoal/60 p-5 mb-8 text-left">
            <p class="font-heading text-cr-cream text-sm font-bold mb-2">Phase 3 — Play Sandbox</p>
            <p class="font-body text-cr-cream/50 text-sm leading-relaxed">
              The physics sandbox and play interest engine are being built right now.
              Your profile is ready — the moment Phase 3 ships, your crate personalisation
              engine activates automatically.
            </p>
          </div>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#pricing" data-scroll class="btn-primary text-sm">View Plans</a>
            <a href="/" data-nav class="btn-secondary text-sm">Back to Home</a>
          </div>
        </div>
      </div>
    </div>
  `
}

// =============================================================================
// MAIN RENDER — route dispatcher
// Pure function: path + ctx → complete HTML string for ONE innerHTML write.
// ctx is built in _hydrate() before render() is called.
// =============================================================================
function render(path, ctx = {}) {
  const route = path === '' ? '/' : path

  // ── Public marketing shell ─────────────────────────────────────────────────
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

  // ── Parent portal / onboarding wizard ─────────────────────────────────────
  if (route === '/app') {
    if (ctx.isOnboarded) {
      return _renderAppPortal()
    }
    const step = _appStep
    const data = _appFormData
    if (step === 1) return _renderWizardStep1(data)
    if (step === 2) return _renderWizardStep2(data)
    if (step === 3) return _renderWizardStep3(data)
    if (step === 4) return _renderWizardStep4()
    if (step === 5) return _renderWizardComplete(data, _appAccountRef)
    return _renderWizardStep1(data)
  }

  // ── Admin control shell (Phase 8) ──────────────────────────────────────────
  if (route === '/admin') {
    return `
      <div class="min-h-screen bg-cr-slate flex flex-col items-center justify-center px-4">
        <div class="text-center max-w-lg">
          <p class="font-heading text-cr-coral text-sm font-bold uppercase tracking-widest mb-3">
            Admin Only — Coming in Phase 8
          </p>
          <h1 class="font-heading text-cr-cream text-3xl md:text-4xl font-extrabold mb-4">
            Admin Control Shell
          </h1>
          <p class="font-body text-cr-cream/65 text-base mb-8">
            Order management and crate queue views will be available here.
          </p>
          <a href="/" data-nav class="btn-secondary text-sm">← Back to Home</a>
        </div>
      </div>
    `
  }

  // ── 404 ────────────────────────────────────────────────────────────────────
  return `
    <div class="min-h-screen bg-cr-slate flex flex-col items-center justify-center px-4">
      <div class="text-center max-w-lg">
        <p class="font-heading text-cr-coral text-sm font-bold uppercase tracking-widest mb-3">
          Route not found
        </p>
        <h1 class="font-heading text-cr-cream text-3xl font-extrabold mb-4">404</h1>
        <p class="font-body text-cr-cream/65 text-base mb-8">
          The path <code class="text-cr-sage">${_sanitise(path)}</code> does not exist.
        </p>
        <a href="/" data-nav class="btn-secondary text-sm">← Return Home</a>
      </div>
    </div>
  `
}

// =============================================================================
// INIT — all DOM queries, event listeners, adapter calls
// Runs only after app.innerHTML has been written by _hydrate().
// =============================================================================
function init(path, ctx = {}) {
  const route = path === '' ? '/' : path
  console.log(`[CRATE] init — route: ${route}`)

  // ── SPA nav link interception (all routes) ────────────────────────────────
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault()
      const href = link.getAttribute('href')
      window.history.pushState({}, '', href)
      _hydrate(href)
    })
  })

  // ── Smooth scroll for anchor links ────────────────────────────────────────
  document.querySelectorAll('[data-scroll]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault()
      const target = document.querySelector(link.getAttribute('href'))
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const drawer = document.querySelector('[data-mobile-menu-drawer]')
      if (drawer && !drawer.classList.contains('hidden')) drawer.classList.add('hidden')
    })
  })

  // ── Route-specific init ───────────────────────────────────────────────────
  if (route === '/') _initMarketingShell()
  if (route === '/app') _initApp(ctx)
}

// =============================================================================
// PHASE 1 INIT — Marketing shell interactions
// =============================================================================
function _initMarketingShell() {
  const menuBtn    = document.querySelector('[data-mobile-menu-btn]')
  const menuDrawer = document.querySelector('[data-mobile-menu-drawer]')
  if (menuBtn && menuDrawer) {
    menuBtn.addEventListener('click', () => {
      const isOpen = !menuDrawer.classList.contains('hidden')
      menuDrawer.classList.toggle('hidden', isOpen)
      menuBtn.setAttribute('aria-expanded', String(!isOpen))
    })
  }

  document.querySelectorAll('[data-subscribe]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tierId    = btn.getAttribute('data-subscribe')
      const tierName  = btn.getAttribute('data-tier-name')
      const tierPrice = btn.getAttribute('data-tier-price')
      const origText  = btn.textContent.trim()

      btn.disabled = true
      btn.textContent = 'Processing...'
      btn.classList.add('opacity-70', 'cursor-not-allowed')

      try {
        const authResult    = await registerParent({ email: null, hashedPassword: null, phoneNumber: null })
        const paymentResult = await createSubscription({
          planId: tierId, billingFrequency: 'monthly', parentRecordId: authResult.parentRecordId,
        })
        console.log('[SIM] main.js — checkout complete · planId:', tierId)
        console.log('[SIM] main.js — orderId:', paymentResult.orderId)
        console.log('[SIM] main.js — POPIA: billing identity isolated to auth.js/payment.js')
        btn.classList.remove('opacity-70', 'cursor-not-allowed')
        btn.className = 'btn-consent w-full text-sm cursor-default'
        btn.textContent = `✓ Confirmed · ${paymentResult.orderId || 'SIM-OK'}`
        _showToast(`${tierName} (${tierPrice}) confirmed! Ref: ${paymentResult.orderId || 'SIM-OK'}`, true)
      } catch (err) {
        console.error('[CRATE] checkout error:', err)
        btn.disabled = false
        btn.textContent = origText
        btn.classList.remove('opacity-70', 'cursor-not-allowed')
        _showToast('Something went wrong — please try again', false)
      }
    })
  })

  const banner    = document.getElementById('cr-popia-banner')
  const acceptBtn = document.querySelector('[data-accept-consent]')
  const reviewBtn = document.querySelector('[data-review-consent]')
  if (acceptBtn && banner) {
    acceptBtn.addEventListener('click', () => {
      localStorage.setItem('cr_consent_accepted', 'true')
      banner.classList.add('hidden')
      console.log('[CRATE] POPIA consent accepted — cr_consent_accepted stored')
    })
  }
  if (reviewBtn) {
    reviewBtn.addEventListener('click', () => {
      console.log('[CRATE] POPIA policy review requested — full policy in Phase 2 wizard')
      _showToast('Full data privacy policy available in the registration wizard', true)
    })
  }
}

// =============================================================================
// PHASE 2 INIT — Onboarding wizard interactions
// =============================================================================

// ── _initApp(ctx) — dispatcher for wizard steps and authenticated portal ─────
function _initApp(ctx) {
  if (ctx.isOnboarded) {
    console.log('[CRATE] /app — already onboarded, portal view active')
    return
  }
  const step = _appStep
  if (step === 1) _initStep1()
  if (step === 2) _initStep2()
  if (step === 3) _initStep3()
  if (step === 4) _initStep4()
  if (step === 5) _initComplete()
}

// ── Step 1 init — account details form ───────────────────────────────────────
function _initStep1() {
  const form = document.getElementById('wizard-form-1')
  if (!form) return

  form.addEventListener('submit', e => {
    e.preventDefault()
    const name  = (form.querySelector('[name="parentName"]')?.value  || '').trim()
    const email = (form.querySelector('[name="parentEmail"]')?.value || '').trim()
    const phone = (form.querySelector('[name="parentPhone"]')?.value || '').trim().replace(/\s/g, '')

    let valid = true
    const setErr = (field, msg) => {
      const el = document.getElementById(`err-${field}`)
      if (el) el.textContent = msg
      if (msg) valid = false
    }

    setErr('parentName',  name.length  >= 2 ? '' : 'Please enter your full name')
    setErr('parentEmail', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Please enter a valid email address')
    setErr('parentPhone', /^(\+27|0)(6|7|8)[0-9]{8}$/.test(phone) ? '' : 'Please enter a valid SA mobile number (e.g. 072 000 0000)')

    if (!valid) return

    _appFormData.parentName  = name
    _appFormData.parentEmail = email
    _appFormData.parentPhone = phone

    _appStep = 2
    _hydrate('/app')
  })
}

// ── Step 2 init — OTP send + verify ──────────────────────────────────────────
async function _initStep2() {
  // Auto-send OTP on entering step 2
  try {
    const result = await sendOTP({
      phoneNumber:      _appFormData.parentPhone,
      consentSessionId: `cr-session-${Date.now()}`,
    })
    console.log('[SIM] main.js — OTP dispatched · phone present:', !!_appFormData.parentPhone)
    console.log('[SIM] main.js — sentAt:', result.sentAt)
    console.log('[SIM] main.js — enter "000000" to proceed in simulation mode')
  } catch (err) {
    console.error('[CRATE] OTP send failed:', err)
    _showToast('Failed to send verification code — please try again', false)
  }

  const otpInput   = document.getElementById('otp-input')
  const verifyBtn  = document.getElementById('otp-verify-btn')
  const resendLink = document.getElementById('otp-resend')
  const errEl      = document.getElementById('err-otp')

  if (otpInput) otpInput.focus()

  if (verifyBtn && otpInput) {
    verifyBtn.addEventListener('click', async () => {
      const code = otpInput.value.trim()
      if (!/^\d{6}$/.test(code)) {
        if (errEl) errEl.textContent = 'Please enter the 6-digit code'
        return
      }
      if (errEl) errEl.textContent = ''

      const origText    = verifyBtn.textContent
      verifyBtn.disabled = true
      verifyBtn.textContent = 'Verifying...'

      try {
        const result = await verifyOTP({
          phoneNumber:      _appFormData.parentPhone,
          code,
          consentSessionId: `cr-session-${Date.now()}`,
        })
        console.log('[SIM] main.js — OTP verification result:', result.verified)
        if (result.verified) {
          _appStep = 3
          _hydrate('/app')
        } else {
          if (errEl) errEl.textContent = 'Incorrect code — please try again (use 000000 in sim mode)'
          verifyBtn.disabled = false
          verifyBtn.textContent = origText
        }
      } catch (err) {
        console.error('[CRATE] OTP verify error:', err)
        verifyBtn.disabled = false
        verifyBtn.textContent = origText
        _showToast('Verification failed — please try again', false)
      }
    })
  }

  if (resendLink) {
    resendLink.addEventListener('click', async e => {
      e.preventDefault()
      resendLink.textContent = 'Sending...'
      try {
        await sendOTP({ phoneNumber: _appFormData.parentPhone, consentSessionId: `cr-resend-${Date.now()}` })
        console.log('[SIM] main.js — OTP resent')
        resendLink.textContent = 'Code resent!'
        setTimeout(() => { resendLink.textContent = 'Resend SMS Code' }, 3000)
      } catch {
        resendLink.textContent = 'Resend SMS Code'
      }
    })
  }
}

// ── Step 3 init — child profile + age bracket selection ──────────────────────
function _initStep3() {
  let _selectedAge = _appFormData.childAgeGroup || ''

  const form      = document.getElementById('wizard-form-3')
  const ageBtns   = document.querySelectorAll('[data-age]')
  const errAge    = document.getElementById('err-childAge')
  const errNick   = document.getElementById('err-childNickname')

  const UNSEL_CLS = 'bg-cr-charcoal border-cr-charcoal/50 text-cr-cream/55 hover:border-cr-sage/30'
  const SEL_CLS   = 'bg-cr-sage/20 border-cr-sage text-cr-cream'

  ageBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedAge = btn.getAttribute('data-age')
      ageBtns.forEach(b => {
        const isSel = b.getAttribute('data-age') === _selectedAge
        b.className = `${isSel ? SEL_CLS : UNSEL_CLS} rounded-xl border py-4 flex flex-col
                       items-center gap-1 font-body transition-all duration-200 focus:outline-none
                       focus-visible:ring-2 focus-visible:ring-cr-sage`
      })
      if (errAge) errAge.textContent = ''
    })
  })

  if (!form) return
  form.addEventListener('submit', e => {
    e.preventDefault()
    const nickname = (form.querySelector('[name="childNickname"]')?.value || '').trim()
    let valid = true

    if (nickname.length < 2) {
      if (errNick) errNick.textContent = 'Please enter a nickname (at least 2 characters)'
      valid = false
    } else {
      if (errNick) errNick.textContent = ''
    }

    if (!_selectedAge) {
      if (errAge) errAge.textContent = 'Please select an age group'
      valid = false
    } else {
      if (errAge) errAge.textContent = ''
    }

    if (!valid) return

    _appFormData.childNickname = nickname
    _appFormData.childAgeGroup = _selectedAge
    _appStep = 4
    _hydrate('/app')
  })
}

// ── Step 4 init — POPIA consent checkbox + registration submission ────────────
function _initStep4() {
  const submitBtn = document.getElementById('complete-onboarding-btn')
  const checkbox  = document.getElementById('popia-consent-checkbox')
  const errEl     = document.getElementById('err-consent')

  if (!submitBtn) return

  submitBtn.addEventListener('click', async () => {
    if (!checkbox?.checked) {
      if (errEl) errEl.textContent = 'You must explicitly authorise to proceed'
      return
    }
    if (errEl) errEl.textContent = ''

    const origText       = submitBtn.textContent
    submitBtn.disabled   = true
    submitBtn.textContent = 'Completing registration...'

    try {
      // ── Step A: Register parent identity (auth adapter — billing identity only) ──
      const authResult = await registerParent({
        email:          _appFormData.parentEmail,
        hashedPassword: null,
        phoneNumber:    _appFormData.parentPhone,
      })
      console.log('[SIM] main.js — auth.registerParent complete')
      console.log('[SIM] main.js — sessionToken present:', !!authResult.sessionToken)

      // ── Step B: Store PII record (piiStore adapter — POPIA dual-DB isolation) ──
      // POPIA isolation enforced: zero play signals, zero pseudoUUID in this payload.
      const piiResult = await storeParentRecord({
        parentName:  _appFormData.parentName,
        parentEmail: _appFormData.parentEmail,
        parentPhone: _appFormData.parentPhone,
        consentLog: {
          timestamp:    new Date().toISOString(),
          method:       'digital-checkbox',
          popia_signed: true,
        },
        otpVerificationRecord: { verified: true, verifiedAt: new Date().toISOString() },
      })
      console.log('[SIM] main.js — piiStore.storeParentRecord complete')
      console.log('[SIM] main.js — POPIA isolation: zero play signals in PII payload ✓')

      // ── Step C: Generate child pseudoUUID locally (no PII — telemetry DB only) ──
      const pseudoUUID = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

      console.log('[SIM] main.js — pseudoUUID generated locally (zero PII content) ✓')

      // ── Step D: Persist to localStorage ───────────────────────────────────
      _appAccountRef = `CR-${Date.now().toString(36).toUpperCase()}`
      localStorage.setItem('cr_parent_token',    authResult.sessionToken)
      localStorage.setItem('cr_popia_signed',    'true')
      localStorage.setItem('cr_child_uuid',       pseudoUUID)
      localStorage.setItem('cr_child_nickname',   _appFormData.childNickname)
      localStorage.setItem('cr_child_age_group',  _appFormData.childAgeGroup)

      console.log('[SIM] main.js — localStorage: cr_parent_token, cr_popia_signed stored')
      console.log('[SIM] main.js — localStorage: cr_child_uuid (pseudonymous, no PII) stored')
      console.log('[SIM] main.js — account reference:', _appAccountRef)

      _appStep = 5
      _hydrate('/app')

    } catch (err) {
      console.error('[CRATE] registration error:', err)
      submitBtn.disabled   = false
      submitBtn.textContent = origText
      _showToast('Registration error — please try again', false)
    }
  })
}

// ── Step 5 init — success screen ─────────────────────────────────────────────
function _initComplete() {
  console.log('[CRATE] onboarding complete — tokens stored, POPIA consent signed')
  console.log('[CRATE] account reference:', _appAccountRef)
  // data-nav links on the success screen are wired by the shared handler in init()
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
  _toastTimer = setTimeout(() => {
    toast.classList.add('opacity-0')
    setTimeout(() => toast.classList.add('hidden'), 300)
  }, 4000)
}

function _sanitise(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// =============================================================================
// HYDRATION ORCHESTRATOR
// Single-pass: build ctx → ONE innerHTML write → ALL inits in order.
// =============================================================================
function _hydrate(path) {
  if (!app) {
    console.error('[CRATE] _hydrate — #app element not found')
    return
  }

  const route = path === '' ? '/' : path

  // Reset wizard when arriving at /app from a different route
  if (route === '/app' && _previousRoute !== '/app') {
    // Only reset if not already onboarded (let the portal check handle that)
    const alreadyOnboarded =
      !!localStorage.getItem('cr_parent_token') &&
      localStorage.getItem('cr_popia_signed') === 'true'
    if (!alreadyOnboarded) {
      _appStep     = 1
      _appFormData = { parentName: '', parentEmail: '', parentPhone: '', childNickname: '', childAgeGroup: '' }
      _appAccountRef = null
    }
  }
  _previousRoute = route

  const ctx = {
    consentAccepted: localStorage.getItem('cr_consent_accepted') === 'true',
    isOnboarded:
      !!localStorage.getItem('cr_parent_token') &&
      localStorage.getItem('cr_popia_signed') === 'true',
    appStep:     _appStep,
    appFormData: _appFormData,
  }

  app.innerHTML = render(path, ctx)   // ← ONE innerHTML write
  init(path, ctx)                     // ← ALL inits after DOM is written
}

// ── Browser history navigation ────────────────────────────────────────────────
window.addEventListener('popstate', () => {
  _hydrate(window.location.pathname)
})

// ── Initial page load ─────────────────────────────────────────────────────────
_hydrate(window.location.pathname)
