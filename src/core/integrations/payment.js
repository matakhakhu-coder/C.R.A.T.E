// ── src/core/integrations/payment.js ──────────────────────────────────────
// Subscription payment adapter.
// Handles subscription creation and recurring billing.
// Flip FLAGS.paymentSimulated to false when payment gateway credentials
// (PayFast or Peach Payments) are confirmed in manifest.js.

import { FLAGS } from '@/core/flags.js'
import { BRAND } from '@/core/manifest.js'

// ── createSubscription ────────────────────────────────────────────────────────
// Initiates a new subscription and processes the first payment.
// payload: { parentRecordId, planId, billingFrequency, paymentToken }
// Returns: { success, subscriptionId, orderId, nextBillingDate }
export async function createSubscription(payload) {
  if (FLAGS.paymentSimulated) {
    console.log('[SIM] payment.js — createSubscription called')
    console.log('[SIM] payment.js — planId:', payload.planId || '[not provided]')
    console.log('[SIM] payment.js — billingFrequency:', payload.billingFrequency || '[not provided]')
    await new Promise(r => setTimeout(r, 480))
    const orderId = `CR-${Date.now()}`
    return {
      success:         true,
      subscriptionId:  `cr-sim-sub-${Date.now()}`,
      orderId,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  const res = await fetch(`${BRAND.integrations.payment.endpoint}/subscriptions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${BRAND.integrations.payment.merchantKey}`,
    },
    body: JSON.stringify({
      ...payload,
      merchantId: BRAND.integrations.payment.merchantId,
    }),
  })
  if (!res.ok) throw new Error(`payment.createSubscription: ${res.status}`)
  return res.json()
}

// ── cancelSubscription ────────────────────────────────────────────────────────
// Cancels an active subscription at end of current billing period.
// payload: { subscriptionId, parentRecordId }
// Returns: { success, cancelledAt, effectiveUntil }
export async function cancelSubscription(payload) {
  if (FLAGS.paymentSimulated) {
    console.log('[SIM] payment.js — cancelSubscription called')
    console.log('[SIM] payment.js — subscriptionId:', payload.subscriptionId || '[not provided]')
    await new Promise(r => setTimeout(r, 350))
    return {
      success:        true,
      cancelledAt:    new Date().toISOString(),
      effectiveUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  const res = await fetch(
    `${BRAND.integrations.payment.endpoint}/subscriptions/${payload.subscriptionId}/cancel`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${BRAND.integrations.payment.merchantKey}`,
      },
      body: JSON.stringify({ parentRecordId: payload.parentRecordId }),
    },
  )
  if (!res.ok) throw new Error(`payment.cancelSubscription: ${res.status}`)
  return res.json()
}
