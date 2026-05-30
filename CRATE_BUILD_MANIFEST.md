# CRATE_BUILD_MANIFEST.md — The Ledger
## C.R.A.T.E. · Cognitive Radar & Adaptive Trajectory Engine

> This document records confirmed external reality only.
> It changes when a fact is operationally confirmed — a credential arrives,
> a decision is made, an asset is delivered.
> Unconfirmed facts are marked `TBC — [what is needed]`.
> This document and `CRATE_ROADMAP.md` must remain in sync on phase status.

---

## Phase Status Table

| Phase | Name | Status |
|---|---|---|
| 0 | Substrate | Pending |
| 1 | Public Marketing Shell | Pending |
| 2 | Parent Onboarding & POPIA Consent | Pending |
| 3 | Digital Sandbox — Physics Play Environment | Pending |
| 4 | Telemetry Engine & Assessment Core | Pending |
| 5 | Parent Dashboard — Growth Trajectory | Pending |
| 6 | Crate Recommendation Engine (70/20/10) | Pending |
| 7 | Subscription & Payment | Pending |
| 8 | Admin Shell & Order Management | Pending |
| 9 | Supply Chain & Delivery Integration | Pending |
| 10 | ML Upgrade Layer (Phase 2 Architecture) | Pending |
| 11 | SEO & Launch Gate | Pending |

---

## Business / Brand Identity

| Field | Value | Status |
|---|---|---|
| Legal Business Name | — | TBC — registered entity name required |
| Trading Name / Brand Name | C.R.A.T.E. | Confirmed (from strategic blueprint) |
| Full Expansion | Cognitive Radar & Adaptive Trajectory Engine | Confirmed |
| Tagline | — | TBC — brand copywriter decision required |
| Platform Legal Positioning | "Developmental play assistant" and "STEAM interest exploration tool" | Confirmed (HPCSA compliance mandate) |
| Primary Domain | — | TBC — domain registration required |
| Staging Domain | https://crate-platform.vercel.app | Confirmed — Phase 0.5 |
| Company Registration Number | — | TBC — CIPC registration required |
| VAT Number | — | TBC — SARS registration required |
| B-BBEE Status / Level | — | TBC — pending ownership structure confirmation |
| NPO / Section 18A Status | — | TBC — required for B-BBEE corporate funding loop |
| Founding Year | — | TBC |
| Headquarters / Registered Address | — | TBC |

---

## Contact & Social

| Field | Value | Status |
|---|---|---|
| Founder / Operator Name | — | TBC |
| Founder Email | matamelaramovha8@gmail.com | Confirmed (operator email on file) |
| Business Email | — | TBC — business domain email required |
| WhatsApp Contact Number | — | TBC |
| Phone Number | — | TBC |
| Instagram Handle | — | TBC |
| Facebook Page | — | TBC |
| LinkedIn Page | — | TBC |
| X (Twitter) Handle | — | TBC |
| TikTok Handle | — | TBC |
| YouTube Channel | — | TBC |

---

## Product / Service Catalogue

### Core Product: Digital + Physical Subscription

| Field | Value | Status |
|---|---|---|
| Product Name | C.R.A.T.E. Subscription | Confirmed (concept) |
| Core Play Environment | Physics sandbox (digital, offline-first) | Confirmed |
| Physical Deliverable | Curated STEAM learning kit (subscription crate) | Confirmed |
| Curation Algorithm | 70/20/10 behavioral recommendation engine | Confirmed |
| Target Age Range | ~3–12 years | Confirmed [Inferred from blueprint — verify exact range with operator] |
| Language Support | English, Afrikaans (bilingual POD challenge cards) | Confirmed |

### Subscription Tiers

| Tier | Price | Frequency | Contents | Status |
|---|---|---|---|---|
| Starter | TBC | TBC | TBC | TBC — pricing decision required |
| Standard | TBC | TBC | TBC | TBC — pricing decision required |
| Premium | TBC | TBC | TBC | TBC — pricing decision required |

### Physical Kit Components (confirmed material types)

| Component | Specification | Status |
|---|---|---|
| Structural Baseplates | Sustainable pine, plywood, MDF — CNC/laser machined | Confirmed |
| Chassis Components | Balsa chassis, pegs — produced locally (Woodinq / Laserlink) | Confirmed |
| Accessory Packs | Gears, winders, specialized components | Confirmed (type) / TBC (exact SKUs) |
| Challenge Cards | Print-on-demand, bilingual (English + Afrikaans) | Confirmed |
| Storytelling Inserts | Print-on-demand, bilingual | Confirmed |
| Sticker Packs | Print-on-demand | Confirmed |

---

## Integration Registry

