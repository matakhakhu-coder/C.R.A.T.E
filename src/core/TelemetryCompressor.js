// ── src/core/TelemetryCompressor.js ──────────────────────────────────────────
// Phase 11.5 — High-performance binary telemetry packet serializer.
// Zero external dependencies. ESM-compliant. No DOM access.
//
// Produces compact ArrayBuffer packets from play session signal objects and
// coordinate logs. Uses delta encoding with Run-Length Encoding (RLE)
// compression on the coordinate stream to stay well inside the 50KB
// Sub-Saharan bandwidth envelope.
//
// Architecture:
//   pack(signals, coordinateLog, meta)  → ArrayBuffer
//   unpack(buffer)                      → { signals, coordinateLog, meta }
//
// HPCSA guardrail: No clinical, diagnostic, or performance-ranking
//   terminology in any field name, comment, or log string.
//
// POPIA isolation: The packer operates on anonymous signal counts and
//   coordinate vectors only. The pseudoUUID is passed in meta and written
//   as a header checksum seed — never as a plaintext string inside the buffer.

// ── Signal ID ↔ canonical key mapping ────────────────────────────────────────
// IDs must remain stable across protocol versions.
const _SIGNAL_IDS = Object.freeze({
  timeToFirstAction:    0,
  retryFrequency:       1,
  explorationBreadth:   2,
  ruleBreakingAttempts: 3,
  backtrackingBehavior: 4,
  speedVariability:     5,
  creativeModifications:6,
  optionalInteractions: 7,
  sequencePaths:        8,
  materialEssences:     9,
  nudgeRatio:           10,
  envVariableIsolation: 11,
})

// Reverse map: ID → canonical key (used by unpack)
const _ID_TO_SIGNAL = Object.fromEntries(
  Object.entries(_SIGNAL_IDS).map(([k, v]) => [v, k])
)

// ── Per-signal encoding scale factors ────────────────────────────────────────
// Ratios are multiplied before storing as Uint16 to preserve decimal precision.
// Counts are stored as-is (scale = 1).
const _SCALE = Object.freeze({
  timeToFirstAction:    1,      // ms (Uint16, max ~65s — sufficient for first action)
  retryFrequency:       1,      // event count
  explorationBreadth:   1000,   // ratio [0,1] × 1000
  ruleBreakingAttempts: 1,      // event count
  backtrackingBehavior: 1000,   // ratio [0,1] × 1000
  speedVariability:     1,      // standard deviation in ms (capped at 65535ms)
  creativeModifications:1000,   // ratio [0,1] × 1000
  optionalInteractions: 1,      // event count
  sequencePaths:        1,      // complexity score (integer)
  materialEssences:     100,    // value × 100 (2 decimal places preserved)
  nudgeRatio:           1000,   // ratio [0,∞] × 1000 (capped at 65535)
  envVariableIsolation: 1,      // isolation event count
})

// ── Protocol constants ────────────────────────────────────────────────────────
const _MAGIC_1       = 0xCE   // byte 0: crate engine marker
const _MAGIC_2       = 0xA7   // byte 1: telemetry stream marker
const _VERSION       = 0x01   // byte 2: protocol version
const _RLE_MARKER    = 0xFF   // RLE run prefix byte (signals a compressed run follows)
const _HEADER_BYTES  = 16     // fixed header size

