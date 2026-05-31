# PROD_CREDENTIALS_MANIFEST.md
## C.R.A.T.E. — Production Infrastructure Credential & Switch-Flip Registry

> **Purpose:** This document is the definitive pre-production infrastructure audit sheet.
> It maps every simulated integration parameter in `src/core/manifest.js` to its
> production-grade credential, documents the provider connection specifications,
> defines the exact switch-flip sequence to exit simulation mode, and attests to
> full South African POPIA and HPCSA compliance for each live data channel.
>
> **Authority:** Read before any live credential is inserted into the codebase.
> Updated each time a TBC field in `CRATE_BUILD_MANIFEST.md` resolves to a confirmed value.
>
> **Security note:** Several credentials listed here are server-side secrets that must
> NEVER appear in a client-side JavaScript bundle. Where marked `[SERVER-SIDE ONLY]`,
> the credential must be injected exclusively via a Vercel Serverless Function or
> an Edge Config secret — never in `manifest.js` as a string literal accessible to
> browser tooling. See Tier 3.2 for proxy architecture guidance.

---

## Tier 3.1 — Environment Variable Mapping Matrix

The following table links every null field in `src/core/manifest.js` to its
corresponding production shell variable name, the BRAND key path where it lives
in the application, the integration adapter file that reads it, and its
simulation-to-live switch flag in `src/core/flags.js`.

---

### 3.1.A — Business Identity

| BRAND Key Path | Environment Variable | Type | Current Value | Notes |
|---|---|---|---|---|
| `BRAND.legalEntityName` | `CRATE_LEGAL_ENTITY_NAME` | String | `null` | CIPC-registered entity name |
| `BRAND.registrationNumber` | `CRATE_REGISTRATION_NUMBER` | String | `null` | CIPC registration number |
| `BRAND.vatNumber` | `CRATE_VAT_NUMBER` | String | `null` | SARS VAT registration number |
| `BRAND.tagline` | `CRATE_TAGLINE` | String | `null` | Brand copywriter decision |
| `BRAND.foundingYear` | `CRATE_FOUNDING_YEAR` | Integer | `null` | Year of incorporation |
| `BRAND.domain` | `CRATE_PRIMARY_DOMAIN` | String | `null` | Primary production domain (e.g. `crate.co.za`) |
| `BRAND.stagingUrl` | *(confirmed)* | String | `https://crate-platform.vercel.app` | **Resolved — Phase 0.5** |

---

### 3.1.B — Contact & Social

| BRAND Key Path | Environment Variable | Current Value | Notes |
|---|---|---|---|
| `BRAND.contact.email` | `CRATE_CONTACT_EMAIL` | `null` | Business domain email (e.g. `hello@crate.co.za`) |
| `BRAND.contact.whatsApp` | `CRATE_WHATSAPP_NUMBER` | `null` | SA WhatsApp Business number |
| `BRAND.contact.phone` | `CRATE_CONTACT_PHONE` | `null` | SA landline or mobile number |
| `BRAND.contact.address` | `CRATE_REGISTERED_ADDRESS` | `null` | CIPC registered address |
| `BRAND.social.instagram` | `CRATE_INSTAGRAM_URL` | `null` | Full profile URL |
| `BRAND.social.facebook` | `CRATE_FACEBOOK_URL` | `null` | Full page URL |
| `BRAND.social.linkedin` | `CRATE_LINKEDIN_URL` | `null` | Full company URL |
| `BRAND.social.x` | `CRATE_X_URL` | `null` | Full X/Twitter profile URL |
| `BRAND.social.tiktok` | `CRATE_TIKTOK_URL` | `null` | Full TikTok profile URL |
| `BRAND.social.youtube` | `CRATE_YOUTUBE_URL` | `null` | Full YouTube channel URL |

---

### 3.1.C — Parent Authentication

| BRAND Key Path | Environment Variable | Security Level | Adapter | Flag |
|---|---|---|---|---|
| `BRAND.integrations.auth.endpoint` | `AUTH_API_ENDPOINT` | Moderate | `src/core/integrations/auth.js` | `authSimulated` |
| `BRAND.integrations.auth.apiKey` | `AUTH_API_KEY` | **[SERVER-SIDE ONLY]** | `src/core/integrations/auth.js` | `authSimulated` |