### Authentication

| Field | Value |
|---|---|
| Service Purpose | Parent account creation, login, session management |
| Provider | TBC — must be SA-sovereign or support SA data residency |
| Config Key Path | `BRAND.integrations.auth.endpoint`, `BRAND.integrations.auth.apiKey` |
| Status | `null` — TBC |

### Payment

| Field | Value |
|---|---|
| Service Purpose | Subscription billing, recurring payments |
| Provider | TBC — PayFast or Peach Payments likely (SA-native) |
| Config Key Path | `BRAND.integrations.payment.endpoint`, `BRAND.integrations.payment.merchantId`, `BRAND.integrations.payment.merchantKey` |
| Status | `null` — TBC |

### Database A — PII Store

| Field | Value |
|---|---|
| Service Purpose | Parent name, email, phone, delivery address, consent logs — POPIA sovereign |
| Provider | TBC — AWS Cape Town (af-south-1) or Azure Johannesburg required |
| Config Key Path | `BRAND.integrations.piiStore.connectionString` |
| Data Fields | parentName, parentEmail, parentPhone, deliveryAddress (hashed), consentLog, otpRecord |
| Status | `null` — TBC |

### Database B — Telemetry Engine

| Field | Value |
|---|---|
| Service Purpose | Pseudonymized play session data, micro-signals, competency vectors — POPIA sovereign |
| Provider | TBC — AWS Cape Town (af-south-1) or Azure Johannesburg required |
| Config Key Path | `BRAND.integrations.telemetry.connectionString` |
| Data Fields | pseudoUUID, rawSandboxActions, microSignalScores, competencyVectors, sessionTimestamps |
| Status | `null` — TBC |

### OTP / SMS Consent Verification

| Field | Value |
|---|---|
| Service Purpose | POPIA competent person consent — OTP verification on registration |
| Provider | TBC — SA mobile number pool required |
| Config Key Path | `BRAND.integrations.otp.apiKey`, `BRAND.integrations.otp.endpoint` |
| Status | `null` — TBC |

### Delivery — Pudo Smart Lockers

| Field | Value |
|---|---|
| Service Purpose | Suburban crate delivery via 1,500+ smart lockers. Locker-to-locker from R60; locker-to-door from R70 |
| Provider | Pudo |
| Config Key Path | `BRAND.integrations.pudo.apiKey`, `BRAND.integrations.pudo.endpoint` |
| Status | `null` — TBC |

### Delivery — PEP Paxi

| Field | Value |
|---|---|
| Service Purpose | Mass market crate pickup via 2,800+ PEP/Tekkie Town/Shoe City points for R59.95 |
| Provider | PEP Paxi |
| Config Key Path | `BRAND.integrations.paxi.apiKey`, `BRAND.integrations.paxi.endpoint` |
| Status | `null` — TBC |

### Print-on-Demand

| Field | Value |
|---|---|
| Service Purpose | Bilingual challenge cards, storytelling inserts, sticker packs — locally printed on crate dispatch |
| Provider | TBC — SA local POD station required |
| Config Key Path | `BRAND.integrations.pod.apiKey`, `BRAND.integrations.pod.endpoint` |
| Status | `null` — TBC |

### Transactional Email

| Field | Value |
|---|---|
| Service Purpose | Registration confirmation, consent receipts, crate dispatch notifications |
| Provider | TBC |
| Config Key Path | `BRAND.integrations.email.apiKey`, `BRAND.integrations.email.fromAddress` |
| Status | `null` — TBC |

### Asset Storage

| Field | Value |
|---|---|
| Service Purpose | Crate imagery, sandbox asset sprites, challenge card PDFs |
| Provider | TBC — AWS S3 Cape Town (af-south-1) required for POPIA compliance |
| Config Key Path | `BRAND.integrations.storage.bucket`, `BRAND.integrations.storage.region`, `BRAND.integrations.storage.accessKey` |
| Status | `null` — TBC |

### ML Assessment Layer (Phase 2 only)

| Field | Value |
|---|---|
| Service Purpose | Phase 2 architecture — Random Forest / t-SNE model endpoint. Activates at 10,000+ active profiles |
| Provider | TBC — SA-sovereign ML hosting required |
| Config Key Path | `BRAND.integrations.mlAssessment.endpoint`, `BRAND.integrations.mlAssessment.apiKey` |
| Status | `null` — TBC (Phase 2 requirement only) |

---

## Feature Flags

All flags default to `true` at project start (full simulation mode).
Flipping one flag to `false` is the only code change needed to go live for that dependency.

