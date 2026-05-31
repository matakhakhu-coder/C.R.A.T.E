// ── src/core/integrations/telemetry.js ────────────────────────────────────
// Telemetry Engine adapter — Database B (behavioral signals only).
// POPIA isolation rule: This adapter processes ZERO PII fields.
// All records use pseudoUUID only. Never receives parentName, email, phone, or address.
// Flip FLAGS.telemetrySimulated to false when Database B connection string
// is confirmed in manifest.js (SA-sovereign hosting required).

import { FLAGS } from '@/core/flags.js'
import { BRAND } from '@/core/manifest.js'

// ── uploadSessionData ─────────────────────────────────────────────────────────
// Uploads a completed play session's micro-signal record to Database B.
// sessionRecord: { pseudoUUID, sessionId, timestamp, microSignals, gapMetric,
//                  competencyVectors, sessionDuration, levelCount }
// Returns: { success, sessionRecordId }
export async function uploadSessionData(sessionRecord) {
  if (FLAGS.telemetrySimulated) {
    console.log('[SIM] telemetry.js — uploadSessionData called')
    console.log('[SIM] telemetry.js — pseudoUUID present:', !!sessionRecord.pseudoUUID)
    console.log('[SIM] telemetry.js — signal count:', Object.keys(sessionRecord.microSignals || {}).length)
    console.log('[SIM] telemetry.js — PII fields in payload:', _checkForPIIFields(sessionRecord))
    await new Promise(r => setTimeout(r, 280))

    // Persist to localStorage in SIM mode
    const sessions = JSON.parse(localStorage.getItem('cr_sim_sessions') || '[]')
    const record = { ...sessionRecord, _uploadedAt: new Date().toISOString() }
    sessions.unshift(record)
    localStorage.setItem('cr_sim_sessions', JSON.stringify(sessions))

    return {
      success:         true,
      sessionRecordId: `cr-sim-sr-${Date.now()}`,
    }
  }

  // Phase 11.5: if a binary packet is present, route via octet-stream endpoint
  // for maximum bandwidth efficiency. Falls back to JSON if buffer is absent.
  if (sessionRecord.compressedBuffer instanceof ArrayBuffer &&
      sessionRecord.compressedBuffer.byteLength > 0) {
    const res = await fetch(`${BRAND.integrations.telemetry.connectionString}/sessions/binary`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Session-UUID':    sessionRecord.pseudoUUID || '',
        'X-Session-ID':      sessionRecord.sessionId  || '',
      },
      body: sessionRecord.compressedBuffer,
    })
    if (!res.ok) throw new Error(`telemetry.uploadSessionData (binary): ${res.status}`)
    return res.json()
  }

  // JSON fallback path
  const res = await fetch(`${BRAND.integrations.telemetry.connectionString}/sessions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(sessionRecord),
  })
  if (!res.ok) throw new Error(`telemetry.uploadSessionData: ${res.status}`)
  return res.json()
}

// ── updateCompetencyProfile ───────────────────────────────────────────────────
// Updates the stored competency vector for a pseudoUUID after AssessmentEngine runs.
// profileUpdate: { pseudoUUID, dimensionKey, newState, posteriorProbability, sessionCount }
// Returns: { success }
export async function updateCompetencyProfile(profileUpdate) {
  if (FLAGS.telemetrySimulated) {
    console.log('[SIM] telemetry.js — updateCompetencyProfile called')
    console.log('[SIM] telemetry.js — pseudoUUID present:', !!profileUpdate.pseudoUUID)
    console.log('[SIM] telemetry.js — dimension:', profileUpdate.dimensionKey || '[not provided]')
    await new Promise(r => setTimeout(r, 240))

    // Persist to localStorage in SIM mode
    const existing = JSON.parse(localStorage.getItem('cr_sim_profile') || '{}')
    existing.dimensions = existing.dimensions || {}
    existing.dimensions[profileUpdate.dimensionKey] = {
      state:               profileUpdate.newState,
      posteriorProbability: profileUpdate.posteriorProbability,
      updatedAt:           new Date().toISOString(),
      sessionCount:        profileUpdate.sessionCount,
    }
    existing.pseudoUUID = profileUpdate.pseudoUUID
    existing.lastUpdated = new Date().toISOString()
    localStorage.setItem('cr_sim_profile', JSON.stringify(existing))

    return { success: true }
  }

  const res = await fetch(`${BRAND.integrations.telemetry.connectionString}/profiles`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(profileUpdate),
  })
  if (!res.ok) throw new Error(`telemetry.updateCompetencyProfile: ${res.status}`)
  return res.json()
}

// ── Internal guard: detects PII fields in a payload (SIM mode safety check) ──
function _checkForPIIFields(payload) {
  const piiKeys = ['parentName', 'parentEmail', 'email', 'phone', 'address', 'name']
  const found = piiKeys.filter(k => Object.prototype.hasOwnProperty.call(payload, k))
  if (found.length > 0) {
    console.warn('[SIM] telemetry.js — PII ISOLATION WARNING: payload contains PII fields:', found)
    console.warn('[SIM] telemetry.js — PII fields must route through piiStore.js only')
  }
  return found.length === 0 ? 'none detected' : `VIOLATION: ${found.join(', ')}`
}
