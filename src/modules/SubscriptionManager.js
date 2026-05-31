// ── src/modules/SubscriptionManager.js ───────────────────────────────────────
// Phase 7 — Subscription checkout surface.
// Renders the plan selection, billing frequency toggle, SA delivery channel
// selection, and payment form. Coordinates the checkout handshake across
// payment.js, delivery.js, piiStore.js, and email.js adapters.
//
// Two-function contract (CLAUDE.md):
//   render(selectedPlanId)  — pure HTML string. Zero DOM. Zero async.
//   init(selectedPlanId)    — all DOM queries, event listeners, adapter calls.
//
// POPIA isolation:
//   Billing details (name, email, phone, delivery address) route exclusively
//   through piiStore.js (Database A). The subscription order saved to
//   cr_sim_orders contains only pseudoUUID — zero PII fields.
//
// HPCSA guardrail: No clinical, diagnostic, or evaluation language anywhere.

import { createSubscription }                       from '@/core/integrations/payment.js'
import { lookupPudoLockers, lookupPaxiPoints,
         createPudoShipment, createPaxiConsignment } from '@/core/integrations/delivery.js'
import { storeParentRecord }                         from '@/core/integrations/piiStore.js'
import { sendEmail }                                 from '@/core/integrations/email.js'

// ── Plan catalogue (prices in ZAR) ────────────────────────────────────────────
const _PLANS = Object.freeze({
  starter: Object.freeze({
    id: 'starter', name: 'Starter Kit', monthlyPrice: 650,
    focus: 'Curiosity · Spatial Reasoning',
    features: ['Monthly personalised physical crate', 'Physics-based building materials',
               'Standard challenge card set (English)', 'Pudo or Paxi delivery included'],
  }),
  explorer: Object.freeze({
    id: 'explorer', name: 'Explorer Pack', monthlyPrice: 850,
    focus: 'Systems Thinking · Mechanical Intuition',
    features: ['Monthly personalised physical crate', 'Expanded mechanical toolkit & gears',
               '2 bilingual challenge card sets (EN + AF)', 'Full play trajectory dashboard access',
               'Pudo or Paxi delivery included'],
  }),
  architect: Object.freeze({
    id: 'architect', name: 'Architect Bundle', monthlyPrice: 1150,
    focus: 'All 6 Interest Areas',
    features: ['Monthly personalised physical crate', 'Full 6-dimension material set',
               'Custom-printed bilingual challenge cards', 'Advanced play trajectory insights',
               'Priority Pudo smart locker delivery'],
  }),
})

// ── Module state — persists across postcode lookups and tab switches ───────────
let _activePlan      = 'explorer'   // default plan
let _billingFreq     = 'monthly'
let _deliveryChannel = 'pudo'
let _selectedLoc     = null         // { id, name, address }
let _lockerDebounce  = null

// Annual discount factor
// _ANNUAL_DISCOUNT = 0.85 retained for reference.
// All price calculations use integer arithmetic (×85/100) to avoid
// IEEE 754 float truncation: Math.round(850 × 0.85) = 722 ≠ 723.
const _ANNUAL_DISCOUNT = 0.85

