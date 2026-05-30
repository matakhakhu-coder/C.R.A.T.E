// ── src/core/integrations/pod.js ──────────────────────────────────────────
// Print-on-Demand adapter.
// Dispatches bilingual (English + Afrikaans) challenge cards, storytelling
// inserts, and sticker pack print jobs to the local SA POD printing station.
// Triggered by the 70/20/10 CrateRecommender after a crate manifest is finalized.
// Flip FLAGS.podSimulated to false when POD provider credentials are confirmed.

import { FLAGS } from '@/core/flags.js'
import { BRAND } from '@/core/manifest.js'

// ── dispatchPrintJob ──────────────────────────────────────────────────────────
// Sends a crate's print assets to the POD station for production.
// crateManifest: { orderId, challengeCardTheme, insertTheme, stickerSet,
//                  language: 'en' | 'af' | 'bilingual', quantity }
// Returns: { success, printJobId, estimatedProductionTime }
export async function dispatchPrintJob(crateManifest) {
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

  const res = await fetch(`${BRAND.integrations.pod.endpoint}/jobs`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${BRAND.integrations.pod.apiKey}`,
    },
    body: JSON.stringify(crateManifest),
  })
  if (!res.ok) throw new Error(`pod.dispatchPrintJob: ${res.status}`)
  return res.json()
}
