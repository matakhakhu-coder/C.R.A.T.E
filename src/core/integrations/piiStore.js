// ── src/core/integrations/piiStore.js ─────────────────────────────────────
// PII Store adapter — Database A (parent identity records only).
// POPIA isolation rule: This adapter processes ZERO telemetry fields.
// Never receives pseudoUUID, microSignalScores, or competencyVectors.
// Never cross-references with Database B data in any call.
// Flip FLAGS.piiStoreSimulated to false when Database A connection string
// is confirmed in manifest.js (SA-sovereign hosting required).

import { FLAGS } from '@/core/flags.js'
import { BRAND } from '@/core/manifest.js'

// ── storeParentRecord ─────────────────────────────────────────────────────────
// Creates or updates a parent's PII record in Database A.
// parentData: { parentName, parentEmail, parentPhone, hashedDeliveryAddress,
//               consentLog, otpVerificationRecord }
// Returns: { success, parentRecordId }
export async function storeParentRecord(parentData) {
  if (FLAGS.piiStoreSimulated) {
    console.log('[SIM] piiStore.js — storeParentRecord called')
    console.log('[SIM] piiStore.js — payload field count:', Object.keys(parentData).length)
    console.log('[SIM] piiStore.js — telemetry fields in payload:', _checkForTelemetryFields(parentData))
    await new Promise(r => setTimeout(r, 320))
    return {
      success:        true,
      parentRecordId: `cr-sim-parent-${Date.now()}`,
    }
  }

  const res = await fetch(`${BRAND.integrations.piiStore.connectionString}/parents`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(parentData),
  })
  if (!res.ok) throw new Error(`piiStore.storeParentRecord: ${res.status}`)
  return res.json()
}

// ── updateDeliveryAddress ─────────────────────────────────────────────────────
// Updates a parent's hashed delivery address on their PII record.
// payload: { parentRecordId, hashedDeliveryAddress, deliveryMethod }
// Returns: { success }
export async function updateDeliveryAddress(payload) {
  if (FLAGS.piiStoreSimulated) {
    console.log('[SIM] piiStore.js — updateDeliveryAddress called')
    console.log('[SIM] piiStore.js — deliveryMethod:', payload.deliveryMethod || '[not provided]')
    await new Promise(r => setTimeout(r, 260))
    return { success: true }
  }

  const res = await fetch(
    `${BRAND.integrations.piiStore.connectionString}/parents/${payload.parentRecordId}/address`,
    {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        hashedDeliveryAddress: payload.hashedDeliveryAddress,
        deliveryMethod:        payload.deliveryMethod,
      }),
    },
  )
  if (!res.ok) throw new Error(`piiStore.updateDeliveryAddress: ${res.status}`)
  return res.json()
}

// ── deleteParentRecord ────────────────────────────────────────────────────────
// Purges all PII for a parent on data erasure request (POPIA Section 23 right).
// Called by the one-click deletion engine in the parent dashboard.
// payload: { parentRecordId }
// Returns: { success, deletedAt }
export async function deleteParentRecord(payload) {
  if (FLAGS.piiStoreSimulated) {
    console.log('[SIM] piiStore.js — deleteParentRecord called')
    console.log('[SIM] piiStore.js — parentRecordId present:', !!payload.parentRecordId)
    await new Promise(r => setTimeout(r, 340))
    return {
      success:   true,
      deletedAt: new Date().toISOString(),
    }
  }

  const res = await fetch(
    `${BRAND.integrations.piiStore.connectionString}/parents/${payload.parentRecordId}`,
    {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
    },
  )
  if (!res.ok) throw new Error(`piiStore.deleteParentRecord: ${res.status}`)
  return res.json()
}

// ── Internal guard: detects telemetry fields in a PII payload ─────────────────
function _checkForTelemetryFields(payload) {
  const telemetryKeys = ['pseudoUUID', 'microSignals', 'competencyVectors', 'sessionTimestamps', 'gapMetric']
  const found = telemetryKeys.filter(k => Object.prototype.hasOwnProperty.call(payload, k))
  if (found.length > 0) {
    console.warn('[SIM] piiStore.js — PII ISOLATION WARNING: payload contains telemetry fields:', found)
    console.warn('[SIM] piiStore.js — Telemetry fields must route through telemetry.js only')
  }
  return found.length === 0 ? 'none detected' : `VIOLATION: ${found.join(', ')}`
}
