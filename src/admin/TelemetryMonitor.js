// ── src/admin/TelemetryMonitor.js ─────────────────────────────────────────────
// Phase 8 — System telemetry health monitor.
// Displays: child interest profile count, integration flag status register,
// wheel-spin event stream, and calibration integrity alerts.
//
// Isolation: Never imported by src/modules/ or src/components/.
// HPCSA: Internal monitoring uses operations language only —
//   "interest tracking snapshots", "play trajectory streams", "growth indicators".
//   No clinical, diagnostic, or deficit terminology.

import { FLAGS }                    from '@/core/flags.js'
import { BAYESIAN_ASSESSMENT_MATRIX } from '@/core/assessmentTables.js'

// ── Wheel-spin event log — persisted in localStorage across admin view swaps ──
// cr_admin_wheel_spin_log: [{ retryCount, timestamp }] (max 20 entries, LIFO)
const _WHEEL_LOG_KEY  = 'cr_admin_wheel_spin_log'
let   _wheelSpinLog   = []     // in-memory mirror for live DOM updates
let   _wsListenerBound = false

// ── _loadWheelLog() — reads persisted log (called by render and init) ─────────
function _loadWheelLog() {
  try { return JSON.parse(localStorage.getItem(_WHEEL_LOG_KEY) || '[]') }
  catch { return [] }
}

// ── _saveWheelLog(log) — commits log to localStorage ─────────────────────────
function _saveWheelLog(log) {
  try { localStorage.setItem(_WHEEL_LOG_KEY, JSON.stringify(log)) }
  catch { /* storage full — silently continue */ }
}

// ── Load all child profiles from localStorage ──────────────────────────────────
function _loadProfiles() {
  const profiles = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('cr_sim_profile_')) {
        try { profiles.push(JSON.parse(localStorage.getItem(key))) }
        catch { /* skip malformed */ }
      }
    }
  } catch { /* ignore */ }
  return profiles
}

// ── Check calibration flags across all loaded profiles ─────────────────────────
function _getCalibrationAlerts(profiles) {
  const alerts = []
  const threshold = BAYESIAN_ASSESSMENT_MATRIX.minimumSignalCorrelation   // 0.15
  for (const profile of profiles) {
    if (!profile?.calibrationFlags) continue
    for (const [dim, flagged] of Object.entries(profile.calibrationFlags)) {
      if (flagged) {
        const dimLabel = BAYESIAN_ASSESSMENT_MATRIX.dimensions[dim]?.label || dim
        alerts.push({ uuid: profile.pseudoUUID, dimension: dimLabel, threshold })
      }
    }
  }
  return alerts
}