**Provider requirement:** SA-sovereign hosting. Supabase (Johannesburg region `af-south-1`),
Firebase (with data residency lock to ZA), or a custom JWT service hosted on AWS Cape Town.
Standard REST endpoint pattern: `POST /auth/register`, `POST /auth/login`, `POST /auth/verify`.

---

### 3.1.D — Subscription Payment Processing

| BRAND Key Path | Environment Variable | Security Level | Adapter | Flag |
|---|---|---|---|---|
| `BRAND.integrations.payment.endpoint` | `PAYMENT_API_ENDPOINT` | Moderate | `src/core/integrations/payment.js` | `paymentSimulated` |
| `BRAND.integrations.payment.merchantId` | `MERCHANT_ID` | Moderate | `src/core/integrations/payment.js` | `paymentSimulated` |
| `BRAND.integrations.payment.merchantKey` | `MERCHANT_KEY` | **[SERVER-SIDE ONLY]** | `src/core/integrations/payment.js` | `paymentSimulated` |
| *(PayFast only)* | `PAYFAST_PASSPHRASE` | **[SERVER-SIDE ONLY]** | `src/core/integrations/payment.js` | `paymentSimulated` |
| *(PayFast only)* | `PAYFAST_ITN_SECRET` | **[SERVER-SIDE ONLY]** | *(ITN verification endpoint)* | `paymentSimulated` |

**Provider candidates:** PayFast (`payfast.co.za/developers`) or Peach Payments
(`peachpayments.com/developers`). Both are SA-domiciled payment gateways with ZAR
natively supported. `MERCHANT_KEY` and `PAYFAST_PASSPHRASE` are signing secrets —
they must NEVER reach the browser bundle. All payment creation calls must route
through a Vercel Serverless Function (`/api/create-subscription`).

**Recurring billing note:** Subscription tokens generated at first payment must be
stored server-side. The client never re-transmits card data after initial tokenization.

---

### 3.1.E — Database A — PII Store (POPIA: Personal Identity Records)

| BRAND Key Path | Environment Variable | Security Level | Adapter | Flag |
|---|---|---|---|---|
| `BRAND.integrations.piiStore.connectionString` | `DATABASE_A_SECURE_CONN` | **[SERVER-SIDE ONLY]** | `src/core/integrations/piiStore.js` | `piiStoreSimulated` |

**Sovereign hosting requirement (POPIA Section 72):**
Must be hosted exclusively within South Africa's borders.
Acceptable regions: `AWS af-south-1` (Cape Town) or `Azure southafricanorth` (Johannesburg).
No transborder data transfer without prior Information Regulator authorization.

**Schema isolation mandate:**
Database A holds ONLY: `parentName`, `parentEmail`, `parentPhone`,
`hashedDeliveryAddress`, `consentLog`, `otpVerificationRecord`.
It must never receive `pseudoUUID`, `microSignalScores`, `competencyVectors`,
or any field from Database B. This isolation is verified at the adapter level
by `_checkForTelemetryFields()` in `piiStore.js`.

---

### 3.1.F — Database B — Play Signal Engine (POPIA: Anonymised Behavioral Data)

| BRAND Key Path | Environment Variable | Security Level | Adapter | Flag |
|---|---|---|---|---|
| `BRAND.integrations.telemetry.connectionString` | `DATABASE_B_SOVEREIGN_CONN` | **[SERVER-SIDE ONLY]** | `src/core/integrations/telemetry.js` | `telemetrySimulated` |

**Sovereign hosting requirement (POPIA Section 72):**
Must be hosted exclusively within South Africa's borders. Same region constraints as
Database A. The two databases must be on separate connection strings — never on the
same instance — to enforce query-level isolation.

**Schema isolation mandate:**
Database B holds ONLY: `pseudoUUID` (client-generated, no PII content),
`rawSandboxActions`, `microSignalScores`, `competencyVectors`, `sessionTimestamps`.
It must never receive `parentName`, `parentEmail`, `parentPhone`, or any
delivery address field.