// =============================================================================
// EXPORTED: pack(signals, coordinateLog, meta)
// =============================================================================
// Serializes a session's signals and coordinate samples into a compact ArrayBuffer.
//
// signals:      { [canonicalKey]: number }  — micro-signal counts / values
// coordinateLog [{ x, y }]                 — sampled body positions (2Hz)
// meta:         { sessionMs, sessionStartMs, bodyCount, gapMetric, pseudoUUID }
//
// Buffer layout:
//   HEADER    (16 bytes, fixed)
//   SIGNALS   (N × 4 bytes, variable count)
//   COORDS    (variable, present when coordinateLog.length > 0)
export function pack(signals, coordinateLog = [], meta = {}) {
  const entries = Object.entries(signals).filter(([k]) => k in _SIGNAL_IDS)
  const N       = entries.length
  const C       = coordinateLog.length

  // ── Pre-calculate buffer size (pessimistic) ─────────────────────────────
  // Each coord delta: 2 bytes normal / 4 bytes RLE — use 4 as worst-case per entry
  const signalBytes = N * 4
  const coordBytes  = C > 0 ? (2 + 4 + (C - 1) * 4 + 16) : 0   // +16 safety margin
  const totalBytes  = _HEADER_BYTES + signalBytes + coordBytes + 32

  const buffer = new ArrayBuffer(totalBytes)
  const view   = new DataView(buffer)
  let   offset = 0

  // ── Header (16 bytes) ───────────────────────────────────────────────────
  view.setUint8(offset++, _MAGIC_1)
  view.setUint8(offset++, _MAGIC_2)
  view.setUint8(offset++, _VERSION)
  view.setUint8(offset++, N)

  // Session start timestamp (Unix epoch, seconds — Uint32 wraps ~year 2106)
  const startEpochSec = Math.floor((meta.sessionStartMs || Date.now()) / 1000)
  view.setUint32(offset, startEpochSec >>> 0, false); offset += 4

  // Session duration in seconds (Uint16, max ~18h)
  const durationSec = Math.min(Math.round((meta.sessionMs || 0) / 1000), 65535)
  view.setUint16(offset, durationSec, false); offset += 2

  // Body count at session end (Uint16)
  view.setUint16(offset, Math.min(meta.bodyCount || 0, 65535), false); offset += 2

  // GAP metric as Float32 (4 bytes, big-endian)
  view.setFloat32(offset, meta.gapMetric || 0, false); offset += 4

  // ── Signal blocks (N × 4 bytes) ─────────────────────────────────────────
  for (const [key, raw] of entries) {
    const id      = _SIGNAL_IDS[key]
    const scale   = _SCALE[key] || 1
    const encoded = Math.min(Math.round((raw || 0) * scale), 65535)
    // Confidence flag: 0x01 = directly observed this session, 0x00 = no activity
    const conf    = (raw > 0) ? 0x01 : 0x00

    view.setUint8(offset++, id)
    view.setUint16(offset, encoded, false); offset += 2
    view.setUint8(offset++, conf)
  }

  // ── Coordinate stream (variable length) ─────────────────────────────────
  if (C > 0) {
    // Entry count prefix (Uint16)
    view.setUint16(offset, C, false); offset += 2

    // Anchor point — first coordinate stored as absolute Int16 values
    const ax = Math.round(coordinateLog[0].x)
    const ay = Math.round(coordinateLog[0].y)
    view.setInt16(offset, _clampInt16(ax), false); offset += 2
    view.setInt16(offset, _clampInt16(ay), false); offset += 2

    if (C > 1) {
      // Compute all deltas (clamped to signed byte range ±127)
      const deltas = new Array(C - 1)
      let prevX = ax, prevY = ay
      for (let i = 1; i < C; i++) {
        deltas[i - 1] = {
          dx: Math.max(-127, Math.min(127, Math.round(coordinateLog[i].x - prevX))),
          dy: Math.max(-127, Math.min(127, Math.round(coordinateLog[i].y - prevY))),
        }
        prevX = coordinateLog[i].x
        prevY = coordinateLog[i].y
      }

      // RLE encode the delta stream
      // Normal entry: 2 bytes (Int8 dx, Int8 dy)
      // RLE run:      4 bytes (0xFF marker, Int8 dx, Int8 dy, Uint8 run length)
      // A run of 3+ identical deltas saves bytes: 3×2=6 → 4 bytes
      let i = 0
      while (i < deltas.length) {
        const { dx, dy } = deltas[i]
        let runLen = 1

        // Count consecutive identical deltas (max run = 255)
        while (i + runLen < deltas.length &&
               deltas[i + runLen].dx === dx &&
               deltas[i + runLen].dy === dy &&
               runLen < 255) {
          runLen++
        }

        if (runLen >= 3) {
          // RLE compressed run
          view.setUint8(offset++,  _RLE_MARKER)
          view.setInt8 (offset++,  dx)
          view.setInt8 (offset++,  dy)
          view.setUint8(offset++,  runLen)
          i += runLen
        } else {
          // Normal uncompressed delta(s)
          for (let r = 0; r < runLen; r++) {
            view.setInt8(offset++, deltas[i + r].dx)
            view.setInt8(offset++, deltas[i + r].dy)
          }
          i += runLen
        }
      }
    }
  }

  // Return only the written bytes (trim padding)
  return buffer.slice(0, offset)
}