| Flag Key | Controls | Resolves to `false` When |
|---|---|---|
| `authSimulated` | Parent registration, login, session tokens — all fake | Auth provider API key confirmed and set in manifest |
| `paymentSimulated` | Subscription checkout, recurring billing — all fake | Payment gateway credentials confirmed and set |
| `telemetrySimulated` | Micro-signal upload to Database B — stores in localStorage only | Telemetry DB connection string confirmed and set |
| `piiStoreSimulated` | Parent PII writes to Database A — stores in localStorage only | PII Store DB connection string confirmed and set |
| `otpSimulated` | Consent OTP verification — auto-passes with code "000000" in [SIM] | SMS provider API key confirmed and set |
| `deliverySimulated` | Pudo + Paxi shipping label generation — returns fake tracking | Pudo API key AND Paxi API key both confirmed and set |
| `podSimulated` | Challenge card PDF print dispatch — logs payload only | POD provider credentials confirmed and set |
| `emailSimulated` | Transactional email sends — console.log only | Email provider API key confirmed and set |
| `storageSimulated` | Asset uploads — base64 localStorage persistence only | S3 Cape Town bucket + IAM credentials confirmed and set |
| `mlAssessmentSimulated` | Phase 2 ML service calls — returns static demo profile | ML service endpoint confirmed, active profile count ≥ 10,000 |

---

## Supply Chain Partners (Confirmed)

| Partner | Role | Location | Status |
|---|---|---|---|
| Woodinq | CNC machining, laser cutting — produces structural baseplates | South Africa | Confirmed (named in blueprint) |
| Laserlink | CNC machining, laser cutting — alternative/secondary supplier | South Africa | Confirmed (named in blueprint) |
| Pudo | Smart locker delivery network (1,500+ lockers) | South Africa (nationwide) | Confirmed |
| PEP Paxi | Store-to-store pickup network (2,800+ points) | South Africa (nationwide) | Confirmed |

### Supply Chain — TBC Fields

| Field | Status |
|---|---|
| Primary POD printing partner name | TBC |
| Fulfillment hub / warehouse address | TBC |
| Cardboard packaging supplier | TBC |
| Accessory pack suppliers (gears, winders) | TBC |

---

## Asset Inventory

| Asset | Specification | Status |
|---|---|---|
| Brand Logo (SVG) | Primary logo, white variant, icon-only variant | TBC |
| Brand Logo (PNG) | 1x and 2x for email and social | TBC |
| Favicon | 32×32 and 180×180 (Apple touch) | TBC |
| OG / Social Share Image | 1200×630 | TBC |
| Sandbox Sprite Sheet | Physics objects, tools, decorative elements | TBC |
| Dimension Illustration Set | Six dimensional icons (Curiosity, Spatial, Systems, Narrative, Mechanical, Divergent) | TBC |
| Crate Photography | Hero product shot, open crate shot, in-use child shot | TBC |
| Founder Headshot | Professional 800×800+ | TBC |
| Brand Font Files | Nunito (700, 800), Inter (400, 500, 600) | Via Google Fonts CDN — confirmed approach |

---

## Outstanding Items Before Production

The following items must be resolved before any production deployment. This is the
client data and credential collection checklist.

1. Legal business name (CIPC registration)
2. Primary domain name (registration + DNS configuration — staging confirmed: https://crate-platform.vercel.app)
3. B-BBEE structure and NPO / Section 18A foundation establishment
4. VAT registration number
5. Physical registered address
6. Business email address (domain-linked)
7. WhatsApp business contact number
8. All social media handles / page URLs
9. Subscription tier pricing decision (Starter, Standard, Premium — price + contents)
10. Subscription billing provider selection and merchant credentials (PayFast or Peach Payments)
11. SA-sovereign auth provider selection and API credentials
12. Database A (PII Store) — connection string to SA-sovereign instance
13. Database B (Telemetry Engine) — connection string to SA-sovereign instance
14. SMS / OTP provider selection and API credentials (SA mobile number pool)
15. Pudo API key + production endpoint
16. PEP Paxi API key + production endpoint
17. POD printing partner selection, API credentials, and pricing
18. Transactional email provider selection and API key
19. AWS S3 Cape Town bucket name + IAM access credentials
20. Fulfillment hub address (for kitting operations)
21. Exact target age range confirmation (blueprint suggests 3–12)
22. Brand logo files (SVG + PNG)
23. Sandbox sprite sheet and dimension illustration set
24. Crate product photography
25. Tagline and full brand copy guide
26. Physics engine confirmation (Matter.js assumed — verify with operator)
27. Mobile app vs. PWA decision (affects offline SQLite vs. IndexedDB implementation)
28. Formal HPCSA legal clearance opinion (confirming platform metrics are not a psychological act under Act 56 of 1974)