// =============================================================================
// EXPORTED: render()
// =============================================================================
export function render() {
  const profiles   = _loadProfiles()
  const calAlerts  = _getCalibrationAlerts(profiles)
  const totalSess  = (() => {
    let count = 0
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('cr_sim_sessions_')) {
          const arr = JSON.parse(localStorage.getItem(key) || '[]')
          count += arr.length
        }
      }
    } catch { /* ignore */ }
    return count
  })()

  // ── Section 1: Profile + session counters ───────────────────────────────
  const statsRow = `
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
      ${[
        { label: 'Interest Profiles', value: profiles.length, color: 'text-cr-sage' },
        { label: 'Play Sessions Logged', value: totalSess, color: 'text-cr-coral' },
        { label: 'Calibration Alerts',   value: calAlerts.length, color: calAlerts.length > 0 ? 'text-cr-coral font-bold' : 'text-cr-sage' },
      ].map(s => `
        <div class="bg-cr-charcoal rounded-xl border border-cr-charcoal/60 p-4">
          <p class="font-body text-cr-cream/40 text-[10px] uppercase tracking-wider mb-1">${s.label}</p>
          <p class="font-heading ${s.color} text-3xl font-extrabold">${s.value}</p>
        </div>`).join('')}
    </div>`

  // ── Section 2: Integration flag register ────────────────────────────────
  const flagRows = Object.entries(FLAGS).map(([key, val]) => `
    <tr class="border-b border-cr-slate/30">
      <td class="px-4 py-2.5 font-body text-cr-cream/70 text-xs font-mono">${key}</td>
      <td class="px-4 py-2.5">
        <span class="inline-block px-2 py-0.5 rounded-full font-body text-[10px] font-semibold uppercase tracking-wider
                     ${val ? 'bg-cr-coral/15 text-cr-coral' : 'bg-cr-sage/15 text-cr-sage'}">
          ${val ? 'Simulated' : 'Live'}
        </span>
      </td>
      <td class="px-4 py-2.5 font-body text-cr-cream/25 text-[10px]">
        ${val ? 'Credential pending — flip to false when confirmed' : 'Live integration active'}
      </td>
    </tr>`).join('')

  const flagTable = `
    <div class="bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 overflow-hidden mb-6">
      <div class="px-5 py-3 border-b border-cr-slate/50">
        <h3 class="font-heading text-cr-cream text-sm font-bold">Integration Channel Register</h3>
        <p class="font-body text-cr-cream/30 text-xs mt-0.5">
          ${Object.values(FLAGS).filter(v => v).length} of ${Object.keys(FLAGS).length} channels simulated
        </p>
      </div>
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-cr-slate/30">
            <th class="px-4 py-2 text-left font-body text-cr-cream/30 text-[10px] uppercase tracking-wider font-semibold">Flag Key</th>
            <th class="px-4 py-2 text-left font-body text-cr-cream/30 text-[10px] uppercase tracking-wider font-semibold">Status</th>
            <th class="px-4 py-2 text-left font-body text-cr-cream/30 text-[10px] uppercase tracking-wider font-semibold">Note</th>
          </tr>
        </thead>
        <tbody>${flagRows}</tbody>
      </table>
    </div>`

  // ── Section 3: Wheel-spin event stream ──────────────────────────────────
  // Read from localStorage so history persists across view swaps and admin reopens.
  const _persistedLog = _loadWheelLog()
  const wsRows = _persistedLog.length === 0
    ? `<p class="font-body text-cr-cream/25 text-xs px-5 py-4">
         No playground friction loops detected. Monitor updates in real time.
       </p>`
    : _persistedLog.map(e => `
        <div class="border-b border-cr-slate/30 last:border-b-0 px-5 py-3 flex items-center gap-3">
          <span class="text-cr-coral text-xs">&#9650;</span>
          <div>
            <p class="font-body text-cr-cream/70 text-xs">
              Playground friction loop detected &middot; retry count: <strong>${e.retryCount}</strong>
            </p>
            <p class="font-body text-cr-cream/25 text-[10px]">${e.timestamp}</p>
          </div>
        </div>`).join('')

  const wsBlock = `
    <div class="bg-cr-charcoal rounded-2xl border border-cr-charcoal/60 overflow-hidden mb-6">
      <div class="px-5 py-3 border-b border-cr-slate/50 flex items-center justify-between">
        <h3 class="font-heading text-cr-cream text-sm font-bold">
          Play Friction Loop Stream
        </h3>
        <span class="inline-block w-2 h-2 rounded-full bg-cr-sage animate-pulse"></span>
      </div>
      <div id="cr-telemetry-wheel-log">${wsRows}</div>
    </div>`

  // ── Section 4: Calibration integrity ────────────────────────────────────
  const calBlock = calAlerts.length === 0
    ? `<div class="bg-cr-charcoal rounded-2xl border border-cr-sage/20 p-5 mb-6">
         <div class="flex items-center gap-2 mb-1">
           <span class="text-cr-sage">&#10003;</span>
           <h3 class="font-heading text-cr-cream text-sm font-bold">Calibration Integrity</h3>
         </div>
         <p class="font-body text-cr-cream/45 text-xs">
           All tracked interest dimensions are operating above the minimum signal correlation threshold
           (${BAYESIAN_ASSESSMENT_MATRIX.minimumSignalCorrelation}). No recalibration required.
         </p>
       </div>`
    : `<div class="bg-cr-charcoal rounded-2xl border border-cr-coral/40 p-5 mb-6">
         <div class="flex items-center gap-2 mb-3">
           <span class="text-cr-coral text-lg">&#9650;</span>
           <h3 class="font-heading text-cr-coral text-sm font-bold">
             Calibration Alert — ${calAlerts.length} Dimension${calAlerts.length !== 1 ? 's' : ''} Below Threshold
           </h3>
         </div>
         <p class="font-body text-cr-cream/55 text-xs mb-3 leading-relaxed">
           The following interest tracking dimensions have signal correlation below the minimum
           threshold of ${BAYESIAN_ASSESSMENT_MATRIX.minimumSignalCorrelation}.
           Immediate recalibration loop recommended:
           expand Task Model choices, replace weak behavioral markers, and re-run the
           posterior calculation against updated pilot session data.
         </p>
         <div class="flex flex-col gap-2">
           ${calAlerts.map(a => `
             <div class="bg-cr-coral/10 rounded-lg px-4 py-2.5 flex items-center gap-3">
               <span class="text-cr-coral text-xs flex-shrink-0">&#9642;</span>
               <div>
                 <p class="font-body text-cr-cream text-xs font-semibold">${a.dimension}</p>
                 <p class="font-body text-cr-cream/35 text-[10px]">
                   Profile: <span class="font-mono">${a.uuid}</span> &middot;
                   Below ${a.threshold} correlation floor
                 </p>
               </div>
             </div>`).join('')}
         </div>
       </div>`

  return `
    <div>
      <h2 class="font-heading text-cr-cream text-lg font-bold mb-5">System Telemetry Health</h2>
      ${statsRow}
      ${flagTable}
      ${wsBlock}
      ${calBlock}
    </div>`
}

// =============================================================================
// EXPORTED: init()
// =============================================================================
export function init() {
  // Hydrate in-memory log from localStorage on every admin view open.
  // This ensures events captured while admin was closed are visible immediately.
  _wheelSpinLog = _loadWheelLog()

  // ── Bind cr:wheelSpinDetected listener (idempotent) ───────────────────────
  if (!_wsListenerBound) {
    _wsListenerBound = true
    document.addEventListener('cr:wheelSpinDetected', (e) => {
      const { retryCount } = e.detail || {}
      const entry = {
        retryCount: retryCount || '?',
        timestamp:  new Date().toLocaleTimeString('en-ZA'),
      }

      // ── Persist to localStorage so log survives view swaps ────────────────
      const log = _loadWheelLog()
      log.unshift(entry)
      if (log.length > 20) log.length = 20
      _saveWheelLog(log)

      // ── Mirror in memory for live DOM update ──────────────────────────────
      _wheelSpinLog = log

      // ── Live-update the DOM if the wheel-spin panel is currently visible ──
      const logEl = document.getElementById('cr-telemetry-wheel-log')
      if (logEl) {
        logEl.innerHTML = _wheelSpinLog.map(ev => `
          <div class="border-b border-cr-slate/30 last:border-b-0 px-5 py-3 flex items-center gap-3">
            <span class="text-cr-coral text-xs">&#9650;</span>
            <div>
              <p class="font-body text-cr-cream/70 text-xs">
                Playground friction loop detected &middot; retry count: <strong>${ev.retryCount}</strong>
              </p>
              <p class="font-body text-cr-cream/25 text-[10px]">${ev.timestamp}</p>
            </div>
          </div>`).join('')
      }
    })
  }
}