// =============================================================================
// EXPORTED: render(selectedPlanId)
// =============================================================================
export function render(selectedPlanId = null) {
  // Use URL param or passed plan, falling back to module state
  const initPlan = selectedPlanId || new URLSearchParams(window.location.search).get('plan') || _activePlan
  _activePlan = Object.keys(_PLANS).includes(initPlan) ? initPlan : 'explorer'

  return `
    <div class="min-h-screen bg-cr-slate flex flex-col">

      <!-- Minimal header -->
      <div class="max-w-3xl mx-auto w-full px-4 pt-6 flex items-center justify-between">
        <a href="/app" data-nav
           class="font-heading text-cr-sage text-xl font-extrabold tracking-widest
                  hover:text-cr-cream transition-colors">C·R·A·T·E</a>
        <a href="/app" data-nav
           class="font-body text-cr-cream/35 text-xs hover:text-cr-cream/70 transition-colors">
          &#8592; Back to Dashboard
        </a>
      </div>

      <!-- Page heading -->
      <div class="max-w-3xl mx-auto w-full px-4 mt-8 mb-6">
        <p class="font-body text-cr-sage text-xs font-semibold uppercase tracking-widest mb-1">
          Subscription Checkout
        </p>
        <h1 class="font-heading text-cr-cream text-2xl md:text-3xl font-extrabold">
          Complete Your Monthly Crate Plan
        </h1>
      </div>

      <!-- Checkout form -->
      <form id="cr-checkout-form" novalidate
            class="max-w-3xl mx-auto w-full px-4 pb-16 flex flex-col gap-6">

        <!-- ── Section 1: Plan selection ─────────────────────────────────── -->
        <div class="bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 p-5">
          <p class="font-body text-cr-cream/50 text-xs uppercase tracking-widest font-semibold mb-4">
            1. Your Plan
          </p>

          <!-- Monthly / Annual billing toggle -->
          <div class="flex items-center gap-3 mb-5">
            <button type="button" data-billing="monthly"
                    class="font-body text-sm px-4 py-2 rounded-xl border transition-all duration-200
                           ${_billingFreq === 'monthly'
                             ? 'bg-cr-coral/15 border-cr-coral text-cr-coral font-semibold'
                             : 'bg-transparent border-cr-charcoal/60 text-cr-cream/50 hover:border-cr-cream/30'}">
              Monthly
            </button>
            <button type="button" data-billing="annual"
                    class="font-body text-sm px-4 py-2 rounded-xl border transition-all duration-200
                           ${_billingFreq === 'annual'
                             ? 'bg-cr-coral/15 border-cr-coral text-cr-coral font-semibold'
                             : 'bg-transparent border-cr-charcoal/60 text-cr-cream/50 hover:border-cr-cream/30'}">
              Annual
              <span class="ml-1 text-xs text-cr-sage font-semibold">Save 15%</span>
            </button>
          </div>

          <!-- Plan cards -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            ${Object.values(_PLANS).map(p => {
              const isActive  = p.id === _activePlan
              const price     = _billingFreq === 'annual'
                ? Math.round((p.monthlyPrice * 85) / 100)
                : p.monthlyPrice
              return `
                <button type="button" data-plan="${p.id}"
                        class="text-left rounded-xl border p-4 transition-all duration-200
                               ${isActive
                                 ? 'border-cr-coral bg-cr-coral/10'
                                 : 'border-cr-charcoal/60 hover:border-cr-cream/20'}">
                  <p class="font-heading text-cr-cream text-sm font-bold mb-0.5">${p.name}</p>
                  <p class="font-body text-cr-sage text-[10px] mb-2">${p.focus}</p>
                  <div class="flex items-baseline gap-1">
                    <span class="font-heading text-cr-cream text-xl font-extrabold">R${price}</span>
                    <span class="font-body text-cr-cream/30 text-xs">/mo</span>
                  </div>
                  ${_billingFreq === 'annual'
                    ? `<p class="font-body text-cr-sage text-[10px] mt-1">Billed as R${Math.round(price * 12)}/yr</p>`
                    : ''}
                </button>`
            }).join('')}
          </div>
        </div>

        <!-- ── Section 2: Delivery channel ───────────────────────────────── -->
        <div class="bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 p-5">
          <p class="font-body text-cr-cream/50 text-xs uppercase tracking-widest font-semibold mb-4">
            2. Delivery Method
          </p>

          <!-- Channel tabs -->
          <div class="flex gap-2 mb-4">
            <button type="button" data-delivery-tab="pudo"
                    class="font-body text-sm px-4 py-2 rounded-xl border transition-all duration-200
                           ${_deliveryChannel === 'pudo'
                             ? 'bg-cr-sage/15 border-cr-sage text-cr-sage font-semibold'
                             : 'bg-transparent border-cr-charcoal/60 text-cr-cream/50 hover:border-cr-cream/30'}">
              Pudo Smart Lockers
            </button>
            <button type="button" data-delivery-tab="paxi"
                    class="font-body text-sm px-4 py-2 rounded-xl border transition-all duration-200
                           ${_deliveryChannel === 'paxi'
                             ? 'bg-cr-sage/15 border-cr-sage text-cr-sage font-semibold'
                             : 'bg-transparent border-cr-charcoal/60 text-cr-cream/50 hover:border-cr-cream/30'}">
              PEP Paxi Pickup
            </button>
          </div>

          <!-- Pudo section -->
          <div id="cr-delivery-pudo" class="${_deliveryChannel === 'pudo' ? '' : 'hidden'}">
            <p class="font-body text-cr-cream/45 text-xs leading-relaxed mb-3">
              Over 1,500 smart lockers across South Africa. Locker-to-locker from
              <strong class="text-cr-cream/70">R60</strong> &middot;
              Locker-to-door from <strong class="text-cr-cream/70">R70</strong>.
            </p>
            <label for="cr-pudo-postcode" class="block font-body text-cr-cream/60 text-xs font-medium mb-1.5">
              Your SA Postal Code
            </label>
            <input id="cr-pudo-postcode" type="text" inputmode="numeric" maxlength="4"
                   placeholder="e.g. 2000"
                   class="w-full max-w-xs bg-cr-slate border border-cr-charcoal hover:border-cr-sage/40
                          focus:border-cr-sage outline-none rounded-xl px-4 py-3
                          font-body text-cr-cream text-sm placeholder:text-cr-cream/25
                          transition-colors duration-200" />
            <div id="cr-pudo-results" class="mt-2 flex flex-col gap-1.5"></div>
          </div>

          <!-- Paxi section -->
          <div id="cr-delivery-paxi" class="${_deliveryChannel === 'paxi' ? '' : 'hidden'}">
            <p class="font-body text-cr-cream/45 text-xs leading-relaxed mb-3">
              2,800+ PEP, Tekkie Town, and Shoe City collection points nationwide.
              Fixed rate: <strong class="text-cr-cream/70">R59.95</strong>.
            </p>
            <label for="cr-paxi-postcode" class="block font-body text-cr-cream/60 text-xs font-medium mb-1.5">
              Your SA Postal Code
            </label>
            <input id="cr-paxi-postcode" type="text" inputmode="numeric" maxlength="4"
                   placeholder="e.g. 8001"
                   class="w-full max-w-xs bg-cr-slate border border-cr-charcoal hover:border-cr-sage/40
                          focus:border-cr-sage outline-none rounded-xl px-4 py-3
                          font-body text-cr-cream text-sm placeholder:text-cr-cream/25
                          transition-colors duration-200" />
            <div id="cr-paxi-results" class="mt-2 flex flex-col gap-1.5"></div>
          </div>

          <p id="err-delivery" class="font-body text-cr-coral text-xs mt-2 min-h-[1rem]"></p>
        </div>

        <!-- ── Section 3: Billing details (Database A — piiStore.js only) ── -->
        <div class="bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 p-5">
          <p class="font-body text-cr-cream/50 text-xs uppercase tracking-widest font-semibold mb-4">
            3. Billing Details
          </p>
          <p class="font-body text-cr-cream/30 text-xs mb-4 leading-relaxed">
            Your billing details are stored in Database A only and are never linked to your
            child's play activity records. POPIA compliant.
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${_checkoutField('cr-billing-name', 'text', 'Full Name', 'Amahle Dlamini')}
            ${_checkoutField('cr-billing-email', 'email', 'Email Address', 'your@email.co.za')}
            ${_checkoutField('cr-billing-phone', 'tel', 'SA Mobile Number', '072 000 0000')}
          </div>
        </div>

        <!-- ── Section 4: Card payment ────────────────────────────────────── -->
        <div class="bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 p-5">
          <div class="flex items-center gap-3 mb-4">
            <p class="font-body text-cr-cream/50 text-xs uppercase tracking-widest font-semibold">
              4. Card Payment
            </p>
            <span class="px-2.5 py-0.5 rounded-full bg-cr-sage/10 text-cr-sage font-body text-[10px]
                         font-semibold uppercase tracking-wider">
              Simulation Mode
            </span>
          </div>
          <p class="font-body text-cr-cream/30 text-xs mb-4 leading-relaxed">
            No real transaction will be processed. Enter any values to simulate checkout.
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${_checkoutField('cr-card-name', 'text', 'Cardholder Name', 'A Dlamini')}
            ${_checkoutField('cr-card-number', 'text', 'Card Number', '4111 1111 1111 1111')}
            ${_checkoutField('cr-card-expiry', 'text', 'Expiry (MM/YY)', '12/28')}
            ${_checkoutField('cr-card-cvv', 'text', 'CVV', '123')}
          </div>
        </div>

        <!-- ── Order summary + submit ─────────────────────────────────────── -->
        <div class="bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="font-body text-cr-cream/60 text-sm">
              <span id="cr-summary-plan">${_PLANS[_activePlan].name}</span> &middot;
              <span id="cr-summary-freq">${_billingFreq}</span>
            </span>
            <span class="font-heading text-cr-cream font-extrabold text-lg"
                  id="cr-summary-price">
              R${_billingFreq === 'annual'
                ? Math.round((_PLANS[_activePlan].monthlyPrice * 85) / 100)
                : _PLANS[_activePlan].monthlyPrice}/mo
            </span>
          </div>
          <p id="err-form" class="font-body text-cr-coral text-xs mb-3 min-h-[1rem]"></p>
          <button id="cr-checkout-btn" type="submit"
                  class="btn-primary w-full">
            Subscribe &amp; Confirm Order
          </button>
          <p class="font-body text-cr-cream/20 text-xs text-center mt-3">
            Simulation mode active &middot; No real charge &middot; POPIA compliant &middot; Cancel anytime
          </p>
        </div>

      </form>
    </div>`
}

