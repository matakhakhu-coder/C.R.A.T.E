// ── src/admin/OrderQueue.js ───────────────────────────────────────────────────
// Phase 8 — Customer service order tracking view.
// Reads from cr_sim_orders, shows subscription entries with status badges,
// filter tabs, and expandable detail drawers for order management.
//
// Isolation: Never imported by src/modules/ or src/components/.
// HPCSA: No clinical language — order, logistics, and operations terminology only.
// POPIA: Shows pseudoUUID only — never displays parentName/email/phone.

// ── Status configuration ──────────────────────────────────────────────────────
const _STATUS = Object.freeze({
  new:        { label: 'New',        cls: 'bg-cr-cream/10 text-cr-cream/55'    },
  kitting:    { label: 'Kitting',    cls: 'bg-cr-coral/15 text-cr-coral'       },
  dispatched: { label: 'Dispatched', cls: 'bg-cr-sage/15 text-cr-sage'         },
  delivered:  { label: 'Delivered',  cls: 'bg-cr-sage/20 text-cr-sage font-bold' },
})

const _STATUSES = Object.keys(_STATUS)

// ── Helpers ───────────────────────────────────────────────────────────────────
function _s(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function _fmtDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' }) }
  catch { return '—' }
}
function _safeId(orderId) { return (orderId || '').replace(/[^A-Za-z0-9]/g, '-') }

// ── Load subscription orders ──────────────────────────────────────────────────
function _loadOrders() {
  try {
    const all = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
    return all.filter(o => o.type === 'subscription')
  } catch { return [] }
}

// ── Find associated crate manifest for an order ────────────────────────────────
function _findManifest(order) {
  // Check embedded manifest first (seed orders)
  if (order.crateManifest) return order.crateManifest
  // Fallback: find matching crate manifest by pseudoUUID in cr_sim_orders
  try {
    const all = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
    return all.find(o => o.components && o.pseudoUUID === order.pseudoUUID) || null
  } catch { return null }
}

// =============================================================================
// EXPORTED: render(filter)
// =============================================================================
export function render(filter = 'all') {
  const orders  = _loadOrders()
  const visible = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  const filters = ['all', ..._STATUSES]
  const filterTabs = filters.map(f => `
    <button data-filter="${f}"
            class="font-body text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 capitalize
                   ${f === filter
                     ? 'bg-cr-coral/15 border-cr-coral text-cr-coral font-semibold'
                     : 'bg-transparent border-cr-charcoal/60 text-cr-cream/50 hover:border-cr-cream/20'}">
      ${f}${f !== 'all' ? ` <span class="ml-1 opacity-60">(${orders.filter(o=>o.status===f).length})</span>` : ` (${orders.length})`}
    </button>`).join('')

  const rows = visible.length === 0
    ? `<tr><td colspan="6" class="px-4 py-8 text-center font-body text-cr-cream/30 text-sm">
         No orders matching this filter.
       </td></tr>`
    : visible.map(order => _renderRow(order)).join('')

  return `
    <div>
      <div class="flex items-center justify-between mb-5">
        <h2 class="font-heading text-cr-cream text-lg font-bold">Orders Queue</h2>
        <span class="font-body text-cr-cream/30 text-xs">${orders.length} total subscription orders</span>
      </div>

      <!-- Filter tabs -->
      <div class="flex flex-wrap gap-2 mb-5">${filterTabs}</div>

      <!-- Orders table -->
      <div class="bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-cr-slate/50">
              <th class="px-4 py-3 text-left font-body text-cr-cream/40 text-xs uppercase tracking-wider font-semibold">Order ID</th>
              <th class="px-4 py-3 text-left font-body text-cr-cream/40 text-xs uppercase tracking-wider font-semibold">Created</th>
              <th class="px-4 py-3 text-left font-body text-cr-cream/40 text-xs uppercase tracking-wider font-semibold">Plan</th>
              <th class="px-4 py-3 text-left font-body text-cr-cream/40 text-xs uppercase tracking-wider font-semibold">Delivery</th>
              <th class="px-4 py-3 text-left font-body text-cr-cream/40 text-xs uppercase tracking-wider font-semibold">Status</th>
              <th class="px-4 py-3 text-left font-body text-cr-cream/40 text-xs uppercase tracking-wider font-semibold"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`
}