**Binary payload note (Phase 11.5):**
The live upload path in `telemetry.js` routes `ArrayBuffer` packets via
`Content-Type: application/octet-stream` to `/sessions/binary`. Database B
must support binary blob ingestion alongside the standard JSON endpoint at
`/sessions`. Both endpoints require `X-Session-UUID` and `X-Session-ID` headers.

**POPIA pseudoUUID HMAC isolation:**
`pseudoUUID` is generated client-side via `crypto.randomUUID()` and carries zero
PII content. The mapping between `pseudoUUID` and `parentRecordId` (from Database A)
lives exclusively in `tokenMap.js` — it is never materialized in either database.
This maintains the data subject's right to deletion under POPIA Section 23 without
requiring a cross-database join.

---

### 3.1.G — Secure Token Mapping Layer

| Component | Environment Variable | Security Level | Adapter | Flag |
|---|---|---|---|---|
| `pseudoUUID ↔ parentRecordId` mapping service | `TOKEN_MAP_SERVICE_ENDPOINT` | **[SERVER-SIDE ONLY]** | `src/core/integrations/tokenMap.js` | `tokenMapSimulated` |
| Token map signing key | `TOKEN_MAP_SIGNING_KEY` | **[SERVER-SIDE ONLY]** | `src/core/integrations/tokenMap.js` | `tokenMapSimulated` |

**Activation prerequisite:** Both `DATABASE_A_SECURE_CONN` and `DATABASE_B_SOVEREIGN_CONN`
must be confirmed and live before `tokenMapSimulated` flips to `false`.
The token map service must NEVER log its mapping table — not in debug mode, not in
production traces. The `tokenMap.js` adapter enforces this guard explicitly.

---

### 3.1.H — OTP / SMS Consent Verification

| BRAND Key Path | Environment Variable | Security Level | Adapter | Flag |
|---|---|---|---|---|
| `BRAND.integrations.otp.endpoint` | `OTP_API_ENDPOINT` | Moderate | `src/core/integrations/otp.js` | `otpSimulated` |
| `BRAND.integrations.otp.apiKey` | `OTP_API_KEY` | **[SERVER-SIDE ONLY]** | `src/core/integrations/otp.js` | `otpSimulated` |

**Provider requirement:** SA mobile number pool required for POPIA-compliant OTP delivery.
Candidates: `Clickatell` (SA-based), `Vonage`, or `Africa's Talking` (SA number pool).
SMS must originate from a verified SA sender ID. OTP codes must expire within 10 minutes.

**SIM mode behaviour:** In simulation mode, `sendOTP()` returns immediately and
`verifyOTP()` accepts only `'000000'` as the passing code. In production, the adapter
dispatches a real 6-digit code to the verified parent mobile number.

---

### 3.1.I — Delivery Network (Pudo Smart Lockers + PEP Paxi)

Both Pudo AND Paxi credentials must be confirmed before `FLAGS.deliverySimulated` is set
to `false`. The adapter handles both channels behind the same flag.

| BRAND Key Path | Environment Variable | Security Level | Adapter | Flag |
|---|---|---|---|---|
| `BRAND.integrations.delivery.pudo.endpoint` | `PUDO_LIVE_URL` | Moderate | `src/core/integrations/delivery.js` | `deliverySimulated` |
| `BRAND.integrations.delivery.pudo.apiKey` | `PUDO_PRODUCTION_API_KEY` | **[SERVER-SIDE ONLY]** | `src/core/integrations/delivery.js` | `deliverySimulated` |
| `BRAND.integrations.delivery.paxi.endpoint` | `PAXI_LIVE_URL` | Moderate | `src/core/integrations/delivery.js` | `deliverySimulated` |
| `BRAND.integrations.delivery.paxi.apiKey` | `PAXI_PRODUCTION_TOKEN` | **[SERVER-SIDE ONLY]** | `src/core/integrations/delivery.js` | `deliverySimulated` |

