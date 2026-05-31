// ── src/admin/CrateQueueView.js ───────────────────────────────────────────────
// Phase 8 — Fulfillment kitting workspace.
// Shows orders at 'new' or 'kitting' status grouped by primary kit type.
// Displays exact physical item kitting sheets. Triggers POD print jobs.
//
// Isolation: Never imported by src/modules/ or src/components/.
// HPCSA: Logistics and operations language only. No clinical terminology.

import { dispatchPrintJob } from '@/core/integrations/pod.js'

// ── Shared sanitiser ──────────────────────────────────────────────────────────
function _s(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

// ── Load orders ready for kitting ─────────────────────────────────────────────
function _loadKittingOrders() {
  try {
    const all = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
    return all.filter(o => o.type === 'subscription' && (o.status === 'new' || o.status === 'kitting'))
  } catch { return [] }
}

// ── Find manifest for an order ────────────────────────────────────────────────
function _findManifest(order) {
  if (order.crateManifest) return order.crateManifest
  try {
    const all = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
    return all.find(o => o.components && o.pseudoUUID === order.pseudoUUID) || null
  } catch { return null }
}

// ── Group orders by primary kit type ─────────────────────────────────────────
function _groupByKitType(orders) {
  const groups = {}
  for (const order of orders) {
    const manifest = _findManifest(order)
    const kitType  = manifest?.components?.primary?.kitType || 'Unassigned'
    if (!groups[kitType]) groups[kitType] = []
    groups[kitType].push({ order, manifest })
  }
  return groups
}

// =============================================================================
// EXPORTED: render()
// =============================================================================
export function render() {
  const orders = _loadKittingOrders()

  if (orders.length === 0) {
    return `
      <div>
        <h2 class="font-heading text-cr-cream text-lg font-bold mb-5">Fulfillment Kitting</h2>
        <div class="bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 p-8 text-center">
          <p class="font-heading text-cr-cream text-base font-bold mb-2">Kitting Queue Empty</p>
          <p class="font-body text-cr-cream/45 text-sm">
            No orders are currently at New or Kitting status.
            Advance an order to Kitting from the Orders Queue view.
          </p>
        </div>
      </div>`
  }

  const groups   = _groupByKitType(orders)
  const kitCards = Object.entries(groups).map(([kitType, items]) => `
    <div class="bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 overflow-hidden mb-5">

      <!-- Kit type header -->
      <div class="px-5 py-4 border-b border-cr-slate/50 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-cr-coral flex-shrink-0"></span>
          <h3 class="font-heading text-cr-cream text-base font-bold">${_s(kitType)}</h3>
        </div>
        <span class="font-body text-cr-cream/35 text-xs">${items.length} order${items.length !== 1 ? 's' : ''} in this batch</span>
      </div>

      <!-- Kitting sheets -->
      ${items.map(({ order, manifest }) => _renderKittingSheet(order, manifest)).join('')}

    </div>`
  ).join('')

  return `
    <div>
      <div class="flex items-center justify-between mb-5">
        <h2 class="font-heading text-cr-cream text-lg font-bold">Fulfillment Kitting</h2>
        <span class="font-body text-cr-cream/30 text-xs">${orders.length} order${orders.length !== 1 ? 's' : ''} in production queue</span>
      </div>
      ${kitCards}
    </div>`
}

// ── _renderKittingSheet(order, manifest) ──────────────────────────────────────
function _renderKittingSheet(order, manifest) {
  const safeId     = (order.orderId || '').replace(/[^A-Za-z0-9]/g, '-')
  const hasManifest = manifest?.components

  const itemsList = hasManifest ? (() => {
    const allItems = []
    const p = manifest.components.primary
    const s = manifest.components.secondary
    const x = manifest.components.stretch
    if (p?.items) allItems.push(...p.items.map(i => ({ item: i, slot: '70% Core' })))
    if (s?.items) allItems.push(...s.items.map(i => ({ item: i, slot: '20% Add-on' })))
    if (x?.items) allItems.push(...x.items.map(i => ({ item: i, slot: '10% Stretch' })))
    return allItems
  })() : []

  const itemRows = itemsList.map(({ item, slot }) => `
    <tr class="border-b border-cr-slate/20">
      <td class="px-3 py-2 font-body text-cr-cream/70 text-xs">${_s(item)}</td>
      <td class="px-3 py-2 font-body text-cr-cream/35 text-[10px]">${_s(slot)}</td>
      <td class="px-3 py-2 text-center">
        <span class="inline-block w-3 h-3 rounded border border-cr-cream/20"></span>
      </td>
    </tr>`).join('')

  const podStatus   = order.podStatus
  const btnId       = `print-btn-${safeId}`
  const btnDisabled = podStatus === 'queued' || podStatus === 'printed'
  const btnLabel    = podStatus === 'queued'   ? 'Print Queued &#10003;'
                    : podStatus === 'printed'  ? 'Cards Printed &#10003;'
                    : 'Trigger Print Job'

  return `
    <div class="border-b border-cr-slate/30 last:border-b-0 px-5 py-4">
      <div class="flex items-start justify-between gap-4 mb-3">
        <div>
          <p class="font-body text-cr-cream text-sm font-semibold">${_s(order.orderId)}</p>
          <p class="font-body text-cr-cream/40 text-xs">
            ${order.deliveryChannel === 'pudo' ? 'Pudo Locker' : 'PEP Paxi'} &middot;
            ${_s(order.deliveryLocation?.name || '—')} &middot;
            R${order.priceZAR}/mo
          </p>
        </div>
        <button id="${btnId}"
                data-print-order="${_s(order.orderId)}"
                ${btnDisabled ? 'disabled' : ''}
                class="font-body text-xs px-4 py-2 rounded-xl border min-h-[36px]
                       transition-all duration-200 flex-shrink-0
                       ${btnDisabled
                         ? 'border-cr-sage/30 text-cr-sage/60 cursor-default'
                         : 'border-cr-coral text-cr-coral hover:bg-cr-coral/10'}">
          ${btnLabel}
        </button>
      </div>

      ${hasManifest ? `
        <!-- Physical kitting checklist -->
        <div class="bg-cr-slate/40 rounded-xl overflow-hidden">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-cr-slate/40">
                <th class="px-3 py-2 text-left font-body text-cr-cream/30 font-semibold uppercase tracking-wider text-[10px]">Physical Item</th>
                <th class="px-3 py-2 text-left font-body text-cr-cream/30 font-semibold uppercase tracking-wider text-[10px]">Kit Slot</th>
                <th class="px-3 py-2 text-center font-body text-cr-cream/30 font-semibold uppercase tracking-wider text-[10px]">&#10003;</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div class="px-3 py-2 border-t border-cr-slate/30 flex gap-3 flex-wrap">
            <span class="font-body text-cr-cream/30 text-[10px]">Challenge cards: ${_s(manifest.challengeCardTheme)}</span>
            <span class="font-body text-cr-cream/30 text-[10px]">Language: ${_s(manifest.language)}</span>
            ${manifest.isWheelSpinPivot ? '<span class="font-body text-cr-coral text-[10px]">[PIVOT] modifier active</span>' : ''}
          </div>
        </div>` : `
        <p class="font-body text-cr-cream/25 text-xs">No kit manifest linked — generate from play profile first.</p>`}
    </div>`
}

// =============================================================================
// EXPORTED: init()
// =============================================================================
export function init() {
  document.querySelectorAll('[data-print-order]').forEach(btn => {
    if (btn.disabled) return

    btn.addEventListener('click', async () => {
      const orderId = btn.getAttribute('data-print-order')
      btn.disabled   = true
      btn.textContent = 'Printing challenge materials...'
      btn.classList.remove('border-cr-coral', 'text-cr-coral', 'hover:bg-cr-coral/10')
      btn.classList.add('border-cr-cream/20', 'text-cr-cream/40', 'cursor-default')

      try {
        // Find the manifest for this order
        let manifest = null
        try {
          const orders = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
          const order  = orders.find(o => o.orderId === orderId)
          manifest     = order?.crateManifest || orders.find(o => o.components && o.pseudoUUID === order?.pseudoUUID)
        } catch { /* ignore */ }

        await dispatchPrintJob({
          orderId:            orderId,
          challengeCardTheme: manifest?.challengeCardTheme || 'exploration',
          insertTheme:        manifest?.insertTheme        || 'standard',
          stickerSet:         manifest?.stickerSet         || 'standard',
          language:           manifest?.language           || 'bilingual',
          quantity:           1,
        })

        // Update order status to kitting if still new
        try {
          const orders = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
          const idx    = orders.findIndex(o => o.orderId === orderId)
          if (idx !== -1) {
            if (orders[idx].status === 'new') orders[idx].status = 'kitting'
            orders[idx].podStatus = 'queued'
            localStorage.setItem('cr_sim_orders', JSON.stringify(orders))
          }
        } catch { /* ignore */ }

        btn.textContent = 'Print Queued ✓'
        btn.classList.remove('border-cr-cream/20', 'text-cr-cream/40')
        btn.classList.add('border-cr-sage/30', 'text-cr-sage/60')

        console.log('[CRATE] CrateQueueView: print job dispatched for', orderId)
        _showAdminToast('Challenge cards queued for print — 2 business days', true)

      } catch (err) {
        console.error('[CRATE] CrateQueueView: print dispatch failed:', err)
        btn.disabled    = false
        btn.textContent = 'Trigger Print Job'
        btn.classList.remove('border-cr-cream/20', 'text-cr-cream/40', 'cursor-default')
        btn.classList.add('border-cr-coral', 'text-cr-coral', 'hover:bg-cr-coral/10')
        _showAdminToast('Print dispatch failed — please retry', false)
      }
    })
  })
}

// ── _showAdminToast(msg, success) ─────────────────────────────────────────────
// Lightweight toast for admin shell (no dependency on main.js _showToast).
function _showAdminToast(msg, success = true) {
  const existing = document.getElementById('cr-admin-toast')
  if (existing) existing.remove()
  const el = document.createElement('div')
  el.id = 'cr-admin-toast'
  el.textContent = msg
  el.className = [
    'fixed bottom-6 right-6 z-50',
    'px-5 py-3 rounded-2xl font-body text-sm font-medium text-cr-cream',
    'shadow-card-hover pointer-events-none transition-all duration-300',
    success ? 'bg-cr-sage' : 'bg-cr-coral',
  ].join(' ')
  document.body.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 300)
  }, 3500)
}
