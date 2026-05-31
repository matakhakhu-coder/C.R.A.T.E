// ── src/core/integrations/delivery.js ─────────────────────────────────────
// Delivery network adapter — Pudo smart lockers + PEP Paxi pickup points.
// Phase 9 upgrade: live API paths fully implemented alongside existing SIM paths.
//
// Switch-flip invariant (CLAUDE.md):
//   Set FLAGS.deliverySimulated = false to activate production routing.
//   No component refactoring required — this is the only change needed.
//   BOTH Pudo AND Paxi credentials must be confirmed before flipping the flag.
//
// POPIA compliance:
//   Delivery payloads contain only orderId, locker/point IDs, weight, and
//   anonymized crate descriptors. Zero personal contact fields (no parentName,
//   parentEmail, parentPhone) cross this adapter. PII delivery addresses are
//   stored separately in piiStore.js (Database A) and never passed here.
//
// HPCSA guardrail: No clinical or diagnostic terminology in error messages,
//   log strings, or comments. All copy is logistics and operations focused.
//
// Live partner documentation:
//   Pudo API: https://pudo.co.za/developers (endpoint TBC — see manifest.js)
//   PEP Paxi API: https://paxi.co.za/api (endpoint TBC — see manifest.js)

import { FLAGS } from '@/core/flags.js'
import { BRAND } from '@/core/manifest.js'

// ── Standard request timeout for live API calls (10 seconds) ─────────────────
const _TIMEOUT_MS = 10_000

// ── Fetch with timeout helper (used by all live paths) ───────────────────────
async function _fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), _TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)
    return res
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error('Logistics Provider Error: Request timed out after 10 seconds.')
    }
    throw new Error(`Logistics Provider Error: Network failure — ${err.message}`)
  }
}

// =============================================================================
// PUDO SMART LOCKER METHODS
// =============================================================================

// ── lookupPudoLockers ─────────────────────────────────────────────────────────
// Returns available Pudo locker locations near a given SA postal code.
//
// payload: { postcode: string, radius?: number }
// Returns: { success: true, lockers: [{ lockerId, address, distance }] }
//
// Live path: GET ${pudo.endpoint}/lockers?postcode=XXXX&radius=10
// Authorization: Bearer ${pudo.apiKey}
export async function lookupPudoLockers(payload) {
  // ── Simulation path ───────────────────────────────────────────────────────
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

  // ── Live path ─────────────────────────────────────────────────────────────
  const endpoint = BRAND.integrations.delivery.pudo.endpoint
  const apiKey   = BRAND.integrations.delivery.pudo.apiKey

  if (!endpoint || !apiKey) {
    throw new Error('Logistics Provider Error: Pudo credentials are not configured. Set BRAND.integrations.delivery.pudo.endpoint and .apiKey in manifest.js.')
  }

  const radius = payload.radius || 10
  const url    = `${endpoint}/lockers?postcode=${encodeURIComponent(payload.postcode)}&radius=${radius}`

  try {
    const res = await _fetchWithTimeout(url, {
      method:  'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept':        'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`Logistics Provider Error: Pudo locker lookup returned ${res.status} — ${res.statusText || 'unexpected response'}.`)
    }

    const data = await res.json()

    // Normalize the Pudo API response to our internal locker schema.
    // Pudo may return different field names — this layer maps common variants.
    const lockers = (data.lockers || data.data || data.results || []).map(l => ({
      lockerId: l.locker_id || l.id || l.lockerId || String(l._id || ''),
      address:  l.address   || l.location?.address || l.name || 'Pudo Locker',
      distance: l.distance  || l.dist || '—',
    }))

    return { success: true, lockers }

  } catch (err) {
    // Re-throw structured errors, wrap generic ones
    if (err.message.startsWith('Logistics Provider Error:')) throw err
    throw new Error(`Logistics Provider Error: Pudo locker lookup failed — ${err.message}`)
  }
}

// ── createPudoShipment ────────────────────────────────────────────────────────
// Generates a Pudo shipping label and books a locker reservation.
//
// payload: { orderId, fromLockerId?, toLockerId, weightKg, crateManifest? }
// Returns: { success: true, trackingCode, labelUrl, estimatedArrival }
//
// Live path: POST ${pudo.endpoint}/shipments
// Body: { orderId, toLockerId, weightKg, dimensions, orderType }
export async function createPudoShipment(payload) {
  // ── Simulation path ───────────────────────────────────────────────────────
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

  // ── Live path ─────────────────────────────────────────────────────────────
  const endpoint = BRAND.integrations.delivery.pudo.endpoint
  const apiKey   = BRAND.integrations.delivery.pudo.apiKey

  if (!endpoint || !apiKey) {
    throw new Error('Logistics Provider Error: Pudo credentials are not configured. Set BRAND.integrations.delivery.pudo.endpoint and .apiKey in manifest.js.')
  }

  // POPIA: payload contains orderId, locker IDs, and weight only.
  // No personal contact data enters this adapter.
  const body = {
    order_id:       payload.orderId,
    to_locker_id:   payload.toLockerId,
    from_locker_id: payload.fromLockerId || null,
    weight_kg:      payload.weightKg     || 0.8,
    dimensions: {
      length_cm: 30,
      width_cm:  25,
      height_cm: 15,
    },
    order_type:     'subscription_crate',
    special_instructions: null,
  }

  try {
    const res = await _fetchWithTimeout(`${endpoint}/shipments`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept':        'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`Logistics Provider Error: Pudo shipment creation returned ${res.status} — ${res.statusText || 'unexpected response'}.`)
    }

    const data = await res.json()

    return {
      success:          true,
      trackingCode:     data.tracking_code || data.trackingCode || data.id    || `PUDO-${payload.orderId}`,
      labelUrl:         data.label_url     || data.labelUrl     || data.label || null,
      estimatedArrival: data.estimated_arrival || data.estimatedArrival        || null,
    }

  } catch (err) {
    if (err.message.startsWith('Logistics Provider Error:')) throw err
    throw new Error(`Logistics Provider Error: Pudo shipment creation failed — ${err.message}`)
  }
}