**Pudo live endpoint pattern:** `https://api.pudo.co.za/v1` (TBC — verify with Pudo developer portal at `pudo.co.za/developers`)
**Paxi live endpoint pattern:** `https://api.paxi.co.za/v1` (TBC — verify with PEP Paxi API at `paxi.co.za/api`)

**POPIA compliance:** The delivery adapter passes ONLY `orderId`, `toLockerId`/`pickupPointId`,
and `weightKg` to the logistics provider. No parent name, email, phone, or home address
ever enters the delivery payload. Hashed delivery addresses live exclusively in Database A
(piiStore.js) and are never passed to the delivery adapter.

---

### 3.1.J — Print-on-Demand (POD)

| BRAND Key Path | Environment Variable | Security Level | Adapter | Flag |
|---|---|---|---|---|
| `BRAND.integrations.pod.endpoint` | `POD_PRODUCTION_URL` | Moderate | `src/core/integrations/pod.js` | `podSimulated` |
| `BRAND.integrations.pod.apiKey` | `POD_STATION_SECRET` | **[SERVER-SIDE ONLY]** | `src/core/integrations/pod.js` | `podSimulated` |

**Provider requirement:** SA-local print station with bilingual (English + Afrikaans)
card printing capability. POD payload carries: `orderId`, `challengeCardTheme`,
`insertTheme`, `stickerSet`, `language: 'bilingual'`, `quantity`. No PII content.

---

### 3.1.K — Transactional Email

| BRAND Key Path | Environment Variable | Security Level | Adapter | Flag |
|---|---|---|---|---|
| `BRAND.integrations.email.apiKey` | `EMAIL_API_KEY` | **[SERVER-SIDE ONLY]** | `src/core/integrations/email.js` | `emailSimulated` |
| `BRAND.integrations.email.fromAddress` | `EMAIL_FROM_ADDRESS` | Moderate | `src/core/integrations/email.js` | `emailSimulated` |

**Note:** Email logs in SIM mode never output the recipient address (`to` field) to
the console — confirmed in `email.js` SIM path: `console.log('[SIM] email.js — recipient present:', !!emailPayload.to)`.
The live adapter routes `to` address only to the provider — it never reaches
Database B or any telemetry buffer.

---

### 3.1.L — Asset Storage (AWS S3, Cape Town)

| BRAND Key Path | Environment Variable | Security Level | Adapter | Flag |
|---|---|---|---|---|
| `BRAND.integrations.storage.bucket` | `STORAGE_BUCKET_NAME` | Moderate | `src/core/integrations/storage.js` | `storageSimulated` |
| `BRAND.integrations.storage.region` | `STORAGE_REGION` | Moderate | `src/core/integrations/storage.js` | `storageSimulated` |
| `BRAND.integrations.storage.accessKey` | `STORAGE_ACCESS_KEY` | **[SERVER-SIDE ONLY]** | `src/core/integrations/storage.js` | `storageSimulated` |

**Sovereign hosting requirement:** Must use `af-south-1` (AWS Cape Town).
`STORAGE_REGION` must resolve to `af-south-1` — no other value is POPIA-compliant
for child interaction data assets. IAM policy should be scoped to the specific
bucket using least-privilege access.

---

### 3.1.M — Phase 2 ML Assessment Layer

| BRAND Key Path | Environment Variable | Security Level | Adapter | Flag |
|---|---|---|---|---|
| `BRAND.integrations.mlAssessment.endpoint` | `ML_ASSESSMENT_ENDPOINT` | Moderate | `src/core/integrations/mlAssessment.js` | `mlAssessmentSimulated` |
| `BRAND.integrations.mlAssessment.apiKey` | `ML_ASSESSMENT_API_KEY` | **[SERVER-SIDE ONLY]** | `src/core/integrations/mlAssessment.js` | `mlAssessmentSimulated` |

**Activation prerequisite:** Phase 2 ML architecture activates at 10,000+ active
child profiles. `mlAssessmentSimulated` remains `true` indefinitely until this
threshold is confirmed. The static Phase 1 Bayesian engine (`assessmentTables.js`)
continues to run locally as the primary assessment path. When `mlAssessmentSimulated`
flips to `false`, the ML service endpoint supersedes the static tables with a live
Random Forest / t-SNE model trained on anonymised Database B vectors.

