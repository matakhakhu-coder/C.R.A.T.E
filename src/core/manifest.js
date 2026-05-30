// ── src/core/manifest.js ────────────────────────────────────────────────────
// BRAND is the single source of truth for all business facts and integration
// credentials. Every null value here corresponds to a TBC item in
// CRATE_BUILD_MANIFEST.md. Never hardcode business facts in components — always
// read from BRAND. When a credential arrives, update this file only.
// Flipping FLAGS in flags.js to false is the only other change needed to go live.

export const BRAND = Object.freeze({

  // ── Identity ───────────────────────────────────────────────────────────────
  tradingName:        'C.R.A.T.E.',
  fullName:           'Cognitive Radar & Adaptive Trajectory Engine',
  // Legal positioning — fixed by HPCSA compliance mandate. Never change this framing.
  legalPositioning:   'Developmental play assistant and STEAM interest exploration tool',
  legalEntityName:    null,   // TBC — CIPC registration required
  registrationNumber: null,   // TBC — CIPC registration required
  vatNumber:          null,   // TBC — SARS registration required
  tagline:            null,   // TBC — brand copywriter decision required
  foundingYear:       null,   // TBC

  // ── Domains ────────────────────────────────────────────────────────────────
  domain:      null,   // TBC — domain registration required
  stagingUrl:  'https://crate-platform.vercel.app',   // Confirmed — Phase 0.5
  adminPath:   '/admin',

  // ── Contact ────────────────────────────────────────────────────────────────
  contact: Object.freeze({
    email:    null,   // TBC — business domain email required
    whatsApp: null,   // TBC — WhatsApp business number required
    phone:    null,   // TBC
    address:  null,   // TBC — registered address required
  }),

  // ── Social ─────────────────────────────────────────────────────────────────
  social: Object.freeze({
    instagram: null,   // TBC
    facebook:  null,   // TBC
    linkedin:  null,   // TBC
    x:         null,   // TBC
    tiktok:    null,   // TBC
    youtube:   null,   // TBC
  }),

  // ── Integration Credentials ────────────────────────────────────────────────
  // All null at project start. Flip FLAGS.xyzSimulated to false when credential arrives.
  // Never log these values — even in [SIM] mode.
  integrations: Object.freeze({

    auth: Object.freeze({
      endpoint: null,   // TBC — SA-sovereign auth provider
      apiKey:   null,   // TBC
    }),

    payment: Object.freeze({
      endpoint:    null,   // TBC — PayFast or Peach Payments
      merchantId:  null,   // TBC
      merchantKey: null,   // TBC
    }),

    telemetry: Object.freeze({
      // Database B — behavioral signals only, zero PII fields
      connectionString: null,   // TBC — AWS Cape Town / Azure Johannesburg
    }),

    piiStore: Object.freeze({
      // Database A — PII fields only, zero telemetry fields
      connectionString: null,   // TBC — AWS Cape Town / Azure Johannesburg
    }),

    otp: Object.freeze({
      endpoint: null,   // TBC — SA mobile number pool
      apiKey:   null,   // TBC
    }),

    delivery: Object.freeze({
      pudo: Object.freeze({
        endpoint: null,   // TBC — Pudo API
        apiKey:   null,   // TBC
      }),
      paxi: Object.freeze({
        endpoint: null,   // TBC — PEP Paxi API
        apiKey:   null,   // TBC
      }),
    }),

    pod: Object.freeze({
      endpoint: null,   // TBC — SA local print-on-demand station
      apiKey:   null,   // TBC
    }),

    email: Object.freeze({
      apiKey:      null,   // TBC — transactional email provider
      fromAddress: null,   // TBC — domain-linked sender address
    }),

    storage: Object.freeze({
      bucket:    null,   // TBC — AWS S3 Cape Town (af-south-1)
      region:    null,   // TBC — must be af-south-1 for POPIA compliance
      accessKey: null,   // TBC — IAM access key
    }),

    mlAssessment: Object.freeze({
      // Phase 2 only — activates at 10,000+ active profiles
      endpoint: null,   // TBC — SA-sovereign ML service endpoint
      apiKey:   null,   // TBC
    }),

  }),

  // ── Demo / Fallback Data ───────────────────────────────────────────────────
  // Used when localStorage is empty. Never hardcode demo data inside modules.
  demo: Object.freeze({
    sessions: Object.freeze([]),
    orders:   Object.freeze([]),
    profile:  null,
  }),

})