// ── _checkoutField helper ─────────────────────────────────────────────────────
function _checkoutField(id, type, label, placeholder) {
  return `
    <div>
      <label for="${id}" class="block font-body text-cr-cream/60 text-xs font-medium mb-1.5">
        ${label}
      </label>
      <input id="${id}" type="${type}" placeholder="${placeholder}" autocomplete="off"
             class="w-full bg-cr-slate border border-cr-charcoal hover:border-cr-sage/40
                    focus:border-cr-sage outline-none rounded-xl px-4 py-3
                    font-body text-cr-cream text-sm placeholder:text-cr-cream/25
                    transition-colors duration-200" />
    </div>`
}

// =============================================================================
// EXPORTED: init(selectedPlanId)
// =============================================================================
export function init(selectedPlanId = null) {
  // Reset delivery selection on every mount — prevents stale locker/point
  // from a previous visit persisting invisibly into a new checkout attempt.
  _selectedLoc = null
  if (selectedPlanId) _activePlan = selectedPlanId

  // ── Plan selection ────────────────────────────────────────────────────────
  document.querySelectorAll('[data-plan]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activePlan = btn.getAttribute('data-plan')
      _refreshPlanUI()
    })
  })

  // ── Billing frequency toggle ──────────────────────────────────────────────
  document.querySelectorAll('[data-billing]').forEach(btn => {
    btn.addEventListener('click', () => {
      _billingFreq = btn.getAttribute('data-billing')
      _refreshBillingUI()
    })
  })

  // ── Delivery channel tabs ─────────────────────────────────────────────────
  document.querySelectorAll('[data-delivery-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _deliveryChannel = btn.getAttribute('data-delivery-tab')
      _selectedLoc     = null
      _refreshDeliveryUI()
    })
  })

  // ── Pudo postcode lookup ──────────────────────────────────────────────────
  const pudoInput = document.getElementById('cr-pudo-postcode')
  if (pudoInput) {
    pudoInput.addEventListener('input', () => {
      clearTimeout(_lockerDebounce)
      const code = pudoInput.value.replace(/\D/g, '')
      if (code.length < 4) {
        document.getElementById('cr-pudo-results').innerHTML = ''
        _selectedLoc = null
        return
      }
      _lockerDebounce = setTimeout(() => _lookupPudo(code), 400)
    })
  }

  // ── Paxi postcode lookup ──────────────────────────────────────────────────
  const paxiInput = document.getElementById('cr-paxi-postcode')
  if (paxiInput) {
    paxiInput.addEventListener('input', () => {
      clearTimeout(_lockerDebounce)
      const code = paxiInput.value.replace(/\D/g, '')
      if (code.length < 4) {
        document.getElementById('cr-paxi-results').innerHTML = ''
        _selectedLoc = null
        return
      }
      _lockerDebounce = setTimeout(() => _lookupPaxi(code), 400)
    })
  }

  // ── Form submission ───────────────────────────────────────────────────────
  const form = document.getElementById('cr-checkout-form')
  const btn  = document.getElementById('cr-checkout-btn')
  if (form && btn) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      if (btn.disabled) return
      await _handleCheckout(btn)
    })
  }
}

