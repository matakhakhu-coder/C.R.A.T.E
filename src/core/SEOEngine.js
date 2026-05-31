// ── src/core/SEOEngine.js ─────────────────────────────────────────────────────
// Phase 11 — SEO metadata orchestration engine.
// Manages document <head> programmatically after each single-pass hydration.
// Called from main.js immediately after every app.innerHTML write.
//
// HPCSA guardrail: Zero diagnostic, psychometric, or clinical terminology in
// any public meta string, JSON-LD schema field, or OG property. All public-
// facing copy uses: "developmental play assistant", "STEAM interest exploration",
// "personalised activity kit", "play patterns". No clinical framing.
//
// Boundary protection: SEOEngine operates only on route strings and static
// configuration. No child interaction data, play trajectory vectors, or
// session telemetry ever enters this module.

import { BRAND } from '@/core/manifest.js'

// ── Constants ─────────────────────────────────────────────────────────────────
const _TITLE_SUFFIX  = 'C.R.A.T.E. — Play Interest Exploration'
const _SITE_NAME     = 'C.R.A.T.E.'
const _STAGING_URL   = 'https://crate-platform.vercel.app'
const _OG_IMAGE_PATH = '/icons/og-image.png'

// ── Route metadata table ──────────────────────────────────────────────────────
// All public descriptions use HPCSA-compliant, growth-framed language only.
const _ROUTE_META = Object.freeze({
  '/': Object.freeze({
    title:       'Home',
    description: 'A developmental play assistant and STEAM interest exploration tool. ' +
                 'Personalised monthly physical activity kits curated from your child\'s ' +
                 'natural play patterns — delivered across South Africa.',
    noIndex:     false,
  }),
  '/app': Object.freeze({
    title:       'Parent Portal',
    description: 'Track your child\'s play interests and manage your personalised STEAM ' +
                 'exploration kit subscription. Secure, POPIA-compliant parent dashboard.',
    noIndex:     false,
  }),
  '/subscribe': Object.freeze({
    title:       'Choose Your Plan',
    description: 'Monthly subscription plans for personalised physical STEAM activity kits ' +
                 'delivered to your door across South Africa. Plans from R650 per month.',
    noIndex:     false,
  }),
  '/sandbox': Object.freeze({
    title:       'Play Sandbox',
    description: 'Open-ended digital physics play environment for children.',
    noIndex:     true,   // Child-facing interactive tool — not for public search indexing
  }),
  '/admin': Object.freeze({
    title:       'Admin',
    description: 'Internal administration panel.',
    noIndex:     true,   // Always noindex — internal tool
  }),
})

// Fallback meta for unmatched routes and error states
const _DEFAULT_META = Object.freeze({
  title:       'Page Not Found',
  description: _TITLE_SUFFIX,
  noIndex:     false,
})

// =============================================================================
// EXPORTED: updateForRoute(route, ctx)
// Called from main.js after every app.innerHTML write.
// Selects the correct meta configuration for the active route and
// injects structured data where appropriate.
// =============================================================================
export function updateForRoute(route, ctx = {}) {
  // Admin routes always noindex regardless of config entry
  const isAdmin = route === '/admin' || route.startsWith('/admin/')
  const meta    = _ROUTE_META[route] || _DEFAULT_META

  updateMeta({
    title:       meta.title,
    description: meta.description,
    path:        route,
    noIndex:     meta.noIndex || isAdmin,
  })

  // Inject structured data for high-value public routes
  if (route === '/') {
    injectStructuredData('Organization', _buildOrgSchema())
    injectStructuredData('WebSite',      _buildWebSiteSchema())
  }

  if (route === '/subscribe') {
    // Inject all three subscription products for rich results
    injectStructuredData('Product', _buildProductSchema('explorer'))
  }
}

