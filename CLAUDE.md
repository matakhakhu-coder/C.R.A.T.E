# CLAUDE.md — C.R.A.T.E. Project Law
## Cognitive Radar & Adaptive Trajectory Engine

> Read this document completely at the start of every session.
> It governs how this project is built. It is not a summary of what has been built.
> Every architectural decision flows from this file.

---

## Collaboration Protocol

The four pre-execution invariants — applied to every directive, every session:

**1. AUDIT**
Read every file you will touch. Read every file you will import from. Confirm that
every referenced function name, data field path, and module export actually exists on
disk as it currently stands. Do not work from session memory. Specific audit failures
most probable for this project:
- Telemetry micro-signal field names mismatched between `manifest.js` and adapters
- Assessment dimension keys referenced in components but not defined in `flags.js`
- HPCSA-prohibited language appearing in UI strings or comments (scan before commit)
- Dual-database field routing error: PII fields written to telemetry path or vice versa
- Physics engine API calls inside a `render()` function (violates the two-function contract)
- `localStorage` sandbox session data read before the offline sync adapter initializes

**2. WEIGH**
Identify the cleanest isolation path. For this project, the most common isolation
question is: does this belong in the assessment engine or the telemetry layer?
They are separate concerns. Assessment interprets signals; telemetry captures them.
Never couple these two modules directly — communicate via custom events.

**3. FLAG DEFICITS**
If a spec references a null field (e.g., `BRAND.payment.endpoint`), implement
a null-safe fallback and the `[SIM]` adapter path. Document the deficit in your
delivery summary — never block execution on missing client data.

**4. PROCEED**
Execute completely. Do not ask clarifying questions mid-implementation. Make
the defensible architectural call, document it in a comment, and deliver.

---

## Project Identity

| Field | Value |
|---|---|
| **Project Name** | C.R.A.T.E. |
| **Full Name** | Cognitive Radar & Adaptive Trajectory Engine |
| **Owner** | TBC — verify with operator |
| **Domain** | TBC — verify with operator |
| **Legal Entity** | TBC |
| **Concept** | A child development platform that reads behavioral micro-signals from a digital physics sandbox and uses them to personalize physical STEAM subscription crates |
| **Primary User** | Parents (homeschooling families first) — receive growth insights and curated physical kits |
| **Secondary User** | Children aged ~3–12 — play in the digital sandbox |
| **Stack** | Vite · Vanilla JS ESM · Tailwind CSS 3.x · PostCSS · Autoprefixer |
| **Physics Layer** | Matter.js [Inferred — verify with operator] |
| **Offline Storage** | localStorage (sim) → IndexedDB with background sync (live) |
| **Backend / Auth** | TBC — must be SA-sovereign (AWS Cape Town / Azure Johannesburg) |
| **Database Architecture** | Dual-isolated: Database A (PII) + Database B (Telemetry), never joined |
| **Deployment** | Vercel (staging auto-deploy on push to main) |
| **Key Constraint** | HPCSA compliance: no psychological terminology anywhere in UI, copy, or codebase strings. POPIA sovereign data: all PII and telemetry hosted within South Africa's borders only. |
| **Anchor Documents** | `CLAUDE.md` · `CRATE_BUILD_MANIFEST.md` · `CRATE_ROADMAP.md` |

---

## SVVP Definition

The System Viable Viable Product for C.R.A.T.E. is the complete platform operating
in simulation mode with zero live credentials. In SVVP state: a parent can register,
sign a timestamped POPIA consent with OTP simulation, and create a child profile.
The child can play freely in the physics sandbox — placing objects, triggering forces,
backtracking, rule-testing — while all ten micro-signals are captured silently and
stored in an encrypted local session store. On session end, the assessment engine
processes the session against the static Bayesian model and updates the child's
developmental profile. The parent dashboard shows the trajectory using growth-framed
language only (the anti-labeling copy rules are enforced). The 70/20/10 recommendation
engine generates a simulated crate selection based on the profile and displays a
detailed kit preview. The parent completes a simulated subscription checkout with
simulated Pudo/Paxi delivery selection. An admin can view the simulated order queue
and crate kitting instructions. The staging URL is live throughout all phases.
Graduation to live requires flipping one boolean flag per integration as credentials
are confirmed.