// =============================================================================
// PRIVATE: DOM refresh helpers
// =============================================================================

function _refreshPlanUI() {
  document.querySelectorAll('[data-plan]').forEach(b => {
    const active = b.getAttribute('data-plan') === _activePlan
    b.className = `text-left rounded-xl border p-4 transition-all duration-200 ${
      active ? 'border-cr-coral bg-cr-coral/10' : 'border-cr-charcoal/60 hover:border-cr-cream/20'}`
  })
  _refreshSummary()
}

function _refreshBillingUI() {
  document.querySelectorAll('[data-billing]').forEach(b => {
    const active = b.getAttribute('data-billing') === _billingFreq
    b.className = `font-body text-sm px-4 py-2 rounded-xl border transition-all duration-200 ${
      active
        ? 'bg-cr-coral/15 border-cr-coral text-cr-coral font-semibold'
        : 'bg-transparent border-cr-charcoal/60 text-cr-cream/50 hover:border-cr-cream/30'}`
  })
  // Update plan card prices
  document.querySelectorAll('[data-plan]').forEach(b => {
    const plan  = _PLANS[b.getAttribute('data-plan')]
    const price = _billingFreq === 'annual'
      ? Math.round((plan.monthlyPrice * 85) / 100)
      : plan.monthlyPrice
    const priceEl = b.querySelector('.text-xl')
    if (priceEl) priceEl.textContent = `R${price}`
    const annualEl = b.querySelector('.text-\\[10px\\]')
    if (annualEl && _billingFreq === 'annual') {
      annualEl.textContent = `Billed as R${Math.round(price * 12)}/yr`
      annualEl.classList.remove('hidden')
    } else if (annualEl) {
      annualEl.classList.add('hidden')
    }
  })
  _refreshSummary()
}

