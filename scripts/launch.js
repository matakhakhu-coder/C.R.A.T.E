#!/usr/bin/env node
// ── scripts/launch.js ────────────────────────────────────────────────────────
// C.R.A.T.E. Pre-Production Launch Gate
// Run via: npm run launch  (or: node scripts/launch.js)
//
// This script reads manifest.js and flags.js as text buffers and executes
// four validation and preparation steps in sequence:
//
//   [1/4] Scan manifest.js for unresolved TBC fields (: null)
//   [2/4] Scan flags.js for active simulation flags (Simulated: true)
//   [3/4] Overwrite public/robots.txt to production Allow: / format
//   [4/4] Write public/sitemap.xml with all public route entries
//
// All steps always exit with code 0. Warnings and notices are advisory.
// The operator decides when the warning count is acceptable for production.

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath }               from 'url'
import { dirname, resolve }            from 'path'

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

function writeFile(relativePath, content) {
  try {
    writeFileSync(resolve(root, relativePath), content, 'utf8')
    return true
  } catch (err) {
    console.log(`${RED}  ✗  Could not write ${relativePath}: ${err.message}${RESET}`)
    return false
  }
}

function extractKeyName(line) {
  const match = line.match(/^\s*([\w]+)\s*:/)
  return match ? match[1].trim() : line.trim()
}

function banner(text) {
  const bar = '-'.repeat(60)
  console.log(`\n${BOLD}${CYAN}${bar}${RESET}`)
  console.log(`${BOLD}${CYAN}  ${text}${RESET}`)
  console.log(`${BOLD}${CYAN}${bar}${RESET}`)
}

// ── Extract staging URL from manifest text (fallback to known staging URL) ────
function extractStagingUrl(manifestText) {
  if (!manifestText) return 'https://crate-platform.vercel.app'
  const match = manifestText.match(/stagingUrl\s*:\s*'([^']+)'/)
  return match ? match[1] : 'https://crate-platform.vercel.app'
}

// ── Main ──────────────────────────────────────────────────────────────────────
banner('C.R.A.T.E. Launch Gate -- Pre-Production Preflight Check')
console.log(`${DIM}  Run this gate before every production deployment.${RESET}`)
console.log(`${DIM}  All warnings are advisory. Exit code is always 0.${RESET}\n`)

let totalWarnings = 0

// =============================================================================
// STEP 1: Scan manifest.js for unresolved TBC fields
// =============================================================================
console.log(`${BOLD}[1/4] Scanning manifest.js for unresolved TBC fields...${RESET}`)

const manifestText = readFile('src/core/manifest.js')

if (!manifestText) {
  console.log(`${RED}  x  src/core/manifest.js not found${RESET}`)
  totalWarnings++
} else {
  const manifestLines = manifestText.split('\n')
  const nullLines     = manifestLines.filter(line => {
    return /:\s*null/.test(line) && !line.trim().startsWith('//')
  })

  if (nullLines.length === 0) {
    console.log(`${GREEN}  ok  All manifest fields resolved -- no TBC nulls found${RESET}`)
  } else {
    console.log(`${YELLOW}  !  ${nullLines.length} unresolved TBC field(s) in manifest.js:${RESET}`)
    nullLines.forEach((line, i) => {
      const key     = extractKeyName(line)
      const comment = line.includes('// TBC') ? line.split('// TBC')[1].trim() : ''
      const detail  = comment ? ` -- ${comment}` : ''
      console.log(`${YELLOW}     ${i + 1}. ${key}${detail}${RESET}`)
    })
    totalWarnings += nullLines.length
  }
}

console.log()

// =============================================================================
// STEP 2: Scan flags.js for active simulation flags
// =============================================================================
console.log(`${BOLD}[2/4] Scanning flags.js for active simulation channels...${RESET}`)

const flagsText = readFile('src/core/flags.js')

if (!flagsText) {
  console.log(`${RED}  x  src/core/flags.js not found${RESET}`)
  totalWarnings++
} else {
  const flagsLines = flagsText.split('\n')
  const trueFlags  = flagsLines.filter(line => {
    return /\w+Simulated\s*:\s*true/.test(line) && !line.trim().startsWith('//')
  })

  if (trueFlags.length === 0) {
    console.log(`${GREEN}  ok  All simulation flags are false -- platform is in live mode${RESET}`)
  } else {
    console.log(`${YELLOW}  !  ${trueFlags.length} active simulation channel(s) in flags.js:${RESET}`)
    trueFlags.forEach((line, i) => {
      const flagKey = extractKeyName(line)
      console.log(`${YELLOW}     ${i + 1}. ${flagKey}: true -- integration is still simulated${RESET}`)
    })
    totalWarnings += trueFlags.length
  }
}