---

## Tier 3.2 — Provider Connection Validation Metrics

### Authorization Header Constructs

All live adapter paths use the `Authorization: Bearer <token>` pattern.
The exact header packing in each `fetch()` call:

```
// Standard pattern (all adapters):
headers: {
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${BRAND.integrations.<provider>.apiKey}`,
  'Accept':        'application/json',
}

// Binary telemetry upload (telemetry.js live binary path):
headers: {
  'Content-Type':    'application/octet-stream',
  'X-Session-UUID':  sessionRecord.pseudoUUID,
  'X-Session-ID':    sessionRecord.sessionId,
}
// Note: no Authorization header on binary path — pseudoUUID in header IS the
// anonymous identity token. No API key in browser for Database B uploads.
```

### Request Timeout & Retry Policy

All live fetch calls in `delivery.js` wrap in `_fetchWithTimeout()` with a 10,000ms
(`_TIMEOUT_MS = 10_000`) AbortController timeout. On abort, the error is thrown as:
```
'Logistics Provider Error: Request timed out after 10 seconds.'
```

Other adapters (auth, payment, piiStore, email) do not currently implement timeout
wrappers. **Recommendation:** Apply the same `_fetchWithTimeout` wrapper pattern
from `delivery.js` to all live adapter paths before production deployment.

### Credential String Patterns

| Credential | Expected Format | Min Length | Encoding |
|---|---|---|---|
| `AUTH_API_KEY` | JWT or opaque token | 32 chars | Base64url or hex |
| `MERCHANT_ID` | PayFast: 8-digit integer string | 8 chars | Numeric string |
| `MERCHANT_KEY` | PayFast: 16-char alphanumeric | 16 chars | Mixed case ASCII |
| `PAYFAST_PASSPHRASE` | Operator-defined, URL-safe | 8–32 chars | ASCII |
| `PAYFAST_ITN_SECRET` | MD5 signature seed | 32 hex chars | Lowercase hex |
| `PUDO_PRODUCTION_API_KEY` | Bearer token | 40+ chars | Base64 or UUID-like |
| `PAXI_PRODUCTION_TOKEN` | Bearer token | 32+ chars | Base64 |
| `POD_STATION_SECRET` | HMAC signing key | 32+ chars | Hex |
| `DATABASE_A_SECURE_CONN` | PostgreSQL URI | Variable | `postgresql://user:pass@host:5432/db_a?sslmode=require` |
| `DATABASE_B_SOVEREIGN_CONN` | PostgreSQL URI | Variable | `postgresql://user:pass@host:5432/db_b?sslmode=require` |
| `TOKEN_MAP_SIGNING_KEY` | HMAC-SHA256 key | 32 bytes | Hex or Base64 |
| `STORAGE_ACCESS_KEY` | AWS IAM access key ID | 20 chars | `AKIA...` prefix |
| `OTP_API_KEY` | Provider-specific | 32+ chars | Variable |

### SSL/TLS Requirements

All live API endpoints must use HTTPS with TLS 1.2+.
Connection strings for Database A and B must include `sslmode=require`.
Any provider endpoint resolving to HTTP must be rejected before deployment.

### Backend Proxy Architecture for Server-Side Credentials

Credentials marked `[SERVER-SIDE ONLY]` must be accessed exclusively via
Vercel Serverless Functions. Suggested proxy route layout for the Vercel project:

```
/api/auth/register          → Proxies to AUTH_API_ENDPOINT
/api/auth/login             → Proxies to AUTH_API_ENDPOINT
/api/payment/subscribe      → Proxies to PayFast/Peach, signs with MERCHANT_KEY
/api/telemetry/upload       → Proxies to DATABASE_B_SOVEREIGN_CONN
/api/telemetry/upload-binary → Accepts ArrayBuffer, forwards to DB B
/api/pii/store              → Proxies to DATABASE_A_SECURE_CONN
/api/token-map/create       → Proxies to TOKEN_MAP_SERVICE
/api/otp/send               → Proxies to OTP_API_ENDPOINT
/api/otp/verify             → Proxies to OTP_API_ENDPOINT
/api/email/send             → Proxies to email provider
/api/storage/upload         → Proxies to S3 Cape Town
```