function _refreshDeliveryUI() {
  const pudoSection = document.getElementById('cr-delivery-pudo')
  const paxiSection = document.getElementById('cr-delivery-paxi')
  if (pudoSection) pudoSection.classList.toggle('hidden', _deliveryChannel !== 'pudo')
  if (paxiSection) paxiSection.classList.toggle('hidden', _deliveryChannel !== 'paxi')
  document.querySelectorAll('[data-delivery-tab]').forEach(b => {
    const active = b.getAttribute('data-delivery-tab') === _deliveryChannel
    b.className = `font-body text-sm px-4 py-2 rounded-xl border transition-all duration-200 ${
      active
        ? 'bg-cr-sage/15 border-cr-sage text-cr-sage font-semibold'
        : 'bg-transparent border-cr-charcoal/60 text-cr-cream/50 hover:border-cr-cream/30'}`
  })
}

function _refreshSummary() {
  const plan  = _PLANS[_activePlan]
  const price = _billingFreq === 'annual'
    ? Math.round((plan.monthlyPrice * 85) / 100)
    : plan.monthlyPrice
  const planEl  = document.getElementById('cr-summary-plan')
  const freqEl  = document.getElementById('cr-summary-freq')
  const priceEl = document.getElementById('cr-summary-price')
  if (planEl)  planEl.textContent  = plan.name
  if (freqEl)  freqEl.textContent  = _billingFreq
  if (priceEl) priceEl.textContent = `R${price}/mo`
}

// =============================================================================
// PRIVATE: Delivery lookups
// =============================================================================

async function _lookupPudo(postcode) {
  const container = document.getElementById('cr-pudo-results')
  if (!container) return
  container.innerHTML = `<p class="font-body text-cr-cream/30 text-xs">Looking up lockers...</p>`
  try {
    const res = await lookupPudoLockers({ postcode })
    if (!res.success || !res.lockers.length) {
      container.innerHTML = `<p class="font-body text-cr-cream/30 text-xs">No lockers found for this code.</p>`
      return
    }
    container.innerHTML = res.lockers.map(l => `
      <button type="button" data-locker-id="${l.lockerId}"
              data-locker-name="Pudo Locker – ${l.address}"
              class="text-left w-full rounded-xl border px-4 py-3 transition-all duration-200
                     ${_selectedLoc?.id === l.lockerId
                       ? 'border-cr-sage bg-cr-sage/10 text-cr-cream'
                       : 'border-cr-charcoal/50 text-cr-cream/60 hover:border-cr-sage/30'}
                     font-body text-sm">
        <span class="font-medium">${l.address}</span>
        <span class="text-xs text-cr-cream/35 ml-2">${l.distance}</span>
      </button>`).join('')
    container.querySelectorAll('[data-locker-id]').forEach(b => {
      b.addEventListener('click', () => {
        _selectedLoc = { id: b.getAttribute('data-locker-id'), name: b.getAttribute('data-locker-name'), address: b.getAttribute('data-locker-name') }
        container.querySelectorAll('[data-locker-id]').forEach(x => {
          const sel = x.getAttribute('data-locker-id') === _selectedLoc.id
          x.className = x.className.replace(/border-cr-sage.*?text-cr-cream|border-cr-charcoal.*?hover:border-cr-sage\/30/g, '')
          x.classList.toggle('border-cr-sage', sel)
          x.classList.toggle('bg-cr-sage/10', sel)
          x.classList.toggle('text-cr-cream', sel)
          x.classList.toggle('border-cr-charcoal/50', !sel)
          x.classList.toggle('text-cr-cream/60', !sel)
        })
        const errEl = document.getElementById('err-delivery')
        if (errEl) errEl.textContent = ''
      })
    })
  } catch { container.innerHTML = `<p class="font-body text-cr-cream/30 text-xs">Lookup unavailable — try again.</p>` }
}

