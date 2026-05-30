# CRATE_ROADMAP.md — The Log
## C.R.A.T.E. · Cognitive Radar & Adaptive Trajectory Engine

> This document is the build execution checklist. A `[x]` is earned only by
> verified functional delivery — not file existence, not partial implementation,
> not a passing review. Items move in one direction only: from `[ ]` to `[x]`.
> Gate criteria are observable conditions, not intentions. If the gate has not
> been witnessed to pass, the phase is not complete.

---

## Phase 0 — Substrate

**Delivers:** The technical skeleton on which all features will be built. No user-visible
UI. Just working tooling, configuration architecture, and a live staging URL.

- [ ] `git init` — repository initialized
- [ ] `npm create vite@latest` — Vite project scaffolded (vanilla JS template)
- [ ] Tailwind CSS 3.x installed and configured (`tailwind.config.js`, `postcss.config.js`)
- [ ] Custom design tokens registered in `tailwind.config.js` (cr-* palette, Nunito + Inter fonts)
- [ ] `src/core/manifest.js` created — `BRAND` object with all known fields, nulls for TBC
- [ ] `src/core/flags.js` created — all `FLAGS` set to `true` (full simulation mode at start)
- [ ] `src/core/assessmentTables.js` created — static CHC/TTCT Bayesian probability tables (Phase 1 engine, no network call)
- [ ] Integration adapter stubs created (return `[SIM]` path only):
  - [ ] `src/core/integrations/auth.js`
  - [ ] `src/core/integrations/payment.js`
  - [ ] `src/core/integrations/telemetry.js`
  - [ ] `src/core/integrations/piiStore.js`
  - [ ] `src/core/integrations/tokenMap.js`
  - [ ] `src/core/integrations/otp.js`
  - [ ] `src/core/integrations/delivery.js`
  - [ ] `src/core/integrations/pod.js`
  - [ ] `src/core/integrations/email.js`
  - [ ] `src/core/integrations/storage.js`
  - [ ] `src/core/integrations/mlAssessment.js`
- [ ] `src/main.js` created — three render paths scaffolded (`mountCustomer`, `mountAdmin`, `mountConfirmation`)
- [ ] `index.html` created — Google Fonts loaded, app div, toast div, single script entry
- [ ] `style.css` created — 48px tap target rule, base layer resets
- [ ] `vercel.json` created — SPA catch-all rewrite + staging noindex headers
- [ ] `public/robots.txt` created — `Disallow: /` (staging mode)
- [ ] `scripts/launch.js` created — scans nulls in manifest, scans `true` flags, rewrites robots.txt
- [ ] Vercel project connected — push triggers auto-deploy
- [ ] Staging URL live and returning 200

**Gate:** `npm run dev` runs clean with no errors. `npm run build` exits 0.
Staging URL is accessible at the Vercel-assigned domain.

---

## Phase 1 — Public Marketing Shell

**Delivers:** The public-facing landing page. A visitor can understand the platform's
value, see the six play dimensions, understand how crates work, and reach the
registration CTA — all without logging in.

- [ ] `src/components/Navbar.js` — logo, nav links, "Start Playing" CTA, mobile hamburger
- [ ] `src/components/Hero.js` — headline, sub-headline, primary CTA, sandbox teaser visual
- [ ] `src/modules/HowItWorks.js` — three-step explainer: Play → Insights → Crate
- [ ] `src/modules/DimensionShowcase.js` — six play dimension cards (HPCSA-compliant labels)
  - [ ] Curiosity dimension card
  - [ ] Spatial Reasoning dimension card
  - [ ] Systems Thinking dimension card
  - [ ] Narrative Imagination dimension card
  - [ ] Mechanical Intuition dimension card
  - [ ] Divergent Thinking dimension card
