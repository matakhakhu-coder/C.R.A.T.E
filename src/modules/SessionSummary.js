// ── src/modules/SessionSummary.js ────────────────────────────────────────────
// Phase 7 — Subscription confirmation receipt.
// Renders the standalone checkout receipt when the URL contains
// ?session=CR-SIM-XXXXXX. Consumed by the mountConfirmation() branch in
// main.js (rendered between _renderNavbar() and _renderFooter()).
//
// Two-function contract (CLAUDE.md):
//   render(orderId) — pure HTML string. Reads from localStorage only.
//                     Zero DOM. Zero async. Zero side effects.
//   init(orderId)   — DOM queries and event listeners only.
//                     Zero innerHTML writes.
//
// HPCSA guardrail: No clinical, diagnostic, or evaluation language anywhere.
// POPIA isolation: Reads only cr_sim_orders (pseudoUUID only) and
//                  cr_sim_profile (pseudoUUID only). Never reads PII fields.

import * as CratePreview from '@/modules/CratePreview.js'

// ── Sanitise helper ───────────────────────────────────────────────────────────
function _s(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Format date for receipt display ──────────────────────────────────────────
function _fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return '—' }
}

// =============================================================================
// EXPORTED: render(orderId)
// Returns the full receipt HTML. Called by main.js mountConfirmation() branch.
// =============================================================================
export function render(orderId) {
  if (!orderId) return _renderNotFound(null)

  // ── Load order from localStorage ──────────────────────────────────────────
  let order = null
  try {
    const orders = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
    order = orders.find(o => o.orderId === orderId && o.type === 'subscription') || null
  } catch { /* malformed storage */ }

  if (!order) return _renderNotFound(orderId)

  // ── Load associated crate manifest (most recent, pseudoUUID matched) ──────
  let manifest = null
  try {
    const orders = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
    manifest = orders.find(o => o.components && o.pseudoUUID === order.pseudoUUID) || null
  } catch { /* no manifest yet */ }

  return _renderReceipt(order, manifest)
}

// =============================================================================
// EXPORTED: init(orderId)
// Binds interface behaviors after DOM has been written.
// =============================================================================
export function init(orderId) {
  // ── Print receipt button ──────────────────────────────────────────────────
  const printBtn = document.getElementById('cr-print-receipt')
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print()
    })
  }

  // ── Dashboard navigation ──────────────────────────────────────────────────
  // data-nav links on the receipt are wired by main.js shared handler
  console.log('[CRATE] SessionSummary: confirmation receipt active — orderId:', orderId)
}

// =============================================================================
// PRIVATE RENDER HELPERS
// =============================================================================