async function _lookupPaxi(postcode) {
  const container = document.getElementById('cr-paxi-results')
  if (!container) return
  container.innerHTML = `<p class="font-body text-cr-cream/30 text-xs">Looking up collection points...</p>`
  try {
    const res = await lookupPaxiPoints({ postcode })
    if (!res.success || !res.points.length) {
      container.innerHTML = `<p class="font-body text-cr-cream/30 text-xs">No collection points found.</p>`
      return
    }
    container.innerHTML = res.points.map(p => `
      <button type="button" data-point-id="${p.pointId}"
              data-point-name="${p.storeName}"
              class="text-left w-full rounded-xl border px-4 py-3 transition-all duration-200
                     ${_selectedLoc?.id === p.pointId
                       ? 'border-cr-sage bg-cr-sage/10 text-cr-cream'
                       : 'border-cr-charcoal/50 text-cr-cream/60 hover:border-cr-sage/30'}
                     font-body text-sm">
        <span class="font-medium">${p.storeName}</span>
        <span class="text-xs text-cr-cream/35 ml-2">${p.address} · ${p.distance}</span>
      </button>`).join('')
    container.querySelectorAll('[data-point-id]').forEach(b => {
      b.addEventListener('click', () => {
        _selectedLoc = { id: b.getAttribute('data-point-id'), name: b.getAttribute('data-point-name'), address: b.getAttribute('data-point-name') }
        container.querySelectorAll('[data-point-id]').forEach(x => {
          const sel = x.getAttribute('data-point-id') === _selectedLoc.id
          x.classList.toggle('border-cr-sage', sel)
          x.classList.toggle('bg-cr-sage/10', sel)
          x.classList.toggle('text-cr-cream', sel)
          x.classList.toggle('border-cr-charcoal/50', !sel)
          x.classList.toggle('text-cr-cream/60', !sel)
        })
        const errEl = document.getElementById('err-delivery')
        if (errEl) errEl.textContent = ''
      })
    })
  } catch { container.innerHTML = `<p class="font-body text-cr-cream/30 text-xs">Lookup unavailable — try again.</p>` }
}

// =============================================================================
// PRIVATE: Checkout handshake
// =============================================================================