- [ ] `src/modules/CrateShowcase.js` — example crate contents, kit photography placeholders
- [ ] `src/modules/PricingSection.js` — subscription tier cards (null-safe — prices TBC)
- [ ] `src/modules/SocialProof.js` — testimonial placeholders, null-safe founder bio
- [ ] `src/components/Footer.js` — links, legal notices, HPCSA positioning statement
- [ ] `src/components/ConsentBanner.js` — POPIA cookie/data notice banner (dismissible)
- [ ] All sections wired into `mountCustomer()` render/init sequence in `main.js`
- [ ] Section background alternation pattern applied (`bg-cr-cream` / `bg-cr-cream-dark`)
- [ ] All sections fully usable at 390px mobile breakpoint

**Gate:** Staging URL renders full landing page. All six dimension cards visible.
Pricing section renders null-safe placeholders where prices are TBC. HPCSA language
audit passes — zero prohibited terms in all rendered text.

---

## Phase 2 — Parent Onboarding & POPIA Consent

**Delivers:** A parent can create an account, complete POPIA consent (competent
person digital signature + OTP verification), and set up a child profile. In sim
mode, OTP "000000" auto-passes.

- [ ] `src/modules/OnboardingFlow.js` — multi-step modal/page flow
  - [ ] Step 1: Parent registration form (name, email, phone — sent to `piiStore.js`)
  - [ ] Step 2: POPIA consent portal
    - [ ] Consent text rendered (plain language, not legal jargon)
    - [ ] Digital signature field (typed name as legal signature)
    - [ ] OTP send trigger → `otp.js` adapter (`[SIM]` path auto-sends "000000")
    - [ ] OTP input field + verify action
    - [ ] Consent timestamp + signature stored to `piiStore.js` adapter
  - [ ] Step 3: Child profile creation (name, date of birth, language preference)
    - [ ] pseudoUUID generated locally on client for this child (stored in `cr_child_uuid`)
    - [ ] Child profile stored to `piiStore.js` adapter (PII fields only)
    - [ ] pseudoUUID stored to `telemetry.js` adapter (no PII fields)
- [ ] `tokenMap.js` mapping created (pseudoUUID ↔ internal parentRecordId — never in customer path)
- [ ] Auth session created via `auth.js` adapter after consent completes
- [ ] Consent ledger entry recorded (read-only, timestamped, OTP-linked)
- [ ] Email confirmation dispatched via `email.js` adapter
- [ ] `cr_consent_accepted` flag set to `'true'` in localStorage (suppresses consent banner)
- [ ] One-click deletion flow scaffolded on account settings page (purges both DB A and DB B)

**Gate:** Full onboarding flow completes in sim mode. Console shows `[SIM] piiStore.js`,
`[SIM] otp.js`, `[SIM] auth.js`, `[SIM] email.js`. pseudoUUID stored in `cr_child_uuid`.
Zero PII fields present in any telemetry localStorage entry.

---

## Phase 3 — Digital Sandbox: Physics Play Environment

**Delivers:** The core product experience. A child can open the sandbox, interact
with a physics environment (place objects, apply forces, draw, pin, backtrack),
and play freely in an untimed, unscored, symbol-free environment.

- [ ] Physics engine integrated (`Matter.js` or confirmed alternative)
  - [ ] Engine initializes inside `init()` — never in `render()`
  - [ ] Canvas element rendered via `render()`, engine mounted in `init()`
- [ ] `src/modules/SandboxEngine.js`
  - [ ] Canvas-based physics world instantiated
  - [ ] Tool palette: drawing mechanics, pins, physical force triggers
  - [ ] Object placement and removal
  - [ ] Gravity, collision, and physics constraint simulation
  - [ ] Backtrack / undo mechanic
  - [ ] Boundary and rule-testing support (collision limits, boundary violations)
  - [ ] Optional decorative / narrative asset placement
  - [ ] Level progression system (difficulty increases on solve)
  - [ ] Level reset / restart mechanic