// ── _renderRow(order) ─────────────────────────────────────────────────────────
function _renderRow(order) {
  const statusCfg = _STATUS[order.status] || _STATUS.new
  const manifest  = _findManifest(order)
  const safeId    = _safeId(order.orderId)

  const manifestBlock = manifest?.components
    ? `<div class="mt-3">
         <p class="font-body text-cr-cream/40 text-[10px] uppercase tracking-wider font-semibold mb-2">70/20/10 Kit Manifest</p>
         <div class="grid grid-cols-3 gap-2">
           ${['primary','secondary','stretch'].map(slot => {
             const c = manifest.components[slot]
             if (!c) return ''
             return `<div class="bg-cr-slate rounded-lg p-2.5">
               <p class="font-body text-cr-cream/30 text-[10px] uppercase tracking-wider mb-1">
                 ${slot === 'primary' ? '70%' : slot === 'secondary' ? '20%' : '10%'} · ${_s(slot)}
               </p>
               <p class="font-body text-cr-cream text-xs font-semibold">${_s(c.kitType)}</p>
               ${(c.items||[]).map(i => `<p class="font-body text-cr-cream/45 text-[10px] mt-0.5">${_s(i)}</p>`).join('')}
             </div>`
           }).join('')}
         </div>
         <p class="font-body text-cr-cream/25 text-[10px] mt-2">
           Challenge cards: ${_s(manifest.challengeCardTheme)} &middot;
           Language: ${_s(manifest.language)} &middot;
           ${manifest.isWheelSpinPivot ? '<span class="text-cr-coral">[PIVOT]</span>' : 'Standard'}
         </p>
       </div>`
    : `<p class="font-body text-cr-cream/25 text-xs mt-2">No kit manifest linked to this order.</p>`

  const statusOptions = _STATUSES.map(s =>
    `<option value="${s}" ${order.status === s ? 'selected' : ''}>${_STATUS[s].label}</option>`
  ).join('')

  return `
    <tr id="order-row-${safeId}" data-order-id="${_s(order.orderId)}"
        class="border-b border-cr-slate/30 hover:bg-cr-slate/30 cursor-pointer transition-colors">
      <td class="px-4 py-3 font-body text-cr-cream text-xs font-semibold">${_s(order.orderId)}</td>
      <td class="px-4 py-3 font-body text-cr-cream/55 text-xs">${_fmtDate(order.createdAt)}</td>
      <td class="px-4 py-3">
        <p class="font-body text-cr-cream text-xs font-medium">${_s(order.planName)}</p>
        <p class="font-body text-cr-cream/35 text-[10px]">R${order.priceZAR}/mo &middot; ${_s(order.billingFrequency)}</p>
      </td>
      <td class="px-4 py-3">
        <p class="font-body text-cr-cream text-xs">${order.deliveryChannel === 'pudo' ? 'Pudo Locker' : 'PEP Paxi'}</p>
        <p class="font-body text-cr-cream/35 text-[10px]">${_s(order.deliveryLocation?.name || '—')}</p>
      </td>
      <td class="px-4 py-3">
        <span data-status-badge="${_s(order.orderId)}"
              class="inline-block px-2 py-0.5 rounded-full font-body text-[10px] font-semibold uppercase tracking-wider ${statusCfg.cls}">
          ${statusCfg.label}
        </span>
      </td>
      <td class="px-4 py-3 text-cr-cream/30 text-xs">&#9660;</td>
    </tr>
    <!-- Detail drawer (hidden by default) -->
    <tr id="order-drawer-${safeId}" class="hidden bg-cr-slate/20">
      <td colspan="6" class="px-5 py-4 border-b border-cr-slate/30">
        <div class="flex flex-col gap-3">
          <div class="flex items-start gap-6 flex-wrap">
            <div>
              <p class="font-body text-cr-cream/35 text-[10px] uppercase tracking-wider mb-0.5">Anonymised Profile ID</p>
              <p class="font-body text-cr-cream/70 text-xs font-mono">${_s(order.pseudoUUID)}</p>
              <p class="font-body text-cr-cream/20 text-[10px] mt-0.5">PII isolated in Database A — not visible here</p>
            </div>
            <div>
              <p class="font-body text-cr-cream/35 text-[10px] uppercase tracking-wider mb-0.5">Subscription ID</p>
              <p class="font-body text-cr-cream/70 text-xs font-mono">${_s(order.subscriptionId)}</p>
            </div>
            <div>
              <p class="font-body text-cr-cream/35 text-[10px] uppercase tracking-wider mb-0.5">Advance Status</p>
              <select data-status-select="${_s(order.orderId)}"
                      class="bg-cr-slate border border-cr-charcoal/60 hover:border-cr-sage/40
                             focus:border-cr-sage outline-none rounded-lg px-3 py-1.5
                             font-body text-cr-cream text-xs transition-colors duration-200">
                ${statusOptions}
              </select>
            </div>
          </div>
          ${manifestBlock}
        </div>
      </td>
    </tr>`
}

