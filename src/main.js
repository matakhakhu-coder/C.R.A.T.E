// ── src/main.js ─────────────────────────────────────────────────────────────
// C.R.A.T.E. application orchestrator — Phase 1: Public Marketing Shell.
// Enforces the single-pass hydration sequence: all render() helpers concatenated
// into ONE innerHTML write, then all init() calls in order.
//
// Three exclusive render paths (CLAUDE.md §Architecture Constraints):
//   /admin          → AdminShell only. No customer modules.
//   /app            → Parent dashboard environment (Phase 5).
//   everything else → Public marketing shell (this phase).
//
// URL routing via window.location.pathname only. No router library.
// vercel.json catch-all rewrite serves index.html for all paths.

import './style.css'
import { createSubscription }  from '@/core/integrations/payment.js'
import { registerParent }      from '@/core/integrations/auth.js'

// ── DOM mount point ───────────────────────────────────────────────────────────
const app = document.getElementById('app')

// ── Toast state (closure — one timer across all toasts) ───────────────────────
let _toastTimer = null

// =============================================================================
// RENDER HELPERS
// Pure HTML-string builders. Zero DOM access. Zero side effects. Zero async.
// All receive only primitive/plain data. Called only from render().
// =============================================================================

// ── Navbar ────────────────────────────────────────────────────────────────────
function _renderNavbar() {
  return `
    <nav
      id="cr-nav"
      class="sticky top-0 z-40 bg-cr-slate/95 backdrop-blur-sm border-b border-cr-charcoal shadow-nav"
    >
      <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

        <!-- Logomark -->
        <a href="/" data-nav
           class="font-heading text-cr-cream text-xl font-extrabold tracking-widest
                  hover:text-cr-sage transition-colors duration-200">
          C·R·A·T·E
        </a>

        <!-- Desktop navigation -->
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

        <!-- Mobile hamburger -->
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

      <!-- Mobile nav drawer (hidden by default, toggled in init) -->
      <div data-mobile-menu-drawer class="hidden border-t border-cr-charcoal bg-cr-slate">
        <div class="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3">
          <a href="/app"   data-nav class="font-body text-cr-cream/70 text-sm py-2 hover:text-cr-cream">
            Parent Portal
          </a>
          <a href="/admin" data-nav class="font-body text-cr-cream/70 text-sm py-2 hover:text-cr-cream">
            Admin
          </a>
          <a href="#pricing" data-scroll class="btn-primary text-sm text-center">
            Get Started
          </a>
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

        <!-- Legal positioning tag — HPCSA compliant -->
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
          <a href="#pricing" data-scroll class="btn-primary w-full sm:w-auto">
            Choose Your Crate
          </a>
          <a href="#dimensions" data-scroll class="btn-secondary w-full sm:w-auto">
            See the 6 Play Dimensions
          </a>
        </div>

        <!-- Social proof metrics -->
        <div class="mt-16 grid grid-cols-3 gap-6 max-w-md mx-auto">
          <div>
            <p class="font-heading text-cr-coral text-3xl font-extrabold">10</p>
            <p class="font-body text-cr-cream/40 text-xs uppercase tracking-wide mt-1">
              Play signals tracked
            </p>
          </div>
          <div>
            <p class="font-heading text-cr-coral text-3xl font-extrabold">6</p>
            <p class="font-body text-cr-cream/40 text-xs uppercase tracking-wide mt-1">
              Interest dimensions
            </p>
          </div>
          <div>
            <p class="font-heading text-cr-coral text-3xl font-extrabold">1</p>
            <p class="font-body text-cr-cream/40 text-xs uppercase tracking-wide mt-1">
              Personalised crate
            </p>
          </div>
        </div>

      </div>
    </section>
  `
}

// ── Dimension matrix data ─────────────────────────────────────────────────────
// HPCSA guardrail: no clinical, diagnostic, or psychological terminology.
// All descriptions use behavioural, growth-framed language only.
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