- [ ] Offline-first session store
  - [ ] All sandbox events written to encrypted `cr_sim_sessions` localStorage entry
  - [ ] Session auto-saves every 30 seconds
  - [ ] Sync queue initialized — dispatches to `telemetry.js` adapter on reconnect
  - [ ] Telemetry payload compressed to <50KB per sync
- [ ] Session start/end events dispatched via `cr:sessionEnd` custom event
- [ ] Sandbox loads and plays fully offline (no network dependency)

**Gate:** Sandbox runs in a browser with network disabled (airplane mode test).
All interactions are captured in `cr_sim_sessions`. Physics interactions feel
responsive at 390px. Session persists through a browser refresh.

---

## Phase 4 — Telemetry Engine & Assessment Core

**Delivers:** The engine silently maps play behavior to developmental signals and
updates the child's competency profile. No scores are shown to the child. The
engine runs entirely in the background.

- [ ] `src/modules/TelemetryCollector.js` — listens to sandbox events, computes 10 micro-signals
  - [ ] Time-to-First-Action (timestamp delta: level load → first physics input)
  - [ ] Retry Frequency (level resets, restarts, clearance events)
  - [ ] Exploration Breadth (spatial coverage X,Y relative to canvas)
  - [ ] Abandonment Points (difficulty state at exit + duration of final attempt)
  - [ ] Sequence Paths (DAG of action types over timeline)
  - [ ] Optional Interactions (count of non-essential decorative assets placed)
  - [ ] Rule-Breaking Attempts (boundary violations, collision limit tests)
  - [ ] Backtracking Behavior (undo frequency, deletion of recent components)
  - [ ] Speed Variability (std dev of input intervals during active construction)
  - [ ] Creative Modifications (ratio of non-standard tool combos to total steps)
- [ ] GAP metric computed per session: `GAP = (1/Nu) * Σ(k∈U) Tk`
- [ ] Productive vs. unproductive struggle detector
  - [ ] Wheel-spinning flag: >10 attempts on single challenge, no structural change
  - [ ] Wheel-spinning intervention dispatches `cr:wheelSpinDetected` event
- [ ] `src/modules/AssessmentEngine.js` — static Bayesian Phase 1 engine
  - [ ] `src/core/assessmentTables.js` — conditional probability tables for all 6 dimensions
  - [ ] Posterior probability computed: `P(Ci|E) = P(E|Ci)P(Ci) / Σj P(E|Cj)P(Cj)`
  - [ ] Competency profile updated on `cr:sessionEnd` event
  - [ ] Profile stored to `cr_sim_profile` + dispatched to `telemetry.js` adapter
- [ ] Longitudinal calibration check: if any dimension correlation < 0.15, calibration flag raised
- [ ] All micro-signal data uses pseudoUUID only — zero PII fields

**Gate:** After 3 sandbox sessions in sim mode, `cr_sim_profile` in localStorage
contains non-null values across at least 4 of the 6 dimensions. Console shows
`[SIM] telemetry.js` on each session upload. Wheel-spinning intervention fires
when >10 identical retry attempts are made.

---

## Phase 5 — Parent Dashboard: Growth Trajectory

**Delivers:** Parents see their child's play trajectory using growth-framed language.
No percentile scores. No static labels. Trends over time, suggested activities, crate preview.

- [ ] `src/modules/ParentDashboard.js`
  - [ ] Dimension trajectory visualizations (6 dimensions, time-series trend lines)
  - [ ] Growth-framed copy engine (all copy validated against anti-labeling rules in `CLAUDE.md`)
  - [ ] Session history log (date, duration, dimensions engaged)
  - [ ] Suggested next activities section (activities, not academic tracks)
  - [ ] Upcoming crate preview (based on current profile)
- [ ] Anti-labeling UX enforcement
  - [ ] No raw scores displayed
  - [ ] No percentile ranks displayed
  - [ ] No static trait labels ("Your child is a Spatial Thinker" — prohibited)
  - [ ] All low engagement reframed as "building focus in this area"
