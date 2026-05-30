// ── src/core/flags.js ───────────────────────────────────────────────────────
// FLAGS is the simulation/live switch registry for all external dependencies.
// All flags start as true — full simulation mode (SVVP state).
// Flipping one flag to false is the only code change needed to graduate that
// dependency from simulated to live. No component-level code changes required.
// See CRATE_BUILD_MANIFEST.md Feature Flags table for the resolving credential
// that justifies each flip.

export const FLAGS = Object.freeze({

  // Parent registration, login, session tokens — all simulated until auth
  // provider API key is confirmed and set in manifest.js
  authSimulated: true,

  // Subscription checkout and recurring billing — simulated until payment
  // gateway credentials (PayFast or Peach Payments) are confirmed
  paymentSimulated: true,

  // Micro-signal upload to Database B — stores in localStorage only until
  // telemetry DB connection string is confirmed (SA-sovereign)
  telemetrySimulated: true,

  // Parent PII writes to Database A — stores in localStorage only until
  // PII Store DB connection string is confirmed (SA-sovereign)
  piiStoreSimulated: true,

  // pseudoUUID↔parentRecordId token mapping — simulated until live DBs confirmed.
  // Note: tokenMap.js NEVER logs its mapping table, even in SIM mode.
  tokenMapSimulated: true,

  // POPIA consent OTP verification — auto-passes with code "000000" in SIM
  // until SMS provider API key is confirmed (SA mobile number pool)
  otpSimulated: true,

  // Pudo + Paxi shipping label generation — returns fake tracking until BOTH
  // Pudo API key AND Paxi API key are confirmed and set
  deliverySimulated: true,

  // Challenge card PDF print dispatch — logs payload only until POD provider
  // credentials are confirmed
  podSimulated: true,

  // Transactional email sends — console.log only until email provider API key
  // is confirmed
  emailSimulated: true,

  // Asset uploads — base64 localStorage persistence only until S3 Cape Town
  // bucket + IAM credentials are confirmed
  storageSimulated: true,

  // Phase 2 ML layer — remains true until 10,000+ active profiles and SA-sovereign
  // ML service endpoint is confirmed. Phase 1 static Bayesian engine in
  // assessmentTables.js runs locally with no flag.
  mlAssessmentSimulated: true,

})
