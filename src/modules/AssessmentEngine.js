// ── src/modules/AssessmentEngine.js ──────────────────────────────────────────
// Phase 4 — Static Bayesian interest-mapping engine.
// Consumes aggregated play session signals from TelemetryCollector and
// updates the child's six-dimension competency profile using the static
// conditional probability tables in src/core/assessmentTables.js.
//
// Architecture:
//   TelemetryCollector calls processTelemetry() after every session.
//   processTelemetry() writes the updated profile to localStorage and
//   dispatches cr:profileUpdated so the parent dashboard (Phase 5) can react.
//
// HPCSA guardrail: No clinical, diagnostic, or psychometric terminology in
// any string, variable name, console log, or comment visible to users.
// All language is growth-framed: "interest area", "play style", "focus level".
//
// POPIA isolation: This module receives pseudoUUID only — never parentName,
// parentEmail, parentPhone, or any Database A (PII) fields.
//
// Phase 2 upgrade path: When mlAssessmentSimulated flag is set to false and
// the profile count exceeds 10,000, the mlAssessment.js adapter supersedes
// this engine. processTelemetry() can be replaced wholesale without changing
// TelemetryCollector or the dashboard.

import { BAYESIAN_ASSESSMENT_MATRIX } from '@/core/assessmentTables.js'

// ── localStorage key for the active child profile ─────────────────────────────
// Keyed by pseudoUUID so multiple child profiles can coexist in storage.
// Also writes to the legacy cr_sim_profile key for Phase 5 dashboard compat.
const _profileKey = (uuid) => `cr_sim_profile_${uuid}`

// =============================================================================
// PUBLIC API
// =============================================================================

// ── processTelemetry(pseudoUUID, sessionSignals, gapMetric) ──────────────────
// Entry point called by TelemetryCollector after every play session.
//
// pseudoUUID:     string — anonymised child identifier, zero PII content.
// sessionSignals: object — { [assessmentKey]: count } from the session buffer.
//                 Keys are canonical micro-signal keys from assessmentTables.js.
// gapMetric:      number — Task Persistence metric computed by TelemetryCollector.
//                 GAP = sessionDuration / retryFrequency, or 0 if no retries.
//
// Returns the full updated profile object.
export function processTelemetry(pseudoUUID, sessionSignals, gapMetric = 0) {
  const matrix = BAYESIAN_ASSESSMENT_MATRIX

  // ── Load existing profile or create a fresh one ────────────────────────────
  const existing    = _loadProfile(pseudoUUID)
  const sessionCount = (existing.sessionCount || 0) + 1

  const updatedDimensions = {}
  const calibrationFlags  = {}
  let hadAnySignals       = false

  // ── Process each of the six activity interest areas ────────────────────────
  for (const [dimKey, dim] of Object.entries(matrix.dimensions)) {
    const existingDim = existing.dimensions?.[dimKey] || null

    // Determine how many of this dimension's primary signals were observed
    const activePrimarySignals = dim.primarySignals.filter(
      s => (sessionSignals[s] || 0) > 0
    ).length

    if (activePrimarySignals > 0) hadAnySignals = true

    // Run the Bayesian posterior update
    const newPosteriors = _computePosterior(dim, existingDim, sessionSignals)

    // Determine the current play style state from the posterior
    const state = _deriveState(newPosteriors, matrix.advancementThresholds)

    // Calibration check: flag if posterior barely moved from prior
    const priorEst = existingDim?.posteriors?.established ?? dim.priors.established
    const delta    = Math.abs(newPosteriors.established - priorEst)
    const needsCal = activePrimarySignals > 0 && delta < matrix.minimumSignalCorrelation

    if (needsCal) calibrationFlags[dimKey] = true

    updatedDimensions[dimKey] = {
      state,
      posteriors:      newPosteriors,
      sessionCount,
      updatedAt:       new Date().toISOString(),
      calibrationFlag: needsCal,
    }

    console.log(
      `[SIM] AssessmentEngine: ${dim.label} — state: ${state}`,
      `| established: ${(newPosteriors.established * 100).toFixed(1)}%`,
      `| developing: ${(newPosteriors.developing * 100).toFixed(1)}%`,
      `| calibration flag: ${needsCal}`,
    )
  }

  // ── Build and persist the updated profile ──────────────────────────────────
  const updatedProfile = {
    pseudoUUID,
    lastUpdated:       new Date().toISOString(),
    sessionCount,
    latestGapMetric:   gapMetric,
    dimensions:        updatedDimensions,
    calibrationFlags,
  }

  _saveProfile(pseudoUUID, updatedProfile)

  // ── Phase 11.5: ZPD scaffolding check ─────────────────────────────────────
  // Runs after the 3rd session to have a meaningful comparison baseline.
  if (sessionCount >= 3) {
    _checkZpdState(pseudoUUID, updatedProfile, existing)
  }

  // ── Wheel-spin detection ───────────────────────────────────────────────────
  // Fires when a child has retried the same challenge without structural
  // variation beyond the threshold defined in assessmentTables.js.
  const retryCount = sessionSignals.retryFrequency || 0
  if (retryCount >= matrix.wheelSpinRetryThreshold) {
    document.dispatchEvent(new CustomEvent('cr:wheelSpinDetected', {
      detail: {
        pseudoUUID,
        retryCount,
        timestamp: new Date().toISOString(),
      },
    }))
    console.log('[SIM] AssessmentEngine: cr:wheelSpinDetected dispatched — retryCount:', retryCount)
  }

  // ── Dispatch profile-updated event ────────────────────────────────────────
  // Phase 5 ParentDashboard listens for this to refresh the trajectory view.
  document.dispatchEvent(new CustomEvent('cr:profileUpdated', {
    detail: {
      pseudoUUID,
      profile: updatedProfile,
    },
  }))

  console.log(
    `[SIM] AssessmentEngine: cr:profileUpdated dispatched — session ${sessionCount}`,
    `| GAP: ${gapMetric.toFixed(2)}s`,
    `| calibration flags: ${Object.keys(calibrationFlags).join(', ') || 'none'}`,
  )

  return updatedProfile
}