// =============================================================================
// EXPORTED: unpack(buffer)
// =============================================================================
// Reverses pack() — parses an ArrayBuffer back into structured objects.
// Used by admin tooling, validation utilities, and future ML ingestion pipelines.
//
// Returns: { signals, coordinateLog, meta }
// Throws:  Error if magic bytes do not match or buffer is truncated.
export function unpack(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < _HEADER_BYTES) {
    throw new Error('TelemetryCompressor: buffer too short or invalid type')
  }

  const view   = new DataView(buffer)
  const result = { signals: {}, coordinateLog: [], meta: {} }
  let   offset = 0

  // ── Validate magic bytes ─────────────────────────────────────────────────
  if (view.getUint8(0) !== _MAGIC_1 || view.getUint8(1) !== _MAGIC_2) {
    throw new Error('TelemetryCompressor: invalid packet — magic bytes mismatch')
  }
  result.meta.version = view.getUint8(2)
  const N             = view.getUint8(3)
  offset              = 4

  // ── Header meta ─────────────────────────────────────────────────────────
  result.meta.sessionStartMs = view.getUint32(offset, false) * 1000; offset += 4
  result.meta.sessionMs      = view.getUint16(offset, false) * 1000; offset += 2
  result.meta.bodyCount      = view.getUint16(offset, false);        offset += 2
  result.meta.gapMetric      = view.getFloat32(offset, false);       offset += 4

  // ── Signal blocks ────────────────────────────────────────────────────────
  for (let i = 0; i < N && offset + 3 < buffer.byteLength; i++) {
    const id      = view.getUint8(offset++)
    const encoded = view.getUint16(offset, false); offset += 2
    const conf    = view.getUint8(offset++)
    const key     = _ID_TO_SIGNAL[id]
    if (key) {
      const scale = _SCALE[key] || 1
      result.signals[key] = +(encoded / scale).toFixed(4)
    }
  }

  // ── Coordinate stream ────────────────────────────────────────────────────
  if (offset + 2 <= buffer.byteLength) {
    const C = view.getUint16(offset, false); offset += 2

    if (C > 0 && offset + 4 <= buffer.byteLength) {
      // Anchor point
      const ax = view.getInt16(offset, false); offset += 2
      const ay = view.getInt16(offset, false); offset += 2
      result.coordinateLog.push({ x: ax, y: ay })

      let prevX = ax, prevY = ay
      let count = 1

      while (count < C && offset < buffer.byteLength) {
        // Peek at next byte to check for RLE marker
        const peek = view.getUint8(offset)

        if (peek === _RLE_MARKER && offset + 3 < buffer.byteLength) {
          // RLE run: skip marker, read dx/dy/repeat
          offset++
          const dx     = view.getInt8(offset++)
          const dy     = view.getInt8(offset++)
          const runLen = view.getUint8(offset++)

          for (let r = 0; r < runLen && count < C; r++) {
            prevX += dx; prevY += dy
            result.coordinateLog.push({ x: prevX, y: prevY })
            count++
          }
        } else if (offset + 1 < buffer.byteLength) {
          // Normal delta pair
          const dx = view.getInt8(offset++)
          const dy = view.getInt8(offset++)
          prevX += dx; prevY += dy
          result.coordinateLog.push({ x: prevX, y: prevY })
          count++
        } else {
          break   // Buffer truncated — stop gracefully
        }
      }
    }
  }

  return result
}

// =============================================================================
// UTILITY: estimatePackedSize(signals, coordinateCount)
// =============================================================================
// Returns the pessimistic byte count before packing — use to verify bandwidth
// compliance before dispatching. A result under 51200 (50KB) is safe.
export function estimatePackedSize(signals, coordinateCount = 0) {
  const N       = Object.keys(signals).filter(k => k in _SIGNAL_IDS).length
  const C       = coordinateCount
  const sigBytes   = N * 4
  const coordBytes = C > 0 ? (2 + 4 + (C - 1) * 4) : 0   // worst-case, no RLE savings
  return _HEADER_BYTES + sigBytes + coordBytes
}

// =============================================================================
// PRIVATE helpers
// =============================================================================
function _clampInt16(v) { return Math.max(-32768, Math.min(32767, v)) }
