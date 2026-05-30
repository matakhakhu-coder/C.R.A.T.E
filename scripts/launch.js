#!/usr/bin/env node
// ── scripts/launch.js ────────────────────────────────────────────────────────
// C.R.A.T.E. Pre-Production Launch Gate
// Run via: npm run launch  (or: node scripts/launch.js)
//
// This script reads manifest.js and flags.js as text buffers — it does not
// import them as modules. It scans for:
//   1. Unresolved TBC fields  (lines containing `: null`)
//   2. Active simulation flags (lines containing `Simulated: true`)
//
// It always exits with code 0. Warnings are advisory — the operator decides
// when the warning count is acceptable for production promotion.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const root       = resolve(__dirname, '..')

// ── ANSI colour codes ─────────────────────────────────────────────────────────
const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN  = '\x1b[32m'
const CYAN   = '\x1b[36m'
const DIM    = '\x1b[2m'

// ── Helpers ───────────────────────────────────────────────────────────────────
function readFile(relativePath) {
  try {
    return readFileSync(resolve(root, relativePath), 'utf8')
  } catch {
    return null
  }
}

function extractKeyName(line) {
  // Extracts the key identifier from a line like:
  //   "  legalEntityName:    null,"  →  "legalEntityName"
  //   "  apiKey:   null,   // TBC"  →  "apiKey"
  const match = line.match(/^\s*([\w]+)\s*:/)
  return match ? match[1].trim() : line.trim()
}

function banner(text) {
  const bar = '─'.repeat(60)
  console.log(`\n${BOLD}${CYAN}${bar}${RESET}`)
  console.log(`${BOLD}${CYAN}  ${text}${RESET}`)
  console.log(`${BOLD}${CYAN}${bar}${RESET}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
banner('C.R.A.T.E. Launch Gate — Pre-Production Preflight Check')
console.log(`${DIM}  Run this gate before every production deployment.${RESET}`)
console.log(`${DIM}  All warnings are advisory. Exit code is always 0.${RESET}\n`)

let totalWarnings = 0

// ── 1. Scan manifest.js for null fields ──────────────────────────────────────
console.log(`${BOLD}[1/2] Scanning manifest.js for unresolved TBC fields...${RESET}`)

const manifestText = readFile('src/core/manifest.js')

if (!manifestText) {
  console.log(`${RED}  ✗  src/core/manifest.js not found${RESET}`)
  totalWarnings++
} else {
  const manifestLines = manifestText.split('\n')
  const nullLines = manifestLines.filter(line => {
    // Match lines with `: null` that are not pure comments
    return /:\s*null/.test(line) && !line.trim().startsWith('//')
  })

  if (nullLines.length === 0) {
    console.log(`${GREEN}  ✓  All manifest fields resolved — no TBC nulls found${RESET}`)
  } else {
    console.log(`${YELLOW}  ⚠  ${nullLines.length} unresolved TBC field(s) in manifest.js:${RESET}`)
    nullLines.forEach((line, i) => {
      const key     = extractKeyName(line)
      const comment = line.includes('// TBC') ? line.split('// TBC')[1].trim() : ''
      const detail  = comment ? ` — ${comment}` : ''
      console.log(`${YELLOW}     ${i + 1}. ${key}${detail}${RESET}`)
    })
    totalWarnings += nullLines.length
  }
}

console.log()

// ── 2. Scan flags.js for active simulation flags ──────────────────────────────
console.log(`${BOLD}[2/2] Scanning flags.js for active simulation channels...${RESET}`)

const flagsText = readFile('src/core/flags.js')

if (!flagsText) {
  console.log(`${RED}  ✗  src/core/flags.js not found${RESET}`)
  totalWarnings++
} else {
  const flagsLines = flagsText.split('\n')
  const trueFlags  = flagsLines.filter(line => {
    return /\w+Simulated\s*:\s*true/.test(line) && !line.trim().startsWith('//')
  })

  if (trueFlags.length === 0) {
    console.log(`${GREEN}  ✓  All simulation flags are false — platform is in live mode${RESET}`)
  } else {
    console.log(`${YELLOW}  ⚠  ${trueFlags.length} active simulation channel(s) in flags.js:${RESET}`)
    trueFlags.forEach((line, i) => {
      const flagKey = extractKeyName(line)
      console.log(`${YELLOW}     ${i + 1}. ${flagKey}: true — integration is still simulated${RESET}`)
    })
    totalWarnings += trueFlags.length
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
const barLine = '─'.repeat(60)
console.log(`\n${BOLD}${CYAN}${barLine}${RESET}`)

if (totalWarnings === 0) {
  console.log(`${BOLD}${GREEN}  ✓  Launch gate PASSED — ${totalWarnings} warnings${RESET}`)
  console.log(`${GREEN}     All manifest fields resolved. All flags live.${RESET}`)
  console.log(`${GREEN}     Platform is ready for production promotion.${RESET}`)
} else {
  console.log(`${BOLD}${YELLOW}  ⚠  Launch gate WARNING — ${totalWarnings} outstanding item(s)${RESET}`)
  console.log(`${YELLOW}     Resolve the items above before production deployment.${RESET}`)
  console.log(`${YELLOW}     Each warning = one credential or decision still outstanding.${RESET}`)
}

console.log(`${BOLD}${CYAN}${barLine}${RESET}`)
console.log(`${DIM}\n  Exit code: 0 (warnings are advisory — CI will not block)\n${RESET}`)

// Always exit 0 — warnings never block CI
process.exit(0)