Each proxy function reads its secret from Vercel Environment Variables (never
from `manifest.js`). Client-side code in `manifest.js` stores only the
`/api/*` proxy URL, never the upstream provider key.

---

## Tier 3.3 — The Switch-Flip Operational Protocol

### Pre-Conditions Checklist

Before flipping any flag to `false`, the operator must verify ALL of the following:

- [ ] `npm run build` exits with code 0 (confirm after each flag flip)
- [ ] `npm run launch` shows 0 warnings for the credential being activated
- [ ] The credential has been tested with a real round-trip (not just populated)
- [ ] POPIA sovereign hosting region is confirmed for database credentials
- [ ] The Vercel proxy function for this credential is deployed and returning 200

### Recommended Flip Sequence

Flip flags in this dependency order. Each flip is a single-line edit in `src/core/flags.js`:

#### Step 1 — Authentication (`authSimulated: true → false`)
```js
// src/core/flags.js — change:
authSimulated: false,   // ← was true
```
**Prerequisite:** `AUTH_API_ENDPOINT` and `AUTH_API_KEY` are set. Proxy `/api/auth/*` is live.
**Test:** Complete Phase 2 onboarding wizard. Confirm real session token is returned.

#### Step 2 — PII Store (`piiStoreSimulated: true → false`)
```js
piiStoreSimulated: false,   // ← was true
```
**Prerequisite:** `DATABASE_A_SECURE_CONN` resolves to SA-sovereign Postgres instance.
Schema: `parents` table with `parentName`, `parentEmail`, `parentPhone`, `hashedDeliveryAddress`,
`consentLog`, `otpVerificationRecord` columns. Proxy `/api/pii/store` is live.
**Test:** Complete onboarding Step 4. Confirm record appears in Database A.

#### Step 3 — OTP / SMS (`otpSimulated: true → false`)
```js
otpSimulated: false,   // ← was true
```
**Prerequisite:** `OTP_API_ENDPOINT` and `OTP_API_KEY` are set. SA number pool confirmed.
Proxy `/api/otp/send` and `/api/otp/verify` are live.
**Test:** Complete onboarding Step 2. Confirm real SMS received on test mobile number.
**Note:** After this flip, `'000000'` will no longer bypass verification.

#### Step 4 — Token Map (`tokenMapSimulated: true → false`)
```js
tokenMapSimulated: false,   // ← was true
```
**Prerequisite:** Steps 1 and 2 must already be live. `TOKEN_MAP_SERVICE_ENDPOINT`
and `TOKEN_MAP_SIGNING_KEY` are set. The mapping service stores NO plaintext data —
only `HMAC(pseudoUUID) → parentRecordId` entries.
**Test:** Trigger a POPIA data deletion request. Confirm records purge from both databases.

#### Step 5 — Payment (`paymentSimulated: true → false`)
```js
paymentSimulated: false,   // ← was true
```
**Prerequisite:** `MERCHANT_ID` and `MERCHANT_KEY` are set. Proxy `/api/payment/subscribe`
is live and signing all requests with `MERCHANT_KEY`. PayFast sandbox test completed first.
**Test:** Complete full checkout on `/subscribe`. Confirm subscription ID from PayFast.
**Warning:** DO NOT flip this flag without completing Step 1 first (auth must be live).

#### Step 6 — Telemetry Engine (`telemetrySimulated: true → false`)
```js
telemetrySimulated: false,   // ← was true
```
**Prerequisite:** `DATABASE_B_SOVEREIGN_CONN` resolves to SA-sovereign Postgres instance.
Schema: `sessions` table with `pseudoUUID`, `microSignals`, `gapMetric`, `sessionDuration`
columns. Binary upload endpoint `/api/telemetry/upload-binary` is live for Phase 11.5 packets.
**Test:** Complete one sandbox session. Confirm session record in Database B with `pseudoUUID` only.
No `parentName` / `parentEmail` / `parentPhone` must appear in any Database B row.