---

## Phase Status

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

## Deployment State

| Field | Value |
|---|---|
| **Staging URL** | TBC — created on Phase 0 Vercel connection |
| **Production Domain** | TBC |
| **CI/CD** | Vercel auto-deploy on push to `main` |
| **Environment Mode** | Simulation (all FLAGS = true at project start) |
| **Vercel Config** | SPA catch-all rewrite + staging noindex headers (see Architecture Constraints) |

---

## Architecture Constraints

### The Two-Function Contract (non-negotiable)

Every UI module exports exactly two functions:

```js
export function render(data) {
  // Returns a pure HTML template literal string.
  // Zero DOM access. Zero event listeners. Zero async calls. Zero side effects.
  // If document.querySelector() is called here it returns null — silent failure.
  return `<div>...</div>`
}

export function init(data) {
  // All DOM queries happen here, after app.innerHTML has been written.
  // All event listeners are attached here.
  // All adapter calls happen here.
  // State lives in closure variables inside init(), not on window unless
  // cross-module coordination via custom events is architecturally insufficient.
}
```

### The Single-Pass Hydration Sequence in `main.js`

```js
app.innerHTML = [
  renderNavbar(),
  renderHero(),
  renderSandboxMount(),
  renderParentDashboard(),
  renderFooter(),
].join('')        // ← ONE innerHTML write. All strings concatenated first.

initNavbar()      // ← ALL inits in order, after DOM is fully written.
initSandboxMount()
initParentDashboard()
initFooter()
```

### The Three Exclusive Render Paths

```
/admin              → mountAdmin()        → AdminShell only. No customer modules.
?session=CR-XXXXXX  → mountConfirmation() → Navbar + SessionSummary + Footer
everything else     → mountCustomer()     → Full landing + sandbox + dashboard
```

URL routing via `window.location.pathname` and `URLSearchParams` only.
`vercel.json` catch-all rewrite handles SPA paths.

### The Dual-Database Isolation Rule (POPIA mandate)

All module code must respect the following data routing rules — violation is a
compliance breach, not just a bug:

```
Database A (PII Store — South Africa sovereign only):
  Fields: parentName, parentEmail, parentPhone, deliveryAddress, consentLog,
          competentPersonSignature, otpVerificationRecord
  Adapter: src/core/integrations/piiStore.js
  Rule: Never passes a child identifier that links to telemetry data

Database B (Telemetry Engine — South Africa sovereign only):
  Fields: pseudoUUID (no name/email), rawSandboxActions, competencyVectors,
          sessionTimestamps, microSignalScores
  Adapter: src/core/integrations/telemetry.js
  Rule: Contains zero fields from Database A. pseudoUUID is generated locally
        and never cross-referenced with PII in any module.

Secure Token Mapping Layer:
  File: src/core/integrations/tokenMap.js
  Rule: Only this file ever holds the pseudoUUID↔parentRecordId mapping.
        Never imported into customer-facing render paths.
        Never logs its mapping table, even in [SIM] mode.
```

### The HPCSA Language Guardrail (non-negotiable)

Before every commit, scan all modified files for prohibited terms.
These strings must never appear in UI text, parent dashboard copy,
marketing content, console logs, or code comments visible to users:

**Prohibited:** psychological, neuropsychological, aptitude, IQ, intelligence quotient,
cognitive ability, diagnostic, clinical, assessment score, percentile rank,
developmental delay, deficit, disorder, learning disability, mental age

**Required framing:**
- Assessment engine → "play style engine" or "interest mapping engine"
- Competency scores → "play trajectory" or "interest signals"
- Developmental dimension → "play strength" or "activity interest area"
- Low score → "building focus in this area" or "emerging interest"

---

## Module Placement Rules