- [ ] Profile update animation fires on `cr:profileUpdated` event
- [ ] Dashboard renders null-safe when profile is empty (first-session state)
- [ ] Account settings accessible — including one-click data deletion trigger

**Gate:** Dashboard renders correctly with `cr_sim_profile` data present.
HPCSA language audit passes on all rendered dashboard copy. Dashboard renders
gracefully (no broken UI) when profile is empty.

---

## Phase 6 — Crate Recommendation Engine (70/20/10)

**Delivers:** The algorithm selects the contents of the next physical crate based
on the child's behavioral profile. Parents see a detailed, personalized kit preview.

- [ ] `src/modules/CrateRecommender.js` — 70/20/10 selection algorithm
  - [ ] 70% component: highest-engagement dimension drives primary kit type selection
  - [ ] 20% component: secondary dimension adds complementary activity layer
  - [ ] 10% component: lowest-engagement dimension adds gentle stretch challenge
  - [ ] Output: structured crate manifest (kit type, challenge card theme, accessory pack, insert)
- [ ] Crate manifest dispatched to `cr:crateReady` event
- [ ] `src/modules/CratePreview.js` — full kit preview UI
  - [ ] Crate contents listed with descriptions
  - [ ] Challenge card theme displayed
  - [ ] Accessory pack listed
  - [ ] Connection to dimensional profile explained in growth language
- [ ] Crate manifest stored to sim order queue via `pod.js` adapter (`[SIM]` path)
- [ ] Wheel-spinning intervention redirect: when `cr:wheelSpinDetected` fires,
      CrateRecommender generates a physical-task recommendation alongside digital adjustment

**Gate:** After Phase 4 generates a profile, CrateRecommender produces a
non-null crate manifest. CratePreview renders a complete, personalized kit
description. Console shows `[SIM] pod.js` with the crate manifest payload.

---

## Phase 7 — Subscription & Payment

**Delivers:** A parent can select a subscription plan, enter payment details,
and activate their subscription. In sim mode, payment auto-succeeds with a
fake confirmation number.

- [ ] `src/modules/SubscriptionManager.js`
  - [ ] Plan selection UI (Starter / Standard / Premium — null-safe for TBC prices)
  - [ ] Billing frequency toggle (monthly / annual)
  - [ ] Payment form (card fields — null-safe, sim accepts any input)
  - [ ] Payment submission → `payment.js` adapter
  - [ ] Subscription activation → `auth.js` adapter (updates account tier)
  - [ ] Confirmation receipt dispatched via `email.js` adapter
- [ ] Delivery channel selection during checkout
  - [ ] Pudo smart locker selection (map or postcode lookup → `delivery.js` adapter)
  - [ ] PEP Paxi pickup point selection (postcode lookup → `delivery.js` adapter)
  - [ ] Delivery address capture → `piiStore.js` adapter (hashed before storage)
- [ ] Subscription confirmation page (`mountConfirmation()` render path)
  - [ ] Order ID displayed (`cr-sim-XXXXXX` in sim mode)
  - [ ] Delivery method and estimated dispatch date displayed
  - [ ] Next crate preview displayed

**Gate:** Full checkout flow completes in sim mode. Console shows `[SIM] payment.js`,
`[SIM] delivery.js`, `[SIM] email.js`. Confirmation page renders with order ID.
Delivery address is stored with zero raw PII in telemetry localStorage.

---

## Phase 8 — Admin Shell & Order Management

**Delivers:** An internal admin surface for viewing orders, managing crate queues,
monitoring telemetry health, and triggering kitting instructions.

- [ ] `src/admin/AdminShell.js` — admin container, route guard (`/admin` path only)
- [ ] `src/admin/OrderQueue.js` — subscription order list
  - [ ] Order status filter (new / kitting / dispatched / delivered)
  - [ ] Order detail expand: child profile summary, crate manifest, delivery method
  - [ ] Status update actions (mark kitting / dispatched / delivered)