#### Step 7 — Delivery (`deliverySimulated: true → false`)
```js
deliverySimulated: false,   // ← was true
```
**Prerequisite:** BOTH `PUDO_LIVE_URL` + `PUDO_PRODUCTION_API_KEY` AND
`PAXI_LIVE_URL` + `PAXI_PRODUCTION_TOKEN` must be set before this single flip.
The adapter serves both channels behind one flag.
**Test:** Enter real SA postal code in `/subscribe`. Confirm real Pudo locker list returns.
Complete checkout with Pudo. Confirm shipping label is generated.

#### Step 8 — Print-on-Demand (`podSimulated: true → false`)
```js
podSimulated: false,   // ← was true
```
**Prerequisite:** `POD_PRODUCTION_URL` and `POD_STATION_SECRET` are set.
POD station has received and confirmed test print job in staging.
**Test:** Trigger "Trigger Print Job" in `/admin` Fulfillment Kitting view.
Confirm `printJobId` returned from real POD provider.

#### Step 9 — Transactional Email (`emailSimulated: true → false`)
```js
emailSimulated: false,   // ← was true
```
**Prerequisite:** `EMAIL_API_KEY` and `EMAIL_FROM_ADDRESS` are set.
`EMAIL_FROM_ADDRESS` must use the confirmed production domain (e.g. `orders@crate.co.za`).
Proxy `/api/email/send` is live.
**Test:** Complete checkout on `/subscribe`. Confirm confirmation email received at test address.

#### Step 10 — Asset Storage (`storageSimulated: true → false`)
```js
storageSimulated: false,   // ← was true
```
**Prerequisite:** `STORAGE_BUCKET_NAME`, `STORAGE_REGION = 'af-south-1'`, and
`STORAGE_ACCESS_KEY` are set. Bucket has appropriate CORS policy for the production domain.
Proxy `/api/storage/upload` is live.
**Test:** Upload a test asset via `storage.js`. Confirm presigned URL returned and file accessible.

#### Step 11 — ML Assessment Layer (`mlAssessmentSimulated: true → false`)
```js
mlAssessmentSimulated: false,   // ← was true
```
**Prerequisite:** Active profile count ≥ 10,000. `ML_ASSESSMENT_ENDPOINT` and
`ML_ASSESSMENT_API_KEY` are set. Model has been trained and validated on anonymised
Database B vectors. The Phase 1 static Bayesian engine (`assessmentTables.js`)
remains as a fallback if the ML service is unavailable.
**Test:** Complete a sandbox session. Confirm `processTelemetry()` routes through
the live ML endpoint instead of the static conditional probability tables.

### Final Production Promotion Command

After all 11 flags are flipped and all gates pass:

```bash
# 1. Verify zero warnings
npm run launch

# 2. Verify clean production build
npm run build

# 3. Promote to production (Vercel)
vercel --prod
```

`npm run launch` will:
- Confirm 0 null fields remain in `manifest.js`
- Confirm 0 simulation flags remain as `true` in `flags.js`
- Overwrite `public/robots.txt` to `Allow: /` + Sitemap (already done in Phase 11)
- Write/overwrite `public/sitemap.xml` with production routes
- Exit with code 0

---

## Tier 3.4 — Legal & Sovereign Guardrail Attestation

### POPIA Section 72 — Transborder Data Flow Compliance

**Attestation:** All production data stores linked to this platform — specifically
Database A (PII Store) and Database B (Play Signal Engine) — MUST be hosted
exclusively within the Republic of South Africa at the time of first live credential
insertion. Hosting on `AWS af-south-1` (Cape Town) or `Azure southafricanorth`
(Johannesburg) satisfies this requirement without requiring prior authorization
from the Information Regulator.

**Prohibited hosting regions:** Any US-hosted cloud provider (`us-east-1`, `us-west-2`,
etc.) requires a formal Section 72 prior-authorization application to the Information
Regulator, a process that takes up to 13 weeks. This must NOT be used as a shortcut
to launch speed.