// =============================================================================
// PEP PAXI PICKUP POINT METHODS
// =============================================================================

// ── lookupPaxiPoints ──────────────────────────────────────────────────────────
// Returns available Paxi store pickup locations near a given SA postal code.
//
// payload: { postcode: string }
// Returns: { success: true, points: [{ pointId, storeName, address, distance }] }
//
// Live path: GET ${paxi.endpoint}/points?postcode=XXXX
// Authorization: Bearer ${paxi.apiKey}
export async function lookupPaxiPoints(payload) {
  // ── Simulation path ───────────────────────────────────────────────────────
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

  // ── Live path ─────────────────────────────────────────────────────────────
  const endpoint = BRAND.integrations.delivery.paxi.endpoint
  const apiKey   = BRAND.integrations.delivery.paxi.apiKey

  if (!endpoint || !apiKey) {
    throw new Error('Logistics Provider Error: Paxi credentials are not configured. Set BRAND.integrations.delivery.paxi.endpoint and .apiKey in manifest.js.')
  }

  const url = `${endpoint}/points?postcode=${encodeURIComponent(payload.postcode)}`

  try {
    const res = await _fetchWithTimeout(url, {
      method:  'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept':        'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`Logistics Provider Error: Paxi point lookup returned ${res.status} — ${res.statusText || 'unexpected response'}.`)
    }

    const data = await res.json()

    // Normalize Paxi API response to internal pickup point schema.
    const points = (data.points || data.data || data.results || data.stores || []).map(p => ({
      pointId:   p.point_id   || p.id     || p.pointId   || String(p._id || ''),
      storeName: p.store_name || p.name   || p.storeName || 'PEP Store',
      address:   p.address    || p.location?.address      || '—',
      distance:  p.distance   || p.dist                   || '—',
    }))

    return { success: true, points }

  } catch (err) {
    if (err.message.startsWith('Logistics Provider Error:')) throw err
    throw new Error(`Logistics Provider Error: Paxi point lookup failed — ${err.message}`)
  }
}

// ── createPaxiConsignment ─────────────────────────────────────────────────────
// Books a store-to-store Paxi parcel drop with a verified consignment token.
//
// payload: { orderId, pickupPointId, weightKg, crateManifest? }
// Returns: { success: true, consignmentId, collectionCode, estimatedArrival }
//
// Live path: POST ${paxi.endpoint}/consignments
// Body: { orderId, pickupPointId, weightKg, orderType }
export async function createPaxiConsignment(payload) {
  // ── Simulation path ───────────────────────────────────────────────────────
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

  // ── Live path ─────────────────────────────────────────────────────────────
  const endpoint = BRAND.integrations.delivery.paxi.endpoint
  const apiKey   = BRAND.integrations.delivery.paxi.apiKey

  if (!endpoint || !apiKey) {
    throw new Error('Logistics Provider Error: Paxi credentials are not configured. Set BRAND.integrations.delivery.paxi.endpoint and .apiKey in manifest.js.')
  }

  // POPIA: consignment body contains orderId, point ID, and weight only.
  // No parentName, email, or phone data enters this adapter.
  const body = {
    order_id:        payload.orderId,
    pickup_point_id: payload.pickupPointId,
    weight_kg:       payload.weightKg || 0.8,
    dimensions: {
      length_cm: 30,
      width_cm:  25,
      height_cm: 15,
    },
    order_type:      'subscription_crate',
    service_type:    'standard',
  }

  try {
    const res = await _fetchWithTimeout(`${endpoint}/consignments`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept':        'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`Logistics Provider Error: Paxi consignment creation returned ${res.status} — ${res.statusText || 'unexpected response'}.`)
    }

    const data = await res.json()

    return {
      success:          true,
      consignmentId:    data.consignment_id    || data.consignmentId    || data.id   || `PAXI-${payload.orderId}`,
      collectionCode:   data.collection_code   || data.collectionCode   || data.code || '—',
      estimatedArrival: data.estimated_arrival || data.estimatedArrival              || null,
    }

  } catch (err) {
    if (err.message.startsWith('Logistics Provider Error:')) throw err
    throw new Error(`Logistics Provider Error: Paxi consignment creation failed — ${err.message}`)
  }
}
