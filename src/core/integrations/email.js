// ── src/core/integrations/email.js ────────────────────────────────────────
// Transactional email adapter.
// Handles registration confirmation, consent receipts, crate dispatch notifications.
// Flip FLAGS.emailSimulated to false when email provider API key and
// domain-linked sender address are confirmed in manifest.js.

import { FLAGS } from '@/core/flags.js'
import { BRAND } from '@/core/manifest.js'

// ── sendEmail ─────────────────────────────────────────────────────────────────
// Dispatches a transactional email.
// emailPayload: { to, templateId, templateData, subject }
// Returns: { success, messageId }
export async function sendEmail(emailPayload) {
  if (FLAGS.emailSimulated) {
    console.log('[SIM] email.js — sendEmail called')
    console.log('[SIM] email.js — templateId:', emailPayload.templateId || '[not provided]')
    console.log('[SIM] email.js — subject:', emailPayload.subject || '[not provided]')
    // Do not log 'to' address — PII
    console.log('[SIM] email.js — recipient present:', !!emailPayload.to)
    await new Promise(r => setTimeout(r, 290))
    return {
      success:   true,
      messageId: `cr-sim-msg-${Date.now()}`,
    }
  }

  const res = await fetch(`${BRAND.integrations.email.endpoint}/send`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${BRAND.integrations.email.apiKey}`,
    },
    body: JSON.stringify({
      ...emailPayload,
      from: BRAND.integrations.email.fromAddress,
    }),
  })
  if (!res.ok) throw new Error(`email.sendEmail: ${res.status}`)
  return res.json()
}
