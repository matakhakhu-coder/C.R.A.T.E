// ── src/core/integrations/tokenMap.js ─────────────────────────────────────
// Secure token mapping layer.
// The ONLY module that ever holds the pseudoUUID ↔ parentRecordId mapping.
//
// ABSOLUTE CONSTRAINTS (architectural, not stylistic):
//   1. Never imported into customer-facing render paths (main.js customer route).
//   2. Never logs the mapping table — not even a single pair — in any mode.
//   3. The [SIM] log confirms the operation occurred but reveals ZERO IDs.
//   4. No other module in the codebase may hold or log this mapping.
//
// Flip FLAGS.tokenMapSimulated to false when both Database A and Database B
// connection strings are confirmed and a secure key management service is
// available to store the mapping table off the client device.

import { FLAGS } from '@/core/flags.js'

// ── createTokenMapping ────────────────────────────────────────────────────────
// Registers a new pseudoUUID ↔ parentRecordId pair in the secure mapping store.
// pseudoUUID: string — generated locally on the client at child profile creation.
// parentRecordId: string — returned by piiStore.storeParentRecord().
// Returns: { success, mappingId }
export async function createTokenMapping(pseudoUUID, parentRecordId) {
  if (FLAGS.tokenMapSimulated) {
    // Intentionally never logs pseudoUUID or parentRecordId — policy requirement.
    console.log('[SIM] tokenMap.js — createTokenMapping: mapping registered (contents not logged by policy)')
    await new Promise(r => setTimeout(r, 220))
    return {
      success:   true,
      mappingId: `cr-sim-map-${Date.now()}`,
    }
  }

  // Live path: POST to secure key management service — never to Database A or B directly.
  // Implementation wired in Phase 2 when both DBs are confirmed.
  throw new Error('tokenMap.createTokenMapping: live path not yet configured — see Phase 2')
}

// ── resolvePseudoUUID ─────────────────────────────────────────────────────────
// Looks up the parentRecordId for a given pseudoUUID. Used only in the admin
// layer for erasure requests — never called from customer render paths.
// pseudoUUID: string
// Returns: { success, parentRecordId }
export async function resolvePseudoUUID(pseudoUUID) {
  if (FLAGS.tokenMapSimulated) {
    // Intentionally never logs pseudoUUID — policy requirement.
    console.log('[SIM] tokenMap.js — resolvePseudoUUID: lookup performed (result not logged by policy)')
    await new Promise(r => setTimeout(r, 200))
    return {
      success:        true,
      parentRecordId: `cr-sim-parent-resolved-${Date.now()}`,
    }
  }

  throw new Error('tokenMap.resolvePseudoUUID: live path not yet configured — see Phase 2')
}