// =============================================================================
// EXPORTED: init(filter)
// =============================================================================
export function init(filter = 'all') {
  // ── Filter tab clicks ──────────────────────────────────────────────────────
  // Direct re-hydration of #admin-content-mount — same pattern as swapView()
  // without circular import. Avoids importing AdminShell from within admin/.
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const f     = btn.getAttribute('data-filter')
      const mount = document.getElementById('admin-content-mount')
      if (!mount) return
      mount.innerHTML = render(f)
      init(f)
    })
  })

  // ── Row click: toggle detail drawer ──────────────────────────────────────
  document.querySelectorAll('tr[data-order-id]').forEach(row => {
    row.addEventListener('click', () => {
      const orderId = row.getAttribute('data-order-id')
      const safeId  = _safeId(orderId)
      const drawer  = document.getElementById(`order-drawer-${safeId}`)
      if (!drawer) return
      drawer.classList.toggle('hidden')
      // Update chevron indicator
      const chevron = row.querySelector('td:last-child')
      if (chevron) chevron.innerHTML = drawer.classList.contains('hidden') ? '&#9660;' : '&#9650;'
    })
  })

  // ── Status dropdown change: update localStorage ───────────────────────────
  document.querySelectorAll('[data-status-select]').forEach(sel => {
    sel.addEventListener('change', (e) => {
      e.stopPropagation()   // Prevent row click toggling drawer
      const orderId   = sel.getAttribute('data-status-select')
      const newStatus = sel.value
      try {
        const orders = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
        const idx    = orders.findIndex(o => o.orderId === orderId)
        if (idx !== -1) {
          orders[idx].status = newStatus
          localStorage.setItem('cr_sim_orders', JSON.stringify(orders))
        }
      } catch { /* ignore */ }
      // Update badge in parent row
      const badge   = document.querySelector(`[data-status-badge="${_s(orderId)}"]`)
      const cfg     = _STATUS[newStatus] || _STATUS.new
      if (badge) {
        badge.className = `inline-block px-2 py-0.5 rounded-full font-body text-[10px] font-semibold uppercase tracking-wider ${cfg.cls}`
        badge.textContent = cfg.label
      }
      console.log('[CRATE] OrderQueue: status updated —', orderId, '→', newStatus)
    })
  })

  // Prevent drawer close when interacting with select or manifest block
  document.querySelectorAll('tr[id^="order-drawer-"]').forEach(drawer => {
    drawer.addEventListener('click', e => e.stopPropagation())
  })
}
