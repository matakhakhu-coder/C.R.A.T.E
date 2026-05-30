// ── src/core/integrations/delivery.js ─────────────────────────────────────
// Delivery network adapter — Pudo smart lockers + PEP Paxi pickup points.
// Both channels must be confirmed before FLAGS.deliverySimulated flips to false.
// Pudo: 1,500+ smart lockers nationwide, locker-to-locker from R60 / door from R70.
// Paxi: 2,800+ PEP / Tekkie Town / Shoe City points nationwide for R59.95.

import { FLAGS } from '@/core/flags.js'
import { BRAND } from '@/core/manifest.js'

// ── lookupPudoLockers ─────────────────────────────────────────────────────────
// Returns available Pudo locker locations near a given postcode.
// payload: { postcode, radius }
// Returns: { success, lockers: [{ lockerId, address, distance }] }
export async function lookupPudoLockers(payload) {
  if (FLAGS.deliverySimulated) {
    console.log('[SIM] delivery.js — lookupPudoLockers called')
    console.log('[SIM] delivery.js — postcode:', payload.postcode || '[not provided]')
    await new Promise(r => setTimeout(r, 360))
    return {
      success: true,
      lockers: [
        { lockerId: 'SIM-PUDO-001', address: 'Sim Locker Point A — near your postcode', distance: '1.2km' },
        { lockerId: 'SIM-PUDO-002', address: 'Sim Locker Point B — near your postcode', distance: '2.4km' },
      ],
    }
  }

  const res = await fetch(
    `${BRAND.integrations.delivery.pudo.endpoint}/lockers?postcode=${payload.postcode}&radius=${payload.radius || 10}`,
    { headers: { 'Authorization': `Bearer ${BRAND.integrations.delivery.pudo.apiKey}` } },
  )
  if (!res.ok) throw new Error(`delivery.lookupPudoLockers: ${res.status}`)
  return res.json()
}

// ── createPudoShipment ────────────────────────────────────────────────────────
// Generates a Pudo shipping label for a crate order.
// payload: { orderId, fromLockerId, toLockerId, weightKg, crateManifest }
// Returns: { success, trackingCode, labelUrl, estimatedArrival }
export async function createPudoShipment(payload) {
  if (FLAGS.deliverySimulated) {
    console.log('[SIM] delivery.js — createPudoShipment called')
    console.log('[SIM] delivery.js — orderId:', payload.orderId || '[not provided]')
    await new Promise(r => setTimeout(r, 460))
    return {
      success:           true,
      trackingCode:      `SIM-PUDO-TRK-${Date.now()}`,
      labelUrl:          null,   // null-safe: no real URL in SIM
      estimatedArrival:  new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  const res = await fetch(`${BRAND.integrations.delivery.pudo.endpoint}/shipments`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${BRAND.integrations.delivery.pudo.apiKey}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`delivery.createPudoShipment: ${res.status}`)
  return res.json()
}

// ── lookupPaxiPoints ──────────────────────────────────────────────────────────
// Returns available Paxi pickup points near a given postcode.
// payload: { postcode }
// Returns: { success, points: [{ pointId, storeName, address, distance }] }
export async function lookupPaxiPoints(payload) {
  if (FLAGS.deliverySimulated) {
    console.log('[SIM] delivery.js — lookupPaxiPoints called')
    console.log('[SIM] delivery.js — postcode:', payload.postcode || '[not provided]')
    await new Promise(r => setTimeout(r, 340))
    return {
      success: true,
      points: [
        { pointId: 'SIM-PAXI-001', storeName: 'Sim PEP Store A', address: 'Near your postcode', distance: '0.8km' },
        { pointId: 'SIM-PAXI-002', storeName: 'Sim Tekkie Town B', address: 'Near your postcode', distance: '1.6km' },
      ],
    }
  }

  const res = await fetch(
    `${BRAND.integrations.delivery.paxi.endpoint}/points?postcode=${payload.postcode}`,
    { headers: { 'Authorization': `Bearer ${BRAND.integrations.delivery.paxi.apiKey}` } },
  )
  if (!res.ok) throw new Error(`delivery.lookupPaxiPoints: ${res.status}`)
  return res.json()
}

// ── createPaxiConsignment ─────────────────────────────────────────────────────
// Creates a Paxi consignment record for a crate order.
// payload: { orderId, pickupPointId, weightKg, crateManifest }
// Returns: { success, consignmentId, collectionCode, estimatedArrival }
export async function createPaxiConsignment(payload) {
  if (FLAGS.deliverySimulated) {
    console.log('[SIM] delivery.js — createPaxiConsignment called')
    console.log('[SIM] delivery.js — orderId:', payload.orderId || '[not provided]')
    await new Promise(r => setTimeout(r, 420))
    return {
      success:          true,
      consignmentId:    `SIM-PAXI-CON-${Date.now()}`,
      collectionCode:   'SIM-000',
      estimatedArrival: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  const res = await fetch(`${BRAND.integrations.delivery.paxi.endpoint}/consignments`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${BRAND.integrations.delivery.paxi.apiKey}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`delivery.createPaxiConsignment: ${res.status}`)
  return res.json()
}