// =============================================================================
// EXPORTED: updateMeta({ title, description, path, noIndex })
// Directly updates all document <head> metadata elements.
// Creates elements if they do not exist. Idempotent — safe to call repeatedly.
// =============================================================================
export function updateMeta({ title = '', description = '', path = '/', noIndex = false }) {
  const siteUrl  = (BRAND?.domain ? `https://${BRAND.domain}` : _STAGING_URL)
  const fullUrl  = `${siteUrl}${path}`
  const fullTitle = title ? `${title} | ${_TITLE_SUFFIX}` : _TITLE_SUFFIX
  const robots    = noIndex ? 'noindex, nofollow' : 'index, follow'

  // ── 1. Document title ────────────────────────────────────────────────────
  document.title = fullTitle

  // ── 2. Standard meta tags ────────────────────────────────────────────────
  _setMeta('name', 'description',  description)
  _setMeta('name', 'robots',       robots)
  _setMeta('name', 'author',       BRAND?.tradingName || _SITE_NAME)

  // ── 3. Canonical link ────────────────────────────────────────────────────
  _setLink('canonical', fullUrl)

  // ── 4. Open Graph tags ───────────────────────────────────────────────────
  _setMeta('property', 'og:type',        'website')
  _setMeta('property', 'og:site_name',   BRAND?.tradingName || _SITE_NAME)
  _setMeta('property', 'og:title',       fullTitle)
  _setMeta('property', 'og:description', description)
  _setMeta('property', 'og:url',         fullUrl)
  _setMeta('property', 'og:image',       `${siteUrl}${_OG_IMAGE_PATH}`)
  _setMeta('property', 'og:image:alt',   `${_SITE_NAME} — Play Interest Exploration`)
  _setMeta('property', 'og:locale',      'en_ZA')

  // ── 5. Twitter card ──────────────────────────────────────────────────────
  _setMeta('name', 'twitter:card',        'summary_large_image')
  _setMeta('name', 'twitter:title',       fullTitle)
  _setMeta('name', 'twitter:description', description)
  _setMeta('name', 'twitter:image',       `${siteUrl}${_OG_IMAGE_PATH}`)
}

// =============================================================================
// EXPORTED: injectStructuredData(schemaType, payload)
// Creates or replaces a JSON-LD <script> element in <head>.
// Each schemaType is deduplicated — only one block per type at any time.
// =============================================================================
export function injectStructuredData(schemaType, payload) {
  if (!payload) return

  // Remove any existing block of the same schema type to avoid duplicates
  const existing = document.querySelector(`script[data-schema-type="${schemaType}"]`)
  if (existing) existing.remove()

  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.setAttribute('data-schema-type', schemaType)
  script.textContent = JSON.stringify(payload)
  document.head.appendChild(script)
}

// =============================================================================
// PRIVATE: Schema builders
// All schema fields use growth-framed, HPCSA-compliant descriptions only.
// Null-safe: BRAND fields may be null if credentials are not yet confirmed.
// =============================================================================

// ── Organization schema ───────────────────────────────────────────────────────
function _buildOrgSchema() {
  const siteUrl  = BRAND?.domain ? `https://${BRAND.domain}` : _STAGING_URL
  const socials  = Object.values(BRAND?.social || {}).filter(Boolean)

  const schema = {
    '@context':    'https://schema.org',
    '@type':       'Organization',
    'name':        BRAND?.tradingName    || _SITE_NAME,
    'legalName':   BRAND?.legalEntityName || undefined,
    'description': 'Developmental Play Assistant and STEAM Interest Exploration Tool — ' +
                   'personalised monthly physical activity kits curated from children\'s ' +
                   'natural play patterns. South Africa.',
    'url':         siteUrl,
    'logo':        `${siteUrl}/icons/logo.png`,
    'foundingDate': BRAND?.foundingYear   || undefined,
    'areaServed': {
      '@type': 'Country',
      'name':  'South Africa',
    },
    'address': BRAND?.contact?.address ? {
      '@type':           'PostalAddress',
      'addressCountry':  'ZA',
      'streetAddress':   BRAND.contact.address,
    } : undefined,
    'contactPoint': BRAND?.contact?.email ? [{
      '@type':            'ContactPoint',
      'email':            BRAND.contact.email,
      'contactType':      'customer support',
      'areaServed':       'ZA',
      'availableLanguage': ['English', 'Afrikaans'],
    }] : undefined,
  }

  if (socials.length > 0) schema['sameAs'] = socials

  // Remove undefined keys before serializing
  return _stripUndefined(schema)
}

