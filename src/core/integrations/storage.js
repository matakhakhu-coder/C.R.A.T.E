// ── src/core/integrations/storage.js ──────────────────────────────────────
// Asset storage adapter — AWS S3 Cape Town (af-south-1).
// Handles crate imagery, sandbox asset sprites, challenge card PDFs.
// SA-sovereign hosting required for POPIA compliance.
// Flip FLAGS.storageSimulated to false when S3 Cape Town bucket name,
// region, and IAM access key are confirmed in manifest.js.

import { FLAGS } from '@/core/flags.js'
import { BRAND } from '@/core/manifest.js'

// ── uploadAsset ───────────────────────────────────────────────────────────────
// Uploads a binary asset to the storage bucket.
// assetPayload: { key, contentType, data, metadata }
// Returns: { success, assetUrl, key }
export async function uploadAsset(assetPayload) {
  if (FLAGS.storageSimulated) {
    console.log('[SIM] storage.js — uploadAsset called')
    console.log('[SIM] storage.js — key:', assetPayload.key || '[not provided]')
    console.log('[SIM] storage.js — contentType:', assetPayload.contentType || '[not provided]')
    await new Promise(r => setTimeout(r, 410))
    return {
      success:  true,
      assetUrl: null,   // null-safe: no real URL in SIM — use base64 or placeholder
      key:      assetPayload.key,
    }
  }

  const res = await fetch(
    `https://${BRAND.integrations.storage.bucket}.s3.${BRAND.integrations.storage.region}.amazonaws.com/${assetPayload.key}`,
    {
      method:  'PUT',
      headers: {
        'Content-Type':        assetPayload.contentType,
        'x-amz-acl':           'private',
        'Authorization':       `AWS ${BRAND.integrations.storage.accessKey}:${assetPayload.key}`,
      },
      body: assetPayload.data,
    },
  )
  if (!res.ok) throw new Error(`storage.uploadAsset: ${res.status}`)
  return {
    success:  true,
    assetUrl: `https://${BRAND.integrations.storage.bucket}.s3.${BRAND.integrations.storage.region}.amazonaws.com/${assetPayload.key}`,
    key:      assetPayload.key,
  }
}

// ── getAssetUrl ───────────────────────────────────────────────────────────────
// Returns a presigned URL for a stored asset.
// payload: { key, expirySeconds }
// Returns: { success, presignedUrl }
export async function getAssetUrl(payload) {
  if (FLAGS.storageSimulated) {
    console.log('[SIM] storage.js — getAssetUrl called')
    console.log('[SIM] storage.js — key:', payload.key || '[not provided]')
    await new Promise(r => setTimeout(r, 200))
    return {
      success:      true,
      presignedUrl: null,   // null-safe: render placeholder in SIM mode
    }
  }

  // Live presigned URL generation via AWS SDK — implemented in Phase 9
  throw new Error('storage.getAssetUrl: live path not yet configured — see Phase 9')
}