- [ ] `src/admin/CrateQueueView.js` — production queue for the fulfillment team
  - [ ] Grouped by crate type and dispatch date
  - [ ] Kitting instruction printout per order
  - [ ] POD trigger button → `pod.js` adapter (`[SIM]` queues print job)
- [ ] `src/admin/TelemetryMonitor.js` — telemetry health dashboard
  - [ ] Active profile count
  - [ ] Simulation flags status table (which integrations are still `[SIM]`)
  - [ ] Wheel-spinning incident log
  - [ ] Calibration flags: dimensions with correlation < 0.15 highlighted
- [ ] Admin modules confirmed never imported into customer render paths

**Gate:** `/admin` path renders AdminShell. Order queue displays sim orders from
`cr_sim_orders`. TelemetryMonitor shows all FLAGS. Admin path inaccessible via
customer navigation (no link, no accidental import).

---

## Phase 9 — Supply Chain & Delivery Integration

**Delivers:** The physical supply chain is wired. POD print jobs are dispatched to
the printing partner. Pudo and Paxi generate real shipping labels. Kitting instructions
are sent to the fulfillment hub.

- [ ] `delivery.js` adapter live path implemented (Pudo API + Paxi API)
  - [ ] Pudo locker lookup by postcode
  - [ ] Pudo shipping label generation
  - [ ] Paxi store lookup by postcode
  - [ ] Paxi consignment creation
- [ ] `pod.js` adapter live path implemented
  - [ ] Challenge card PDF generation triggered with bilingual content
  - [ ] Sticker pack and storytelling insert dispatch
- [ ] Kitting instruction PDF generation (automated from crate manifest)
- [ ] Fulfillment hub webhook: new order notification to kitting team
- [ ] `FLAGS.deliverySimulated` → `false` after Pudo + Paxi credentials confirmed
- [ ] `FLAGS.podSimulated` → `false` after POD provider credentials confirmed
- [ ] End-to-end test: order placed → POD triggered → Pudo label generated → admin shows dispatched

**Gate:** Real Pudo label generated for a test order. Real POD print job queued
for a test crate manifest. Admin order status updates to "dispatched" after label
generation. Zero sim console tags visible for delivery and POD paths.

---

## Phase 10 — ML Upgrade Layer (Phase 2 Architecture)

**Prerequisite:** 10,000+ active child profiles accumulated in Database B.
This phase is not scheduled — it is triggered by data volume milestone.

- [ ] Training dataset pipeline: export anonymized telemetry vectors from Database B
- [ ] Supervised model training: Random Forest / Gradient Boosted Trees
  - [ ] Features: all 10 micro-signal scores, session count, GAP metrics per dimension
  - [ ] Labels: long-term engagement retention, learning plateau indicators
- [ ] Unsupervised clustering: t-SNE / k-means
  - [ ] Play profile clusters defined (replacing manual categorization)
  - [ ] Cluster labels reviewed and confirmed by operator
- [ ] `mlAssessment.js` adapter live path implemented
  - [ ] Replaces static `assessmentTables.js` Bayesian tables for profile updates
  - [ ] Falls back to static tables if ML service is unavailable
- [ ] Learning plateau prediction integrated into CrateRecommender
  - [ ] Predicts plateau 2–3 crates in advance, adjusts stretch challenge
- [ ] `FLAGS.mlAssessmentSimulated` → `false` after SA-sovereign ML endpoint confirmed
- [ ] A/B comparison: Phase 1 static vs Phase 2 ML profile accuracy evaluated

**Gate:** ML service returns competency vector that matches or exceeds Phase 1
static engine accuracy on a held-out validation set. Crate recommendations
visibly diverge from Phase 1 recommendations on plateau-predicted profiles.

