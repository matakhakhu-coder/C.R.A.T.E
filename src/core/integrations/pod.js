// ── src/core/integrations/pod.js ──────────────────────────────────────────
// Print-on-Demand adapter.
// Phase 9 upgrade: live production API path fully implemented alongside
// the existing simulation path.
//
// Switch-flip invariant (CLAUDE.md):
//   Set FLAGS.podSimulated = false to activate live print dispatch.
//   No component refactoring required — this is the only change needed.
//
// POPIA compliance:
//   Print job payloads contain only the orderId, creative component
//   descriptors (challenge card themes, sticker identifiers), language
//   configuration, and structural print specifications.
//   Zero PII fields (no parentName, parentEmail, parentPhone) enter this
//   adapter. orderId is the anonymous tracking reference only.
//
// HPCSA guardrail: No clinical, diagnostic, or psychometric terminology
//   in any payload fields, error messages, or log strings.
//   All labels are kit-framed: "challenge card theme", "insert layout",
//   "activity kit descriptor".
//
// Live partner:
//   SA local print-on-demand station (provider TBC — see manifest.js).
//   Endpoint: BRAND.integrations.pod.endpoint
//   Auth key: BRAND.integrations.pod.apiKey

import { FLAGS } from '@/core/flags.js'
import { BRAND } from '@/core/manifest.js'

// ── Standard request timeout for live API calls (15 seconds) ─────────────────
// POD calls are given a longer timeout than delivery lookups since print job
// submission may include larger structured payloads and queue validation.
const _TIMEOUT_MS = 15_000

// ── Fetch with timeout helper ─────────────────────────────────────────────────
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
      throw new Error('Print Dispatch Error: Request timed out after 15 seconds.')
    }
    throw new Error(`Print Dispatch Error: Network failure — ${err.message}`)
  }
}

// ── dispatchPrintJob ──────────────────────────────────────────────────────────
// Sends a crate's print assets to the POD station for production.
// Handles bilingual (English + Afrikaans) challenge cards, storytelling
// inserts, and sticker packs for the 70/20/10 crate manifest.
//
// crateManifest: {
//   orderId:            string   — anonymous order reference (no PII)
//   challengeCardTheme: string   — primary activity kit card theme
//   insertTheme:        string   — secondary kit insert theme
//   stickerSet:         string   — stretch component sticker identifier
//   language:           'en' | 'af' | 'bilingual'
//   quantity:           number
// }
// Returns: { success: true, printJobId, estimatedProductionTime }
//
// Live path: POST ${pod.endpoint}/jobs
// Body: fully serialized JSON print specification (see below)
export async function dispatchPrintJob(crateManifest) {
  // ── Simulation path ───────────────────────────────────────────────────────
  if (FLAGS.podSimulated) {
    console.log('[SIM] pod.js — dispatchPrintJob called')
    console.log('[SIM] pod.js — orderId:', crateManifest.orderId || '[not provided]')
    console.log('[SIM] pod.js — challengeCardTheme:', crateManifest.challengeCardTheme || '[not provided]')
    console.log('[SIM] pod.js — language:', crateManifest.language || '[not provided]')
    await new Promise(r => setTimeout(r, 380))

    // Persist to sim order queue so admin panel can display job status
    const orders = JSON.parse(localStorage.getItem('cr_sim_orders') || '[]')
    const idx = orders.findIndex(o => o.orderId === crateManifest.orderId)
    if (idx !== -1) {
      orders[idx].podStatus  = 'queued'
      orders[idx].printJobId = `SIM-POD-${Date.now()}`
    }
    localStorage.setItem('cr_sim_orders', JSON.stringify(orders))

    return {
      success:                 true,
      printJobId:              `SIM-POD-${Date.now()}`,
      estimatedProductionTime: '2 business days',
    }
  }

  // ── Live path ─────────────────────────────────────────────────────────────
  const endpoint = BRAND.integrations.pod.endpoint
  const apiKey   = BRAND.integrations.pod.apiKey

  if (!endpoint || !apiKey) {
    throw new Error('Print Dispatch Error: POD provider credentials are not configured. Set BRAND.integrations.pod.endpoint and .apiKey in manifest.js.')
  }

  // ── Construct the live print job payload ──────────────────────────────────
  // Dual-language configuration: EN primary + AF secondary for bilingual orders.
  // All fields are kit-framed identifiers only — zero PII content.
  const languageConfig = crateManifest.language === 'bilingual'
    ? { primary: 'en-ZA', secondary: 'af-ZA', bilingual: true }
    : { primary: crateManifest.language === 'af' ? 'af-ZA' : 'en-ZA', secondary: null, bilingual: false }

  const printJobBody = {
    order_id:     crateManifest.orderId,
    job_type:     'subscription_crate_kit',
    quantity:     crateManifest.quantity || 1,

    // Primary 70% challenge card set
    challenge_card: {
      theme:      crateManifest.challengeCardTheme || 'exploration-standard',
      format:     'double-sided',
      size:       'A5',
      finish:     'matte',
      language:   languageConfig,
    },

    // Secondary 20% insert sheet
    insert: {
      theme:      crateManifest.insertTheme || 'standard',
      format:     'single-sided',
      size:       'A5',
      finish:     'matte',
      language:   languageConfig,
    },

    // Stretch 10% sticker pack
    sticker_pack: {
      identifier: crateManifest.stickerSet || 'standard',
      sheet_size: 'A4',
      finish:     'gloss',
    },

    // Production routing metadata
    production: {
      priority:     'standard',
      turnaround:   '2_business_days',
      region:       'ZA',
    },
  }

  try {
    const res = await _fetchWithTimeout(`${endpoint}/jobs`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept':        'application/json',
      },
      body: JSON.stringify(printJobBody),
    })

    if (res.status === 401 || res.status === 403) {
      throw new Error('Print Dispatch Error: POD provider rejected the API key. Verify BRAND.integrations.pod.apiKey in manifest.js.')
    }

    if (!res.ok) {
      throw new Error(`Print Dispatch Error: POD endpoint returned ${res.status} — ${res.statusText || 'unexpected response'}.`)
    }

    const data = await res.json()

    // Validate that the provider returned a tracking job identifier.
    const printJobId = data.print_job_id || data.printJobId || data.job_id || data.id
    if (!printJobId) {
      throw new Error('Print Dispatch Error: POD provider did not return a print job identifier. Verify the endpoint response schema.')
    }

    return {
      success:                 true,
      printJobId:              String(printJobId),
      estimatedProductionTime: data.estimated_production_time
                              || data.estimatedProductionTime
                              || data.turnaround
                              || '2 business days',
    }

  } catch (err) {
    if (err.message.startsWith('Print Dispatch Error:')) throw err
    throw new Error(`Print Dispatch Error: POD job submission failed — ${err.message}`)
  }
}