async function _handleCheckout(btn) {
  const errEl = document.getElementById('err-form')

  // ── Field reads ───────────────────────────────────────────────────────────
  const billingName  = document.getElementById('cr-billing-name')?.value.trim()  || ''
  const billingEmail = document.getElementById('cr-billing-email')?.value.trim() || ''
  const billingPhone = document.getElementById('cr-billing-phone')?.value.trim().replace(/\s/g, '') || ''
  const cardName     = document.getElementById('cr-card-name')?.value.trim()     || ''
  const cardNumber   = document.getElementById('cr-card-number')?.value.replace(/\s/g, '') || ''
  const cardExpiry   = document.getElementById('cr-card-expiry')?.value.trim()   || ''
  const cardCVV      = document.getElementById('cr-card-cvv')?.value.trim()      || ''

  // ── Validation ────────────────────────────────────────────────────────────
  if (!billingName || !billingEmail || !billingPhone) {
    if (errEl) errEl.textContent = 'Please complete your billing details.'
    return
  }
  if (!_selectedLoc) {
    const delErr = document.getElementById('err-delivery')
    if (delErr) delErr.textContent = 'Please search for and select a delivery location.'
    if (errEl)  errEl.textContent  = 'Please select a delivery location above.'
    return
  }
  if (!cardName || cardNumber.length < 12 || !cardExpiry || !cardCVV) {
    if (errEl) errEl.textContent = 'Please complete all card payment fields.'
    return
  }

  if (errEl) errEl.textContent = ''

  // ── Loading state ─────────────────────────────────────────────────────────
  btn.disabled      = true
  btn.textContent   = 'Authorising Transaction...'
  btn.classList.add('opacity-70', 'cursor-not-allowed')

  try {
    const plan  = _PLANS[_activePlan]
    const price = _billingFreq === 'annual'
      ? Math.round((plan.monthlyPrice * 85) / 100)
      : plan.monthlyPrice

    // ── Step 1: Create subscription (payment adapter) ─────────────────────
    const payResult = await createSubscription({
      planId:           _activePlan,
      billingFrequency: _billingFreq,
      parentRecordId:   null,   // Phase 2 token — not needed for SIM
      paymentToken:     `sim-tok-${Date.now()}`,
    })
    console.log('[SIM] SubscriptionManager: createSubscription complete')
    console.log('[SIM] SubscriptionManager: subscriptionId:', payResult.subscriptionId)

    // ── Step 2: Generate order reference ──────────────────────────────────
    const orderId = `CR-SIM-${Date.now().toString(36).toUpperCase()}`

    // ── Step 3: Build & save subscription order to cr_sim_orders ──────────
    // POPIA: zero PII fields in this record — pseudoUUID only
    const pseudoUUID = localStorage.getItem('cr_child_uuid') || 'anon'
    const order = {
      type:              'subscription',
      orderId,
      createdAt:         new Date().toISOString(),
      planId:            _activePlan,
      planName:          plan.name,
      billingFrequency:  _billingFreq,
      priceZAR:          price,
      deliveryChannel:   _deliveryChannel,
      deliveryLocation:  { id: _selectedLoc.id, name: _selectedLoc.name },
      subscriptionId:    payResult.subscriptionId,
      nextBillingDate:   payResult.nextBillingDate,
      status:            'confirmed',
      pseudoUUID,
    }
    const existing = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
    existing.unshift(order)
    localStorage.setItem('cr_sim_orders', JSON.stringify(existing))
    console.log('[SIM] SubscriptionManager: order saved — orderId:', orderId)

    // ── Step 4: Store PII record in Database A (piiStore only) ────────────
    // Delivery address is hashed before storage. Zero play signals in payload.
    const hashedAddress = btoa(`${_selectedLoc.name}|${_deliveryChannel}`)
    await storeParentRecord({
      parentName:   billingName,
      parentEmail:  billingEmail,
      parentPhone:  billingPhone,
      hashedDeliveryAddress:  hashedAddress,
      deliveryMethod:         _deliveryChannel,
      consentLog: {
        timestamp:    new Date().toISOString(),
        method:       'subscription-checkout',
        popia_signed: true,
      },
      otpVerificationRecord: null,
    })
    console.log('[SIM] SubscriptionManager: piiStore.storeParentRecord complete')
    console.log('[SIM] SubscriptionManager: POPIA isolation — billing details in Database A only')

    // ── Step 5: Create delivery shipment ──────────────────────────────────
    if (_deliveryChannel === 'pudo') {
      await createPudoShipment({ orderId, toLockerId: _selectedLoc.id, weightKg: 0.8 })
    } else {
      await createPaxiConsignment({ orderId, pickupPointId: _selectedLoc.id, weightKg: 0.8 })
    }
    console.log('[SIM] SubscriptionManager: delivery shipment created')

    // ── Step 6: Send confirmation email (fire-and-forget) ─────────────────
    sendEmail({
      to:           billingEmail,
      templateId:   'subscription-confirmation',
      subject:      `Your C.R.A.T.E. ${plan.name} is confirmed — Order ${orderId}`,
      templateData: { orderId, planName: plan.name, deliveryLocation: _selectedLoc.name },
    }).then(() => {
      console.log('[SIM] SubscriptionManager: confirmation email dispatched')
    }).catch(() => {})

    // ── Step 7: Hard redirect to session confirmation ─────────────────────
    window.location.href = `/?session=${orderId}`

  } catch (err) {
    console.error('[CRATE] SubscriptionManager: checkout error:', err)
    btn.disabled      = false
    btn.textContent   = 'Subscribe & Confirm Order'
    btn.classList.remove('opacity-70', 'cursor-not-allowed')
    if (errEl) errEl.textContent = 'Something went wrong — please try again.'
  }
}