**Data subject rights implementation (POPIA Section 23):**
The one-click data erasure function in `ParentDashboard.js` (`_executeDataErasure()`)
purges all `cr_*` localStorage keys. The production implementation must cascade this
deletion to Database A and Database B via the Vercel proxy. The `tokenMap.js` adapter
must purge the `pseudoUUID ↔ parentRecordId` mapping atomically with both database
deletions to prevent orphaned records.

**Child data special category (POPIA Section 26):**
The platform collects data about children under 18. The competent person consent
obtained in Phase 2 onboarding (OTP-verified digital signature + timestamp) constitutes
valid "explicit, informed, and voluntary" consent under POPIA Section 11(1)(a).
This consent record must be retained in Database A for the duration of the subscription
plus a legally mandated retention period — consult SA legal counsel for the applicable
retention schedule.

**Annual compliance audit requirement:**
POPIA mandates quarterly automated codebase audits confirming no biometric or
behavioral profiling scripts are active. `scripts/launch.js` serves as the automated
gate but does not audit runtime behavior. A manual review of all adapter files
against the PII field list must be conducted before each production credential flip.

---

### HPCSA Act 56 of 1974 — Non-Diagnostic Platform Positioning

**Attestation:** The C.R.A.T.E. platform is legally classified exclusively as a
**"developmental play assistant"** and **"STEAM interest exploration tool"**.
It does not constitute a "psychological test" as defined under the Health Professions
Act 56 of 1974 because:

1. **No psychological construct measurement:** The platform maps behavioral interaction
   patterns (exploration breadth, retry frequency, sequence complexity) to physical
   kit curation preferences. It does not compute IQ, aptitude, or any psychometric
   score as defined by the HPCSA.

2. **No diagnostic classification:** No output produced by this platform classifies,
   labels, diagnoses, or ranks a child's abilities. All output uses growth-framed
   interest language: "strong focus in this area", "building interest", "emerging
   engagement". Dimension labels are activity categories, not trait assessments.

3. **Symbol-free, untimed, unscored environment:** The sandbox interface contains
   zero scores, timers, level counts, or performance indicators visible to the child.
   This is an architectural invariant enforced by the render-only sandbox HTML template.

4. **HPCSA language mandate (enforced at build time):** The HPCSA prohibited terms
   list — `psychological`, `neuropsychological`, `aptitude`, `IQ`, `intelligence quotient`,
   `cognitive ability`, `diagnostic`, `clinical`, `assessment score`, `percentile rank`,
   `developmental delay`, `deficit`, `disorder`, `learning disability`, `mental age` —
   must be scanned across all modified files before every production commit.
   `scripts/launch.js` does not yet automate this scan. A pre-commit hook checking
   for these strings is recommended as a final hardening measure.

**Formal legal clearance prerequisite:**
Before any production deployment that involves presenting platform outputs to
parents, schools, or any third party, formal legal clearance must be obtained from
a registered South African legal counsel confirming that the platform's metrics,
outputs, and marketing copy do not constitute a "psychological act" under Act 56 of 1974.
This is listed as Outstanding Item #28 in `CRATE_BUILD_MANIFEST.md`.

---

## Launch Gate Status at Time of Document Creation

```
npm run launch — 2026-05-31
  [1/4] manifest.js null scan:  39 unresolved TBC fields
  [2/4] flags.js simulation scan: 11 active simulation channels
  [3/4] robots.txt: production format confirmed (Allow: /)
  [4/4] sitemap.xml: 3 public routes written

  Total warnings: 50
  Exit code: 0 (advisory — CI will not block)
```

This document resolves to 0 warnings when all 39 null fields in
`src/core/manifest.js` have been populated AND all 11 flags in
`src/core/flags.js` have been flipped to `false` following the
Tier 3.3 sequence above.

---

*Last updated: Phase 11.7 — Production Credentials Manifest Construction*
*Authored by: C.R.A.T.E. engineering team*
*Classification: Internal infrastructure — not for public distribution*