// =============================================================================
// BAYESIAN COMPUTATION
// =============================================================================

// ── _computePosterior(dim, existingDim, sessionSignals) ──────────────────────
// Executes the static Bayesian update:
//   P(Ci | E) = P(E | Ci) * P(Ci) / Σj [ P(E | Cj) * P(Cj) ]
//
// Where:
//   Ci = competency state (emerging, developing, established)
//   E  = observed evidence vector (active session signals)
//   P(Ci) = prior probability for state i
//   P(E | Ci) = joint likelihood: Π_s P(signal_s active | Ci) for all active signals
//
// Priors are either the dimension's factory defaults (first session) or the
// previous session's posterior (Bayesian updating across sessions).
function _computePosterior(dim, existingDim, sessionSignals) {
  // Use the existing posterior as prior if available; otherwise factory defaults
  const priorE   = existingDim?.posteriors?.emerging    ?? dim.priors.emerging
  const priorD   = existingDim?.posteriors?.developing  ?? dim.priors.developing
  const priorEst = existingDim?.posteriors?.established ?? dim.priors.established

  let unnormE   = priorE
  let unnormD   = priorD
  let unnormEst = priorEst

  // Multiply by the likelihood of each observed (active) signal
  for (const [signalKey, weights] of Object.entries(dim.signalWeights)) {
    const observed = (sessionSignals[signalKey] || 0) > 0
    if (!observed) continue

    // P(signal active | state) — direct lookup from the weight table
    unnormE   *= weights.emerging
    unnormD   *= weights.developing
    unnormEst *= weights.established
  }

  // Normalise so posteriors sum exactly to 1.0
  const total = unnormE + unnormD + unnormEst

  if (total === 0) {
    // Edge case: all likelihoods collapsed to zero — fall back to priors
    return { emerging: priorE, developing: priorD, established: priorEst }
  }

  return {
    emerging:    +(unnormE   / total).toFixed(4),
    developing:  +(unnormD   / total).toFixed(4),
    established: +(unnormEst / total).toFixed(4),
  }
}