// ── Dimension matrix section ──────────────────────────────────────────────────
function _renderDimensionMatrix() {
  const cards = _dimensions.map(d => `
    <div class="bg-cr-slate rounded-2xl p-6 border-t-4 ${d.border}
                shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <div class="flex items-center gap-2.5 mb-4">
        <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.dot}"></span>
        <h3 class="font-heading text-cr-cream text-base font-bold">${d.label}</h3>
      </div>
      <p class="font-body text-cr-cream/65 text-sm leading-relaxed mb-4">
        ${d.description}
      </p>
      <p class="font-body text-cr-cream/25 text-xs leading-relaxed">
        ${d.signals}
      </p>
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

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${cards}
        </div>

      </div>
    </section>
  `
}

// ── Pricing plan data ─────────────────────────────────────────────────────────
const _plans = [
  {
    id:        'starter',
    name:      'Starter Kit',
    price:     'R650',
    period:    '/month',
    tag:       null,
    focus:     'Curiosity · Spatial Reasoning',
    highlight: false,
    features: [
      'Monthly personalised physical crate',
      'Physics-based building materials',
      'Standard challenge card set (English)',
      'Basic play interest summary',
      'Pudo or Paxi delivery included',
    ],
  },
  {
    id:        'explorer',
    name:      'Explorer Pack',
    price:     'R850',
    period:    '/month',
    tag:       'Most Popular',
    focus:     'Systems Thinking · Mechanical Intuition',
    highlight: true,
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
    id:        'architect',
    name:      'Architect Bundle',
    price:     'R1150',
    period:    '/month',
    tag:       null,
    focus:     'All 6 Interest Areas',
    highlight: false,
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

// ── Pricing section ───────────────────────────────────────────────────────────
function _renderPricing() {
  const cards = _plans.map(p => {
    const tagHtml = p.tag
      ? `<span class="inline-block mb-3 px-3 py-1 bg-cr-coral text-cr-cream
                     font-body text-xs font-semibold rounded-full uppercase tracking-wider">
           ${p.tag}
         </span>`
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
        <ul class="flex flex-col gap-3 mb-8 flex-1">
          ${featureList}
        </ul>
        <button
          data-subscribe="${p.id}"
          data-tier-name="${p.name}"
          data-tier-price="${p.price}"
          class="btn-primary w-full text-sm"
        >
          Subscribe Now
        </button>
      </div>
    `
  }).join('')

  return `
    <section id="pricing" class="bg-cr-slate py-20 px-4">
      <div class="max-w-6xl mx-auto">

        <div class="text-center mb-12">
          <p class="font-body text-cr-sage text-xs font-semibold uppercase tracking-widest mb-3">
            Subscription Plans
          </p>
          <h2 class="font-heading text-cr-cream text-3xl md:text-4xl font-extrabold mb-4">
            Choose Your Crate Plan
          </h2>
          <p class="font-body text-cr-cream/55 text-base max-w-xl mx-auto leading-relaxed">
            All plans include the digital sandbox, play interest tracking,
            and your personalised monthly crate — delivered across South Africa.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          ${cards}
        </div>

        <p class="text-center font-body text-cr-cream/25 text-xs mt-8">
          Simulation mode active · No real payment will be processed ·
          POPIA compliant · SA delivery only
        </p>

      </div>
    </section>
  `
}

// ── Footer ────────────────────────────────────────────────────────────────────
function _renderFooter() {
  return `
    <footer class="bg-cr-charcoal border-t border-cr-slate py-10 px-4">
      <div class="max-w-6xl mx-auto flex flex-col md:flex-row items-center
                  justify-between gap-6">
        <div>
          <p class="font-heading text-cr-cream text-lg font-extrabold tracking-widest mb-1">
            C·R·A·T·E
          </p>
          <p class="font-body text-cr-cream/35 text-xs">
            Developmental Play Assistant · STEAM Interest Exploration Tool
          </p>
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

// ── POPIA consent banner ──────────────────────────────────────────────────────
// Fixed bottom overlay. Rendered only when cr_consent_accepted is not 'true'.
// init('/') wires the accept/review button events.
function _renderPOPIABanner() {
  return `
    <div
      id="cr-popia-banner"
      class="fixed bottom-0 left-0 right-0 z-50
             bg-cr-charcoal border-t-2 border-cr-sage"
      role="complementary"
      aria-label="Data privacy notice"
    >
      <div class="max-w-6xl mx-auto px-4 py-4
                  flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div class="flex-1">
          <p class="font-body text-cr-cream text-sm font-semibold mb-1">
            Your child's play data is kept completely separate from your personal details.
          </p>
          <p class="font-body text-cr-cream/50 text-xs leading-relaxed">
            Behavioral signals from sandbox play are stored under a randomised identifier only.
            Your name, email, and address are never linked to play records.
            POPIA compliant · South Africa.
          </p>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <button
            data-accept-consent
            class="btn-consent text-sm px-4 py-2 min-h-[44px]"
          >
            Accept &amp; Continue
          </button>
          <button
            data-review-consent
            class="font-body text-cr-cream/45 text-xs underline underline-offset-2
                   hover:text-cr-cream transition-colors min-h-[44px] px-2"
          >
            Review Policy
          </button>
        </div>
      </div>
    </div>
  `
}

// =============================================================================
// RENDER — master route dispatcher
// Pure function: receives path + ctx, returns complete HTML string for ONE write.
// ctx.consentAccepted is read from localStorage in _hydrate() before render().
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

  // ── Parent dashboard environment (Phase 5) ─────────────────────────────────
  if (route === '/app') {
    return `
      <div class="min-h-screen bg-cr-slate flex flex-col items-center justify-center px-4">
        <div class="text-center max-w-lg">
          <p class="font-heading text-cr-sage text-sm font-bold uppercase tracking-widest mb-3">
            Coming in Phase 5
          </p>
          <h1 class="font-heading text-cr-cream text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
            Parent Portal
          </h1>
          <p class="font-body text-cr-cream/65 text-base mb-8">
            Play trajectory insights and crate management will be available here.
          </p>
          <a href="/" data-nav class="btn-secondary text-sm">← Back to Home</a>
        </div>
      </div>
    `
  }

  // ── Admin control shell (Phase 8) ──────────────────────────────────────────
  if (route === '/admin') {
    return `
      <div class="min-h-screen bg-cr-slate flex flex-col items-center justify-center px-4">
        <div class="text-center max-w-lg">
          <p class="font-heading text-cr-coral text-sm font-bold uppercase tracking-widest mb-3">
            Admin Only — Coming in Phase 8
          </p>
          <h1 class="font-heading text-cr-cream text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
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
// INIT — all DOM queries, event listeners, and adapter calls
// Runs after app.innerHTML has been written. Receives same ctx as render().
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

  // ── Smooth scroll for anchor links (all routes) ───────────────────────────
  document.querySelectorAll('[data-scroll]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault()
      const selector = link.getAttribute('href')
      const target = document.querySelector(selector)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      // Close mobile drawer if open
      const drawer = document.querySelector('[data-mobile-menu-drawer]')
      if (drawer && !drawer.classList.contains('hidden')) {
        drawer.classList.add('hidden')
      }
    })
  })

  // ── Route-specific interactions ───────────────────────────────────────────
  if (route === '/') {
    _initMarketingShell()
  }

  if (route === '/app') {
    console.log('[CRATE] init — parent portal placeholder active (Phase 5)')
  }

  if (route === '/admin') {
    console.log('[CRATE] init — admin shell placeholder active (Phase 8)')
  }
}

// ── _initMarketingShell() ─────────────────────────────────────────────────────
// All Phase 1 landing-page interactions. Called from init('/') only.
function _initMarketingShell() {

  // ── Mobile hamburger menu ─────────────────────────────────────────────────
  const menuBtn    = document.querySelector('[data-mobile-menu-btn]')
  const menuDrawer = document.querySelector('[data-mobile-menu-drawer]')

  if (menuBtn && menuDrawer) {
    menuBtn.addEventListener('click', () => {
      const isOpen = !menuDrawer.classList.contains('hidden')
      if (isOpen) {
        menuDrawer.classList.add('hidden')
        menuBtn.setAttribute('aria-expanded', 'false')
      } else {
        menuDrawer.classList.remove('hidden')
        menuBtn.setAttribute('aria-expanded', 'true')
      }
    })
  }

  // ── Subscribe Now — checkout simulation pipeline ──────────────────────────
  // Uses @/core/integrations/payment.js + auth.js adapters.
  // Both run in [SIM] mode until FLAGS flip to false.
  document.querySelectorAll('[data-subscribe]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tierId   = btn.getAttribute('data-subscribe')
      const tierName = btn.getAttribute('data-tier-name')
      const tierPrice = btn.getAttribute('data-tier-price')

      // ── Loading state ────────────────────────────────────────────────────
      const originalText = btn.textContent.trim()
      btn.disabled = true
      btn.textContent = 'Processing...'
      btn.classList.add('opacity-70', 'cursor-not-allowed')

      try {
        // Step 1 — Register provisional parent account (auth adapter)
        // NOTE: Billing identity routes through auth.js only.
        // Play telemetry routes through telemetry.js only. (POPIA isolation)
        const authResult = await registerParent({
          email:          null,   // Collected in Phase 2 onboarding
          hashedPassword: null,   // Collected in Phase 2 onboarding
          phoneNumber:    null,   // Collected in Phase 2 onboarding
        })

        // Step 2 — Create subscription record (payment adapter)
        const paymentResult = await createSubscription({
          planId:           tierId,
          billingFrequency: 'monthly',
          parentRecordId:   authResult.parentRecordId,
        })

        console.log('[SIM] main.js — checkout simulation complete')
        console.log('[SIM] main.js — planId:', tierId)
        console.log('[SIM] main.js — tierName:', tierName)
        console.log('[SIM] main.js — orderId:', paymentResult.orderId)
        console.log('[SIM] main.js — parentRecordId present:', !!authResult.parentRecordId)
        console.log('[SIM] main.js — POPIA isolation: billing identity in auth.js only; ' +
                    'play signals will route through telemetry.js only (no cross-reference)')

        // ── Success state ────────────────────────────────────────────────
        btn.classList.remove('opacity-70', 'cursor-not-allowed')
        btn.className = 'btn-consent w-full text-sm cursor-default'
        btn.textContent = `✓ Confirmed · ${paymentResult.orderId || 'SIM-OK'}`

        _showToast(
          `${tierName} (${tierPrice}) confirmed! Order: ${paymentResult.orderId || 'SIM-OK'}`,
          true,
        )

      } catch (err) {
        console.error('[CRATE] checkout error:', err)
        btn.disabled = false
        btn.textContent = originalText
        btn.classList.remove('opacity-70', 'cursor-not-allowed')
        _showToast('Something went wrong — please try again', false)
      }
    })
  })

  // ── POPIA consent banner ──────────────────────────────────────────────────
  const banner    = document.getElementById('cr-popia-banner')
  const acceptBtn = document.querySelector('[data-accept-consent]')
  const reviewBtn = document.querySelector('[data-review-consent]')

  if (acceptBtn && banner) {
    acceptBtn.addEventListener('click', () => {
      localStorage.setItem('cr_consent_accepted', 'true')
      banner.classList.add('hidden')
      console.log('[CRATE] POPIA consent accepted — cr_consent_accepted stored in localStorage')
    })
  }

  if (reviewBtn) {
    reviewBtn.addEventListener('click', () => {
      console.log('[CRATE] POPIA policy review requested — full policy modal wired in Phase 2')
      _showToast('Full data privacy policy available in Phase 2', true)
    })
  }

  console.log('[CRATE] init — public marketing shell active')
}

// =============================================================================
// UTILITIES — shared helpers, not route-specific
// =============================================================================

// ── _showToast(message, isSuccess) ───────────────────────────────────────────
// Displays a transient notification using the #cr-toast element in index.html.
// Positioned top-centre to avoid overlap with fixed POPIA banner at bottom.
function _showToast(message, isSuccess = true) {
  const toast = document.getElementById('cr-toast')
  if (!toast) return
  clearTimeout(_toastTimer)
  toast.textContent = message
  toast.className = [
    'fixed top-6 left-1/2 -translate-x-1/2 z-50',
    'px-5 py-3 rounded-2xl font-body text-sm font-medium text-cr-cream',
    'shadow-card-hover pointer-events-none',
    'transition-all duration-300',
    isSuccess ? 'bg-cr-sage' : 'bg-cr-coral',
  ].join(' ')
  _toastTimer = setTimeout(() => {
    toast.classList.add('opacity-0')
    setTimeout(() => toast.classList.add('hidden'), 300)
  }, 4000)
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

// =============================================================================
// HYDRATION ORCHESTRATOR
// Single-pass: read context → ONE innerHTML write → ALL inits in order.
// =============================================================================
function _hydrate(path) {
  if (!app) {
    console.error('[CRATE] _hydrate — #app element not found in DOM')
    return
  }
  // Read localStorage BEFORE render so ctx.consentAccepted drives banner visibility
  const ctx = {
    consentAccepted: localStorage.getItem('cr_consent_accepted') === 'true',
  }
  app.innerHTML = render(path, ctx)   // ← ONE innerHTML write
  init(path, ctx)                     // ← ALL inits after DOM is written
}

// ── Browser history: back / forward navigation ────────────────────────────────
window.addEventListener('popstate', () => {
  _hydrate(window.location.pathname)
})

// ── Initial page load ─────────────────────────────────────────────────────────
_hydrate(window.location.pathname)
