// ── src/modules/TelemetryCollector.js ────────────────────────────────────────
// Phase 4 — Session telemetry aggregation layer.
// Listens for cr:sessionEnd events dispatched by the sandbox, computes the
// GAP persistence metric, persists the raw session record, uploads to the
// telemetry adapter (Database B simulation), and forwards to AssessmentEngine.
//
// Architecture:
//   Sandbox (_flushSandboxSession in main.js) dispatches cr:sessionEnd.
//   TelemetryCollector.init() binds the listener once at application load.
//   The event detail carries { pseudoUUID, signals, sessionMs, bodyCount, sessionId }.
//
// Call sequence per session:
//   cr:sessionEnd fired
//     → _onSessionEnd()
//       → _computeGAP()             compute Task Persistence metric
//       → localStorage write         append to session history (synchronous, safe on unload)
//       → uploadSessionData()        route to Database B [SIM]
//       → AssessmentEngine.processTelemetry()   run Bayesian update
//
// HPCSA guardrail: No clinical or diagnostic language in any string, variable,
// console log, or comment. Use "interest signals", "play session", "focus metric".
//
// POPIA isolation: Only pseudoUUID crosses this module. No PII fields from
// Database A (parentName, parentEmail, parentPhone) are ever referenced.

import { processTelemetry }  from '@/modules/AssessmentEngine.js'
import { uploadSessionData } from '@/core/integrations/telemetry.js'

// ── localStorage key for the session history log ──────────────────────────────
// Separate per-child history keyed by pseudoUUID.
// cr_sim_sessions (no suffix) is kept as the legacy key for Phase 8 admin view.
const _sessionsKey = (uuid) => `cr_sim_sessions_${uuid}`

// ── State: prevent duplicate listener registration ────────────────────────────
let _initialized = false

// =============================================================================
// PUBLIC API
// =============================================================================

// ── init() ───────────────────────────────────────────────────────────────────
// Binds the cr:sessionEnd listener on document.
// Must be called once at application startup (main.js module level).
// Safe to call multiple times — guard prevents duplicate binding.
export function init() {
  if (_initialized) return
  _initialized = true
  document.addEventListener('cr:sessionEnd', _onSessionEnd)
  console.log('[SIM] TelemetryCollector: initialized — listening for cr:sessionEnd')
}

// =============================================================================
// PRIVATE HANDLERS
// =============================================================================

// ── _onSessionEnd(event) ─────────────────────────────────────────────────────
// Receives the cr:sessionEnd CustomEvent from the sandbox.
//
// event.detail shape:
//   { pseudoUUID, signals, sessionMs, bodyCount, sessionId }
//
// pseudoUUID: anonymised child identifier — zero PII content.
// signals:    { [assessmentKey]: count } — canonical micro-signal counts.
// sessionMs:  number — session duration in milliseconds.
// bodyCount:  number — physics bodies present at session end.
// sessionId:  string — unique session identifier.
async function _onSessionEnd(event) {
  const { pseudoUUID, signals, sessionMs, bodyCount, sessionId } = event.detail || {}

  // Guard: require a valid pseudoUUID — never process without anonymous token
  if (!pseudoUUID || !signals) {
    console.warn('[SIM] TelemetryCollector: cr:sessionEnd received without required fields — skipped')
    return
  }

  // ── Step 1: Compute GAP persistence metric ────────────────────────────────
  // GAP = (1/Nu) * Σ(k∈U) Tk
  //
  // Where:
  //   U  = set of attempted but unresolved play challenges
  //   Nu = count of unresolved challenges (proxy: retryFrequency — board resets)
  //   Tk = cumulative time on challenge k (proxy: sessionDuration / Nu)
  //
  // If Nu = 0 (no resets occurred), GAP defaults to 0.
  const gapMetric = _computeGAP(signals, sessionMs)

  // ── Step 2: Build the aggregated session payload ──────────────────────────
  const sessionPayload = {
    pseudoUUID,
    sessionId:       sessionId || `cr-sandbox-${Date.now()}`,
    timestamp:       new Date().toISOString(),
    microSignals:    { ...signals },
    gapMetric,
    sessionDuration: (sessionMs || 0) / 1000,
    bodyCount:       bodyCount || 0,
    // POPIA: zero PII fields — pseudoUUID only
  }

  // ── Step 3: Persist to session history in localStorage ───────────────────
  // This write is synchronous — safe to execute even on beforeunload.
  _appendSessionHistory(pseudoUUID, sessionPayload)

  // ── Step 4: Upload to Database B via telemetry adapter ───────────────────
  // [SIM] path stores to cr_sim_sessions in localStorage and logs to console.
  // Live path will route to SA-sovereign Database B when flag is flipped.
  try {
    await uploadSessionData(sessionPayload)
  } catch (err) {
    console.warn('[SIM] TelemetryCollector: uploadSessionData failed silently:', err?.message)
  }

  // ── Step 5: Forward to AssessmentEngine for Bayesian profile update ───────
  // AssessmentEngine reads assessmentTables.js, updates posteriors, writes
  // cr_sim_profile, and dispatches cr:profileUpdated.
  processTelemetry(pseudoUUID, signals, gapMetric)

  console.log(
    `[SIM] TelemetryCollector: session collected — sessionId: ${sessionPayload.sessionId}`,
    `| GAP metric: ${gapMetric.toFixed(2)}s`,
    `| signal keys: ${Object.keys(signals).join(', ')}`,
    `| signals with activity: ${Object.values(signals).filter(v => v > 0).length}`,
  )
}

// =============================================================================
// GAP METRIC COMPUTATION
// =============================================================================

// ── _computeGAP(signals, sessionMs) ──────────────────────────────────────────
// Implements: GAP = (1/Nu) * Σ(k∈U) Tk
//
// In the free-play sandbox context:
//   Nu = retryFrequency count (number of times the board was cleared or reset)
//   Tk = sessionDuration / Nu (uniform approximation — each retry consumed equal time)
//
// When Nu = 0 (the child played continuously without resets), GAP = 0.
// A higher GAP score indicates greater time investment per unresolved attempt —
// a marker of productive persistence rather than impulsive retrying.
function _computeGAP(signals, sessionMs) {
  const Nu = signals.retryFrequency || 0
  if (Nu === 0) return 0
  const sessionSecs = (sessionMs || 0) / 1000
  const Tk          = sessionSecs / Nu          // average time per retry attempt
  const gap         = (1 / Nu) * (Nu * Tk)      // GAP = sessionSecs / Nu
  return +gap.toFixed(3)
}

// =============================================================================
// SESSION HISTORY PERSISTENCE
// =============================================================================

// ── _appendSessionHistory(pseudoUUID, payload) ────────────────────────────────
// Prepends the new session to the child's persistent history array in localStorage.
// Keeps the 50 most recent sessions to prevent unbounded storage growth.
// POPIA: payload contains only pseudoUUID and play interaction data.
function _appendSessionHistory(pseudoUUID, payload) {
  try {
    const key     = _sessionsKey(pseudoUUID)
    const history = JSON.parse(localStorage.getItem(key) || '[]')
    history.unshift(payload)
    if (history.length > 50) history.length = 50   // rolling window cap
    localStorage.setItem(key, JSON.stringify(history))
    // Legacy key (no UUID suffix) for Phase 8 admin panel backward compatibility
    localStorage.setItem('cr_sim_sessions', JSON.stringify(history))
  } catch (err) {
    console.warn('[SIM] TelemetryCollector: session history write failed:', err?.message)
  }
}