---

## Phase 11 — SEO & Launch Gate

**Delivers:** The production URL is indexable, structured data is in place, and
all pre-production validation checks pass with zero warnings.

- [ ] `src/core/SEOEngine.js` — dynamic head meta management
  - [ ] Title template: `[Page] | C.R.A.T.E.`
  - [ ] Open Graph tags (og:title, og:description, og:image, og:url)
  - [ ] Twitter card meta tags
  - [ ] Canonical URL tag
- [ ] Structured data (JSON-LD)
  - [ ] `Organization` schema with confirmed business details
  - [ ] `Product` schema for subscription offering
  - [ ] `WebSite` schema with SearchAction
- [ ] `public/sitemap.xml` — all indexable routes with confirmed domain
- [ ] `public/robots.txt` — toggled to `Allow: /` + Sitemap directive via `scripts/launch.js`
- [ ] `vercel.json` — staging noindex headers block removed for production config
- [ ] `scripts/launch.js` — passes with zero warnings
  - [ ] Zero null fields in `manifest.js`
  - [ ] Zero `true` flags in `flags.js`
- [ ] `npm run build` exits 0 — production build clean
- [ ] All confirmed values in `CRATE_BUILD_MANIFEST.md` resolve TBC fields
- [ ] HPCSA legal clearance opinion on file
- [ ] Formal POPIA compliance review completed

**Gate:** `npm run launch` exits with zero warnings. `npm run build` exits 0.
Production URL returns 200 with correct OG tags. Google Search Console shows
no crawl errors 48 hours after production deploy.

---

## SVVP Staging Checklist

Conditions that define the staging URL as a complete stakeholder demo.
All must pass before any external demonstration or investor presentation.

- [ ] Landing page renders fully at 390px, 768px, and 1440px
- [ ] Six play dimension cards visible with HPCSA-compliant labels
- [ ] Pricing section renders (null-safe TBC placeholders acceptable)
- [ ] Onboarding flow completes: registration → consent → OTP (000000) → child profile
- [ ] Sandbox loads offline (network disabled) — physics objects place and interact
- [ ] After 3 sim sessions, parent dashboard shows non-null trajectory data
- [ ] Dashboard copy passes HPCSA language audit (zero prohibited terms)
- [ ] Crate preview generates a personalized kit recommendation
- [ ] Checkout flow completes in sim mode — confirmation page shows order ID
- [ ] Admin panel accessible at `/admin` — sim orders visible
- [ ] All `[SIM]` adapters log correctly to browser console
- [ ] Zero unhandled null values reaching the DOM as literal "null"
- [ ] `npm run build` exits 0

---

## Switch Flip Log

Record each credential confirmation and flag resolution here.

| Date | Flag Key | Set to | Confirmed By |
|---|---|---|---|
| — | — | — | — |

---

## Pre-Production Final Gate

All items must be `[x]` before `vercel --prod`:

- [ ] All FLAGS in `flags.js` are `false`
- [ ] All null fields in `manifest.js` are resolved
- [ ] `scripts/launch.js` exits with zero warnings
- [ ] `npm run build` exits 0
- [ ] HPCSA language audit passes on production build output
- [ ] POPIA compliance review signed off
- [ ] HPCSA legal clearance opinion on file
- [ ] `vercel.json` staging noindex headers removed
- [ ] `public/robots.txt` set to `Allow: /` + Sitemap directive
- [ ] `public/sitemap.xml` regenerated with production domain and today's dates
- [ ] DNS pointing production domain to Vercel
- [ ] SSL certificate confirmed active on production domain
- [ ] Database A (PII Store) on SA-sovereign hosting confirmed live
- [ ] Database B (Telemetry Engine) on SA-sovereign hosting confirmed live
- [ ] All supply chain partner integrations tested end-to-end with real test orders
- [ ] `vercel --prod` executed
- [ ] Production URL returns 200