console.log()

// =============================================================================
// STEP 3: Overwrite public/robots.txt to production format
// Switches from staging block (Disallow: /) to public Allow: / + Sitemap.
// This step is idempotent — safe to run multiple times.
// =============================================================================
console.log(`${BOLD}[3/4] Updating public/robots.txt to production format...${RESET}`)

const siteUrl = extractStagingUrl(manifestText)

const robotsProduction = `User-agent: *
Allow: /
Sitemap: ${siteUrl}/sitemap.xml
`

const currentRobots = readFile('public/robots.txt')

if (currentRobots === null) {
  console.log(`${YELLOW}  !  public/robots.txt not found — creating production file${RESET}`)
}

const robotsWritten = writeFile('public/robots.txt', robotsProduction)
if (robotsWritten) {
  console.log(`${GREEN}  ok  public/robots.txt updated to production Allow: / + Sitemap directive${RESET}`)
  console.log(`${DIM}      Sitemap URL: ${siteUrl}/sitemap.xml${RESET}`)
}

console.log()

// =============================================================================
// STEP 4: Generate public/sitemap.xml with all public routes
// Covers: / (home), /app (parent portal), /subscribe (checkout).
// Admin, sandbox, and session routes are excluded from public indexing.
// lastmod uses 2026 timestamp baseline per deployment specification.
// =============================================================================
console.log(`${BOLD}[4/4] Writing public/sitemap.xml...${RESET}`)

const today = new Date().toISOString().slice(0, 10)   // YYYY-MM-DD

const publicRoutes = [
  { loc: `${siteUrl}/`,          lastmod: '2026-01-01', changefreq: 'weekly',  priority: '1.0' },
  { loc: `${siteUrl}/app`,       lastmod: '2026-01-01', changefreq: 'monthly', priority: '0.8' },
  { loc: `${siteUrl}/subscribe`, lastmod: '2026-01-01', changefreq: 'monthly', priority: '0.9' },
]

const urlEntries = publicRoutes.map(r =>
  `  <url>\n` +
  `    <loc>${r.loc}</loc>\n` +
  `    <lastmod>${r.lastmod}</lastmod>\n` +
  `    <changefreq>${r.changefreq}</changefreq>\n` +
  `    <priority>${r.priority}</priority>\n` +
  `  </url>`
).join('\n')

const sitemapXml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
  `        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n` +
  `        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9\n` +
  `          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n` +
  `\n` +
  `  <!--\n` +
  `    C.R.A.T.E. Public Sitemap\n` +
  `    Generated by scripts/launch.js on ${today}\n` +
  `    Site: ${siteUrl}\n` +
  `    Routes: / | /app | /subscribe\n` +
  `    Admin, sandbox, and session routes are excluded (noindex).\n` +
  `  -->\n` +
  `\n` +
  urlEntries + '\n' +
  `\n` +
  `</urlset>\n`

const sitemapWritten = writeFile('public/sitemap.xml', sitemapXml)
if (sitemapWritten) {
  console.log(`${GREEN}  ok  public/sitemap.xml written — ${publicRoutes.length} public routes indexed${RESET}`)
  publicRoutes.forEach(r => {
    console.log(`${DIM}      ${r.loc} [${r.changefreq}, priority ${r.priority}]${RESET}`)
  })
}

// =============================================================================
// Summary
// =============================================================================
const bar = '-'.repeat(60)
console.log(`\n${BOLD}${CYAN}${bar}${RESET}`)

if (totalWarnings === 0) {
  console.log(`${BOLD}${GREEN}  ok  Launch gate PASSED -- ${totalWarnings} warnings${RESET}`)
  console.log(`${GREEN}     All manifest fields resolved. All flags live.${RESET}`)
  console.log(`${GREEN}     robots.txt and sitemap.xml are production-ready.${RESET}`)
  console.log(`${GREEN}     Platform is ready for production promotion.${RESET}`)
} else {
  console.log(`${BOLD}${YELLOW}  !   Launch gate WARNING -- ${totalWarnings} outstanding item(s)${RESET}`)
  console.log(`${YELLOW}     Resolve the credential warnings before production deployment.${RESET}`)
  console.log(`${YELLOW}     robots.txt and sitemap.xml have been prepared regardless.${RESET}`)
  console.log(`${YELLOW}     Each warning = one credential or decision still outstanding.${RESET}`)
}

console.log(`${BOLD}${CYAN}${bar}${RESET}`)
console.log(`${DIM}\n  Exit code: 0 (warnings are advisory -- CI will not block)\n${RESET}`)

// Always exit 0 — warnings never block CI pipeline
process.exit(0)
