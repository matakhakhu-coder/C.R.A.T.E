// ── src/core/integrations/otp.js ──────────────────────────────────────────
// OTP / SMS consent verification adapter.
// Used during POPIA consent flow to verify parent identity via mobile number.
// In SIM mode, code "000000" always passes. Real SMS is never sent.
// Flip FLAGS.otpSimulated to false when SA mobile number pool and SMS
// provider API key are confirmed in manifest.js.

import { FLAGS } from '@/core/flags.js'
import { BRAND } from '@/core/manifest.js'

// Sim mode auto-pass code — documented, never hardcoded in UI
const SIM_OTP_CODE = '000000'

// ── sendOTP ───────────────────────────────────────────────────────────────────
// Dispatches an OTP to a parent's phone number for consent verification.
// payload: { phoneNumber, consentSessionId }
// Returns: { success, sentAt, expiresAt }
export async function sendOTP(payload) {
  if (FLAGS.otpSimulated) {
    console.log('[SIM] otp.js — sendOTP called')
    console.log(`[SIM] otp.js — code "${SIM_OTP_CODE}" auto-passes in simulation mode`)
    console.log('[SIM] otp.js — no real SMS sent, no real number accessed')
    await new Promise(r => setTimeout(r, 450))
    return {
      success:   true,
      sentAt:    new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),   // 10-minute window
    }
  }

  const res = await fetch(`${BRAND.integrations.otp.endpoint}/send`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${BRAND.integrations.otp.apiKey}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`otp.sendOTP: ${res.status}`)
  return res.json()
}

// ── verifyOTP ─────────────────────────────────────────────────────────────────
// Verifies a parent-entered OTP code against the sent code.
// payload: { phoneNumber, code, consentSessionId }
// Returns: { success, verified, verifiedAt }
export async function verifyOTP(payload) {
  if (FLAGS.otpSimulated) {
    console.log('[SIM] otp.js — verifyOTP called')
    const codeMatch = payload.code === SIM_OTP_CODE
    console.log(`[SIM] otp.js — code match: ${codeMatch} (sim accepts "${SIM_OTP_CODE}" only)`)
    await new Promise(r => setTimeout(r, 240))
    return {
      success:    true,
      verified:   codeMatch,
      verifiedAt: codeMatch ? new Date().toISOString() : null,
    }
  }

  const res = await fetch(`${BRAND.integrations.otp.endpoint}/verify`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${BRAND.integrations.otp.apiKey}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`otp.verifyOTP: ${res.status}`)
  return res.json()
}