// ── WebSite schema ────────────────────────────────────────────────────────────
function _buildWebSiteSchema() {
  const siteUrl = BRAND?.domain ? `https://${BRAND.domain}` : _STAGING_URL
  return {
    '@context':   'https://schema.org',
    '@type':      'WebSite',
    'name':       BRAND?.tradingName || _SITE_NAME,
    'url':        siteUrl,
    'description':'Developmental Play Assistant and STEAM Interest Exploration Tool',
    'inLanguage': ['en-ZA', 'af-ZA'],
  }
}

// ── Product schema (subscription tiers) ──────────────────────────────────────
// Models subscription plans as premium curated physical activity kits.
// HPCSA: No diagnostic or psychometric terminology — kit-framed language only.
function _buildProductSchema(planId) {
  const siteUrl = BRAND?.domain ? `https://${BRAND.domain}` : _STAGING_URL

  const plans = {
    starter: {
      name:        'C.R.A.T.E. Starter Kit — Monthly Play Activity Subscription',
      description: 'Monthly personalised physical STEAM activity kit focused on exploration ' +
                   'and spatial play interests. Bilingual challenge cards included. ' +
                   'Delivered across South Africa via Pudo or Paxi.',
      price:       '650',
    },
    explorer: {
      name:        'C.R.A.T.E. Explorer Pack — Monthly Play Activity Subscription',
      description: 'Monthly personalised physical STEAM activity kit with expanded mechanical ' +
                   'toolkit, bilingual challenge card sets, and full play trajectory dashboard. ' +
                   'Delivered across South Africa.',
      price:       '850',
    },
    architect: {
      name:        'C.R.A.T.E. Architect Bundle — Monthly Play Activity Subscription',
      description: 'Monthly personalised physical STEAM activity kit covering all six play ' +
                   'interest dimensions with custom-printed bilingual challenge cards and ' +
                   'priority delivery across South Africa.',
      price:       '1150',
    },
  }

  const plan = plans[planId] || plans.explorer

  return {
    '@context':    'https://schema.org',
    '@type':       'Product',
    'name':        plan.name,
    'description': plan.description,
    'brand': {
      '@type': 'Brand',
      'name':  BRAND?.tradingName || _SITE_NAME,
    },
    'category': 'Educational Toys & Activities',
    'offers': {
      '@type':           'Offer',
      'price':           plan.price,
      'priceCurrency':   'ZAR',
      'priceValidUntil': '2027-01-01',
      'availability':    'https://schema.org/InStock',
      'url':             `${siteUrl}/subscribe`,
      'areaServed': {
        '@type': 'Country',
        'name':  'South Africa',
      },
      'seller': {
        '@type': 'Organization',
        'name':  BRAND?.tradingName || _SITE_NAME,
      },
    },
  }
}

// =============================================================================
// PRIVATE: DOM helpers
// =============================================================================

// ── _setMeta(attr, attrVal, content) ─────────────────────────────────────────
// Finds or creates a <meta> element and sets its content attribute.
function _setMeta(attr, attrVal, content) {
  if (content == null || content === '') return
  let el = document.querySelector(`meta[${attr}="${attrVal}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, attrVal)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

// ── _setLink(rel, href) ───────────────────────────────────────────────────────
// Finds or creates a <link> element with the given rel and sets its href.
function _setLink(rel, href) {
  if (!href) return
  let el = document.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

// ── _stripUndefined(obj) ──────────────────────────────────────────────────────
// Recursively removes undefined values so JSON.stringify produces clean output.
function _stripUndefined(obj) {
  return JSON.parse(JSON.stringify(obj))
}