// ── _renderReceipt(order, manifest) ──────────────────────────────────────────
function _renderReceipt(order, manifest) {
  const deliveryLabel = order.deliveryChannel === 'pudo' ? 'Pudo Smart Locker' : 'PEP Paxi Collection Point'
  const locationName  = order.deliveryLocation?.name || 'Selected location'
  const nextBilling   = _fmtDate(order.nextBillingDate)

  return `
    <div class="max-w-2xl mx-auto w-full px-4 py-12">

      <!-- Success badge -->
      <div class="text-center mb-10">
        <div class="w-16 h-16 rounded-full bg-cr-sage/20 border-2 border-cr-sage
                    flex items-center justify-center mx-auto mb-4">
          <span class="font-heading text-cr-sage text-3xl font-extrabold">&#10003;</span>
        </div>
        <h1 class="font-heading text-cr-cream text-2xl md:text-3xl font-extrabold mb-2">
          Order Confirmed
        </h1>
        <p class="font-body text-cr-cream/50 text-sm">
          Your physical STEAM kit is being prepared. Here is your order summary.
        </p>
      </div>

      <!-- Receipt card -->
      <div class="bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 overflow-hidden mb-6">

        <!-- Order reference header -->
        <div class="px-5 py-4 border-b border-cr-slate/50 flex items-start justify-between gap-3">
          <div>
            <p class="font-body text-cr-cream/40 text-xs uppercase tracking-widest font-semibold mb-1">
              Order Reference
            </p>
            <p class="font-heading text-cr-cream text-xl font-extrabold">${_s(order.orderId)}</p>
          </div>
          <div class="text-right">
            <p class="font-body text-cr-cream/40 text-xs">${_fmtDate(order.createdAt)}</p>
            <span class="inline-block mt-1 px-2.5 py-0.5 rounded-full font-body text-[10px]
                         font-semibold uppercase tracking-wider bg-cr-sage/15 text-cr-sage">
              Confirmed
            </span>
          </div>
        </div>

        <!-- Order detail rows -->
        <div class="px-5 py-4 flex flex-col gap-4">

          <!-- Plan -->
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-body text-cr-cream/40 text-xs uppercase tracking-wider mb-0.5">Plan</p>
              <p class="font-body text-cr-cream text-sm font-semibold">${_s(order.planName)}</p>
              <p class="font-body text-cr-cream/35 text-xs">${_s(order.billingFrequency)} billing</p>
            </div>
            <div class="text-right">
              <p class="font-heading text-cr-cream text-lg font-extrabold">R${order.priceZAR}/mo</p>
              ${order.billingFrequency === 'annual'
                ? `<p class="font-body text-cr-cream/30 text-xs">Billed as R${order.priceZAR * 12}/yr</p>`
                : `<p class="font-body text-cr-cream/30 text-xs">Next: ${nextBilling}</p>`}
            </div>
          </div>

          <div class="h-px bg-cr-slate/40"></div>

          <!-- Delivery -->
          <div>
            <p class="font-body text-cr-cream/40 text-xs uppercase tracking-wider mb-0.5">
              ${deliveryLabel}
            </p>
            <p class="font-body text-cr-cream text-sm font-semibold">${_s(locationName)}</p>
            <p class="font-body text-cr-cream/35 text-xs">
              ${order.deliveryChannel === 'pudo'
                ? 'Locker-to-locker delivery from R60'
                : 'Store pickup — R59.95 flat rate'}
            </p>
          </div>

          <div class="h-px bg-cr-slate/40"></div>

          <!-- Dispatch timeline -->
          <div class="bg-cr-slate/40 rounded-xl p-4">
            <p class="font-body text-cr-cream/50 text-xs uppercase tracking-wider font-semibold mb-1">
              Dispatch Timeline
            </p>
            <p class="font-body text-cr-cream text-sm leading-relaxed">
              Kitting and localised print dispatch will assemble within
              <strong class="text-cr-sage">3–5 working days</strong>.
              You will receive a tracking notification once your crate is dispatched.
            </p>
          </div>

        </div>
      </div>

      <!-- Personalised kit preview from CratePreview module -->
      ${manifest
        ? `<div class="mb-6">
             <p class="font-body text-cr-cream/40 text-xs uppercase tracking-widest font-semibold mb-3">
               Your Personalised Kit
             </p>
             ${CratePreview.render(manifest)}
           </div>`
        : `<div class="mb-6 bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 p-5">
             <p class="font-body text-cr-cream/40 text-xs uppercase tracking-wider font-semibold mb-1">Kit Preview</p>
             <p class="font-body text-cr-cream/50 text-sm">
               Complete a sandbox play session to unlock your personalised kit preview.
             </p>
           </div>`}

      <!-- Action buttons -->
      <div class="flex flex-col sm:flex-row gap-3">
        <a href="/app" data-nav class="btn-primary text-sm flex-1 text-center">
          Go to Dashboard &rarr;
        </a>
        <button id="cr-print-receipt" type="button"
                class="btn-secondary text-sm flex-1">
          Print Receipt
        </button>
      </div>

      <p class="font-body text-cr-cream/20 text-xs text-center mt-6">
        Simulation mode &middot; No real charge was processed &middot;
        POPIA compliant &middot; South Africa
      </p>

    </div>`
}

// ── _renderNotFound(orderId) ──────────────────────────────────────────────────
function _renderNotFound(orderId) {
  return `
    <div class="max-w-2xl mx-auto w-full px-4 py-16 text-center">
      <p class="font-heading text-cr-coral text-sm font-bold uppercase tracking-widest mb-3">
        Receipt not found
      </p>
      <h1 class="font-heading text-cr-cream text-3xl font-extrabold mb-4">
        ${orderId ? `Order ${_s(orderId)}` : 'Order'} not found
      </h1>
      <p class="font-body text-cr-cream/55 text-base mb-8">
        This order reference does not match any record in your session.
        Please check the link or return to your dashboard.
      </p>
      <a href="/app" data-nav class="btn-secondary text-sm">
        &#8592; Back to Dashboard
      </a>
    </div>`
}
