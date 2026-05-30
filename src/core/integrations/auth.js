// ── src/core/integrations/auth.js ──────────────────────────────────────────
// Parent authentication adapter.
// Handles account creation, login, and session token management.
// Flip FLAGS.authSimulated to false when SA-sovereign auth provider credentials
// are confirmed in manifest.js.

import { FLAGS } from '@/core/flags.js'
import { BRAND } from '@/core/manifest.js'

// ── registerParent ────────────────────────────────────────────────────────────
// Creates a new parent account and returns a session token.
// payload: { email, hashedPassword, phoneNumber }
// Returns: { success, sessionToken, parentRecordId }
export async function registerParent(payload) {
  if (FLAGS.authSimulated) {
    console.log('[SIM] auth.js — registerParent called')
    console.log('[SIM] auth.js — payload field count:', Object.keys(payload).length)
    await new Promise(r => setTimeout(r, 420))
    return {
      success:        true,
      sessionToken:   `cr-sim-token-${Date.now()}`,
      parentRecordId: `cr-sim-parent-${Date.now()}`,
    }
  }

  const res = await fetch(`${BRAND.integrations.auth.endpoint}/register`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${BRAND.integrations.auth.apiKey}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`auth.registerParent: ${res.status}`)
  return res.json()
}

// ── loginParent ───────────────────────────────────────────────────────────────
// Authenticates an existing parent and returns a refreshed session token.
// payload: { email, hashedPassword }
// Returns: { success, sessionToken, parentRecordId }
export async function loginParent(payload) {
  if (FLAGS.authSimulated) {
    console.log('[SIM] auth.js — loginParent called')
    console.log('[SIM] auth.js — payload field count:', Object.keys(payload).length)
    await new Promise(r => setTimeout(r, 380))
    return {
      success:        true,
      sessionToken:   `cr-sim-token-${Date.now()}`,
      parentRecordId: `cr-sim-parent-${Date.now()}`,
    }
  }

  const res = await fetch(`${BRAND.integrations.auth.endpoint}/login`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${BRAND.integrations.auth.apiKey}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`auth.loginParent: ${res.status}`)
  return res.json()
}

// ── verifySession ─────────────────────────────────────────────────────────────
// Validates a session token. Used on page load to restore authenticated state.
// payload: { sessionToken }
// Returns: { valid, parentRecordId }
export async function verifySession(payload) {
  if (FLAGS.authSimulated) {
    console.log('[SIM] auth.js — verifySession called')
    await new Promise(r => setTimeout(r, 220))
    return {
      valid:          true,
      parentRecordId: `cr-sim-parent-${Date.now()}`,
    }
  }

  const res = await fetch(`${BRAND.integrations.auth.endpoint}/verify`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${BRAND.integrations.auth.apiKey}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`auth.verifySession: ${res.status}`)
  return res.json()
}