| Code Type | Directory | Anticipated Module Names |
|---|---|---|
| Pure UI components (no logic) | `src/components/` | Navbar, Hero, Footer, CrateCard, DimensionPill, ConsentBanner, ToastNotification |
| Feature modules with state | `src/modules/` | SandboxEngine, TelemetryCollector, AssessmentEngine, ParentDashboard, CrateRecommender, OnboardingFlow, SubscriptionManager, SessionSummary |
| Admin-only modules | `src/admin/` | AdminShell, OrderQueue, OrderDetail, CrateQueueView, TelemetryMonitor |
| Utilities, data, adapters | `src/core/` | `manifest.js`, `flags.js`, `SEOEngine.js`, `router.js`, `assessmentTables.js` |
| Integration adapters | `src/core/integrations/` | `auth.js`, `payment.js`, `telemetry.js`, `piiStore.js`, `tokenMap.js`, `otp.js`, `delivery.js`, `pod.js`, `email.js`, `storage.js` |
| Node.js tooling (not bundled) | `scripts/` | `launch.js` |
| Static assets, served as-is | `public/` | `robots.txt`, `sitemap.xml`, `icons/`, `images/` |

**Isolation rule:** `src/admin/` modules are never imported into `src/modules/` or
`src/components/`. Violation leaks admin UI into the customer bundle.
`tokenMap.js` is never imported into customer-facing render paths.

---

## Simulation / Live Switch Architecture

Every external dependency follows the standard adapter pattern:

```js
// src/core/integrations/example.js
import { FLAGS } from '@/core/flags.js'
import { BRAND } from '@/core/manifest.js'

export async function doAction(payload) {
  if (FLAGS.exampleSimulated) {
    console.log('[SIM] example.js — doAction called', payload)
    await new Promise(r => setTimeout(r, 800))   // realistic latency
    return { success: true, id: `cr-sim-${Date.now()}` }
  }
  // Live path — uses BRAND.integrations.* for credentials
  const res = await fetch(BRAND.integrations.example.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
               'Authorization': `Bearer ${BRAND.integrations.example.apiKey}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`example: ${res.status}`)
  return res.json()
}
```

The `[SIM]` console tag is mandatory. The delay is mandatory (makes loading states testable).

### Integration Adapter Registry

| Integration | Adapter File | Flag Key | Resolving Credential |
|---|---|---|---|
| Parent Authentication | `src/core/integrations/auth.js` | `authSimulated` | Auth provider API key (SA-sovereign) — TBC |
| Subscription Payment | `src/core/integrations/payment.js` | `paymentSimulated` | Payment gateway key (TBC — PayFast or Peach Payments likely) |
| Telemetry Upload (DB B) | `src/core/integrations/telemetry.js` | `telemetrySimulated` | Database B connection string (SA-sovereign) — TBC |
| PII Store (DB A) | `src/core/integrations/piiStore.js` | `piiStoreSimulated` | Database A connection string (SA-sovereign) — TBC |
| OTP / SMS Consent | `src/core/integrations/otp.js` | `otpSimulated` | SMS provider API key (SA number pool) — TBC |
| Pudo / Paxi Delivery | `src/core/integrations/delivery.js` | `deliverySimulated` | Pudo API key + Paxi API key — TBC |
| Print-on-Demand | `src/core/integrations/pod.js` | `podSimulated` | SA POD provider credentials — TBC |
| Transactional Email | `src/core/integrations/email.js` | `emailSimulated` | Email provider API key — TBC |
| Asset Storage | `src/core/integrations/storage.js` | `storageSimulated` | AWS S3 Cape Town bucket + IAM credentials — TBC |
| ML Assessment Layer | `src/core/integrations/mlAssessment.js` | `mlAssessmentSimulated` | ML service endpoint (Phase 2 only, 10k+ profiles) — TBC |

**Note on Phase 1 Assessment:** The static Bayesian assessment engine runs
locally in `src/core/assessmentTables.js` — no network call, no flag needed.
It uses static conditional probability tables until Phase 2 ML upgrade.
`mlAssessmentSimulated` controls the Phase 2 ML service only.

---

## Design Token System

Tailwind CSS v3 with project tokens in `tailwind.config.js`.
Brand palette is TBC pending brand confirmation — the following are provisional:

```
Provisional brand palette (override when brand is confirmed):
  cr-forest      #2D6A4F   Primary: trust, growth, nature
  cr-forest-dark #1B4332   Hover on forest
  cr-amber       #F4A261   Secondary: warmth, play, energy
  cr-amber-dark  #E76F51   Hover/active on amber
  cr-sky         #48CAE4   Accent: curiosity, exploration
  cr-navy        #1A2B4A   Headings, body text, footer
  cr-cream       #FDF8F2   Page background
  cr-cream-dark  #F5EDE0   Alternating sections, card borders
  cr-sage        #4A7C6F   Success, POPIA consent confirmation