// ── _deriveState(posteriors, thresholds) ─────────────────────────────────────
// Translates posterior probability vectors into a discrete play style state
// using the advancement thresholds from assessmentTables.js.
// State labels are growth-framed — never shown as raw values to parents.
function _deriveState(posteriors, thresholds) {
  if (posteriors.established >= thresholds.developingToEstablished) return 'established'
  if (posteriors.developing  >= thresholds.emergingToDeveloping)    return 'developing'
  return 'emerging'
}

// =============================================================================
// PROFILE PERSISTENCE
// =============================================================================

// ── _loadProfile(pseudoUUID) ─────────────────────────────────────────────────
// Reads the child's profile from localStorage. Returns an empty scaffold
// if no prior sessions exist. Never reads PII-keyed storage.
function _loadProfile(pseudoUUID) {
  try {
    const raw = localStorage.getItem(_profileKey(pseudoUUID))
    if (raw) return JSON.parse(raw)
  } catch { /* corrupted storage — start fresh */ }
  return { pseudoUUID, sessionCount: 0, dimensions: {} }
}

// ── _saveProfile(pseudoUUID, profile) ────────────────────────────────────────
// Persists the updated profile to two localStorage keys:
//   cr_sim_profile_{uuid}  — pseudoUUID-keyed (canonical, multi-child safe)
//   cr_sim_profile         — legacy key read by Phase 5 dashboard
// POPIA: profile contains zero PII fields.
function _saveProfile(pseudoUUID, profile) {
  const json = JSON.stringify(profile)
  localStorage.setItem(_profileKey(pseudoUUID), json)
  // Legacy key for Phase 5 dashboard backward compatibility
  localStorage.setItem('cr_sim_profile', json)
}

// =============================================================================
// PHASE 11.5: ZPD SCAFFOLDING STATE CHECK
// =============================================================================

// ── _checkZpdState(pseudoUUID, current, previous) ────────────────────────────
// Evaluates longitudinal progress across all 6 activity interest areas.
// Dispatches cr:zpdShift to signal the sandbox engine to adjust physics tier.
//
// Mastery milestone: any dimension advances to 'established' this session.
// Learning plateau:  >50% of dimensions show <3% posterior change this session.
//
// HPCSA guardrail: All terminology is play-engagement framed.
//   No clinical, deficit, or milestone terminology used anywhere here.
function _checkZpdState(pseudoUUID, current, previous) {
  if (!previous?.dimensions || !current?.dimensions) return

  let plateauCount   = 0
  let milestoneCount = 0
  const dimCount     = Object.keys(current.dimensions).length

  for (const dimKey of Object.keys(current.dimensions)) {
    const curDim  = current.dimensions[dimKey]
    const prevDim = previous.dimensions?.[dimKey]

    // Mastery milestone: state advanced to established this session
    if (curDim?.state === 'established' && prevDim?.state !== 'established') {
      milestoneCount++
    }

    // Plateau: established posterior delta < 3% between sessions
    const curEst  = curDim?.posteriors?.established  ?? 0
    const prevEst = prevDim?.posteriors?.established ?? 0
    if (Math.abs(curEst - prevEst) < 0.03) plateauCount++
  }

  const plateauRatio = dimCount > 0 ? plateauCount / dimCount : 0

  if (milestoneCount > 0) {
    document.dispatchEvent(new CustomEvent('cr:zpdShift', {
      detail: {
        direction:      'challenge',
        reason:         'mastery',
        milestoneCount,
        pseudoUUID,
      },
    }))
    console.log('[SIM] AssessmentEngine: cr:zpdShift — direction: challenge, milestones:', milestoneCount)

  } else if (plateauRatio > 0.5) {
    document.dispatchEvent(new CustomEvent('cr:zpdShift', {
      detail: {
        direction:    'soften',
        reason:       'plateau',
        plateauRatio,
        pseudoUUID,
      },
    }))
    console.log('[SIM] AssessmentEngine: cr:zpdShift — direction: soften, plateau ratio:', plateauRatio.toFixed(2))
  }
}