Typography (carry forward from DNA — proven pair):
  font-display   Nunito 700/800     Headings, crate names, dimension labels
  font-body      Inter 400/500/600  All body copy, form labels, data

Component classes in @layer components:
  .btn-primary      Amber CTA, shadow-cta, 48px min-height, active:scale-95
  .btn-secondary    Outlined amber, fills on hover
  .btn-consent      Forest background, white text (consent actions)
  .card             White, rounded-2xl, shadow-card, hover:shadow-card-hover
  .dimension-pill   Rounded-full, colored dot, small-caps label
```

**48px minimum tap targets** enforced on all interactive elements in `style.css`.
**Mobile-first, 390px baseline.** Every section must be fully usable at 390px.

---

## localStorage and State Conventions

```
cr_sim_sessions       Array of play session objects — sim telemetry store
cr_sim_orders         Array of subscription order objects — sim order store
cr_sim_profile        Child developmental profile object — sim assessment state
cr_consent_accepted   'true' string — consent banner suppression flag
cr_child_uuid         Current child's pseudoUUID — links session to profile (no PII)
```

**`BRAND.demo.*`** is the fallback data when localStorage is empty.
Never hardcode demo data inside modules.

---

## Custom Event Namespace

All cross-module events use the `cr:` prefix:

```js
document.dispatchEvent(new CustomEvent('cr:sessionEnd', { detail: { uuid, signals } }))
document.dispatchEvent(new CustomEvent('cr:openConsent', { detail: { modal: 'popia' } }))
document.dispatchEvent(new CustomEvent('cr:profileUpdated', { detail: { profile } }))
document.dispatchEvent(new CustomEvent('cr:crateReady', { detail: { crate } }))
```

---

## Standby Protocol

At the start of every session, read these files in this exact order:

1. `CLAUDE.md` — Re-orient to project law and architecture constraints
2. `CRATE_BUILD_MANIFEST.md` — Check current phase status and confirmed vs TBC fields
3. `CRATE_ROADMAP.md` — Identify the next pending deliverable
4. `package.json` — Confirm stack and available scripts (once created in Phase 0)
5. `src/main.js` — Understand current render/init sequence (once created)
6. `src/core/flags.js` — See which integrations are currently simulated (once created)
7. `src/core/manifest.js` — Confirm which BRAND fields have been resolved (once created)

Then report:
```
PROJECT: C.R.A.T.E.
PHASES COMPLETE: [list]
PHASES PENDING: [list]
SIMULATION FLAGS ACTIVE: [list]
UNRESOLVED NULLS: [count]
LAST COMMIT: [git log --oneline -1]
BUILD STATUS: [clean / unknown]
READY FOR: [next phase]

Bootstrap complete. Operational mode: HANDS.
Awaiting directive.
```

---

## Build Verification & Commit Standard

```bash
npm run build   # Must exit 0 before any commit.
```

```
feat: Phase N — Module1, Module2, brief summary

- Architectural decision made
- Sim/live path split implemented
- Any HPCSA language audit result
- Any deficit flagged and handled with null-safe fallback
- Build size if milestone phase

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

**Never `git add -A` or `git add .`** — stage specific files only.
**Never amend.** Fix and create a new commit.
**Push immediately after commit** — every push triggers Vercel auto-deploy.
