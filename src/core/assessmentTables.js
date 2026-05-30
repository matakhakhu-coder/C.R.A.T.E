// ── src/core/assessmentTables.js ────────────────────────────────────────────
// Phase 1 static Bayesian assessment engine.
// No network call. No flag required. Runs entirely on-device.
// Grounded in Cattell-Horn-Carroll (CHC) theory and Torrance Tests of Creative
// Thinking (TTCT) to map play mechanics to six activity interest areas.
//
// Architecture note: This module is READ-ONLY data. The AssessmentEngine module
// (Phase 4) imports these tables and performs all computation. This separation
// keeps the data layer pure and replaceable when the Phase 2 ML layer activates.
//
// HPCSA guardrail: All labels, descriptions, and any user-visible strings in
// this module use growth-framed terminology only. No clinical or diagnostic
// language anywhere.
//
// Phase 2 upgrade path: When active profile count exceeds 10,000, the
// mlAssessment.js adapter replaces these static tables with a live ML service.
// The AssessmentEngine falls back to these tables if that service is unavailable.

export const BAYESIAN_ASSESSMENT_MATRIX = Object.freeze({

  // ── Engine metadata ─────────────────────────────────────────────────────────
  version:          '1.0.0-static',
  engineType:       'deterministic-bayesian',
  calibrationCycle: 1,

  // ── Competency state labels (HPCSA-compliant, growth-framed) ───────────────
  // These are the three internal states of the model. They are never shown
  // verbatim to parents — the dashboard translates them to growth copy.
  competencyStates: Object.freeze(['emerging', 'developing', 'established']),

  // ── State advancement thresholds ───────────────────────────────────────────
  // Minimum posterior probability required to advance a child's state label.
  // Used by AssessmentEngine.updateProfile() in Phase 4.
  advancementThresholds: Object.freeze({
    emergingToDeveloping:   0.60,
    developingToEstablished: 0.70,
  }),

  // ── Longitudinal calibration floor ─────────────────────────────────────────
  // If correlation between any dimension's telemetry signals and observed
  // outcomes falls below this value, a calibration flag is raised.
  // See CRATE_ROADMAP.md Phase 4 for the calibration loop procedure.
  minimumSignalCorrelation: 0.15,

  // ── Wheel-spinning detection ────────────────────────────────────────────────
  // Retry count threshold after which unproductive struggle is flagged.
  // Triggers cr:wheelSpinDetected event in AssessmentEngine.
  wheelSpinRetryThreshold: 10,

  // ── Prior probabilities ─────────────────────────────────────────────────────
  // Default distribution across competency states for a new profile with no
  // session data. Weighted toward 'emerging' to avoid premature labeling.
  defaultPriors: Object.freeze({
    emerging:    0.50,
    developing:  0.35,
    established: 0.15,
  }),

  // ── Micro-signal index ──────────────────────────────────────────────────────
  // Maps each of the 10 telemetry micro-signals to its scoring key and the
  // direction of evidence (high raw value = more or less signal strength).
  // Used by TelemetryCollector (Phase 4) to normalize raw observations.
  microSignals: Object.freeze({
    timeToFirstAction: Object.freeze({
      key:         'timeToFirstAction',
      unit:        'milliseconds',
      description: 'Time between level load and first physics-altering input',
      // High value = deliberate, planful approach
      highMeaning: 'deliberate planning before acting',
    }),
    retryFrequency: Object.freeze({
      key:         'retryFrequency',
      unit:        'count',
      description: 'Number of level resets, restarts, or total clearance events',
      highMeaning: 'high persistence and tolerance for challenge',
    }),
    explorationBreadth: Object.freeze({
      key:         'explorationBreadth',
      unit:        'ratio',   // unique interaction area / total canvas area
      description: 'Spatial coverage of interactions relative to total canvas area',
      highMeaning: 'wide spatial exploration and curiosity-driven movement',
    }),
    abandonmentPoints: Object.freeze({
      key:         'abandonmentPoints',
      unit:        'count',
      description: 'Number of challenges exited before completion',
      highMeaning: 'lower frustration threshold — emerging focus area',
    }),
    sequencePaths: Object.freeze({
      key:         'sequencePaths',
      unit:        'complexity-score',   // derived from DAG of action types
      description: 'Logical ordering and variety of action sequences (DAG complexity)',
      highMeaning: 'structured, multi-step planning and sequential reasoning',
    }),
    optionalInteractions: Object.freeze({
      key:         'optionalInteractions',
      unit:        'count',
      description: 'Non-essential decorative or narrative assets placed in the sandbox',
      highMeaning: 'intrinsic motivation and imaginative elaboration',
    }),
    ruleBreakingAttempts: Object.freeze({
      key:         'ruleBreakingAttempts',
      unit:        'count',
      description: 'Actions testing collision limits, boundary violations, physics constraints',
      highMeaning: 'boundary-testing and out-of-the-box exploration',
    }),
    backtrackingBehavior: Object.freeze({
      key:         'backtrackingBehavior',
      unit:        'ratio',   // undo actions / total actions
      description: 'Frequency of undo actions or deletion of recently placed components',
      highMeaning: 'active error monitoring and self-correction',
    }),
    speedVariability: Object.freeze({
      key:         'speedVariability',
      unit:        'std-dev-ms',
      description: 'Standard deviation of input intervals during active construction phases',
      highMeaning: 'alternating focused action and reflective pauses',
    }),
    creativeModifications: Object.freeze({
      key:         'creativeModifications',
      unit:        'ratio',   // non-standard combos / total construction steps
      description: 'Ratio of non-standard tool combinations to total construction steps',
      highMeaning: 'practical elaboration and adaptive problem-solving',
    }),
  }),

  // ── Dimension definitions ───────────────────────────────────────────────────
  // Six activity interest areas. Each dimension has:
  //   label          — HPCSA-compliant display name
  //   chcAlignment   — Cattell-Horn-Carroll broad/narrow ability codes
  //   ttctAlignment  — Torrance TTCT fluency markers
  //   priors         — Prior competency-state distribution for this dimension
  //   primarySignals — Micro-signals with the strongest evidential weight
  //   signalWeights  — P(signal = HIGH | competency state) for all 10 signals
  //                    Higher P(high|established) than P(high|emerging) = positive indicator
  //                    Lower P(high|established) than P(high|emerging) = inverse indicator
  dimensions: Object.freeze({

    // ── Curiosity ─────────────────────────────────────────────────────────────
    curiosity: Object.freeze({
      label:         'Curiosity',
      chcAlignment:  Object.freeze(['Gc', 'Gkn']),
      ttctAlignment: Object.freeze(['Information Search', 'Problem Sensitivity']),
      priors: Object.freeze({
        emerging: 0.50, developing: 0.35, established: 0.15,
      }),
      primarySignals: Object.freeze([
        'explorationBreadth', 'optionalInteractions', 'ruleBreakingAttempts',
      ]),
      // P(signal_high | competency_state)
      signalWeights: Object.freeze({
        timeToFirstAction:     Object.freeze({ emerging: 0.30, developing: 0.52, established: 0.65 }),
        retryFrequency:        Object.freeze({ emerging: 0.35, developing: 0.52, established: 0.68 }),
        explorationBreadth:    Object.freeze({ emerging: 0.18, developing: 0.48, established: 0.85 }), // primary
        abandonmentPoints:     Object.freeze({ emerging: 0.65, developing: 0.40, established: 0.18 }), // inverse
        sequencePaths:         Object.freeze({ emerging: 0.30, developing: 0.50, established: 0.62 }),
        optionalInteractions:  Object.freeze({ emerging: 0.15, developing: 0.42, established: 0.82 }), // primary
        ruleBreakingAttempts:  Object.freeze({ emerging: 0.18, developing: 0.50, established: 0.84 }), // primary
        backtrackingBehavior:  Object.freeze({ emerging: 0.28, developing: 0.48, established: 0.60 }),
        speedVariability:      Object.freeze({ emerging: 0.38, developing: 0.50, established: 0.55 }),
        creativeModifications: Object.freeze({ emerging: 0.20, developing: 0.45, established: 0.72 }),
      }),
    }),

    // ── Spatial Reasoning ─────────────────────────────────────────────────────
    spatialReasoning: Object.freeze({
      label:         'Spatial Reasoning',
      chcAlignment:  Object.freeze(['Gv', 'Vz', 'SR']),
      ttctAlignment: Object.freeze(['Figural Synthesis', 'Spatial Rotation']),
      priors: Object.freeze({
        emerging: 0.50, developing: 0.35, established: 0.15,
      }),
      primarySignals: Object.freeze([
        'explorationBreadth', 'sequencePaths', 'backtrackingBehavior',
      ]),
      signalWeights: Object.freeze({
        timeToFirstAction:     Object.freeze({ emerging: 0.32, developing: 0.52, established: 0.72 }),
        retryFrequency:        Object.freeze({ emerging: 0.30, developing: 0.48, established: 0.62 }),
        explorationBreadth:    Object.freeze({ emerging: 0.22, developing: 0.50, established: 0.82 }), // primary
        abandonmentPoints:     Object.freeze({ emerging: 0.60, developing: 0.38, established: 0.20 }), // inverse
        sequencePaths:         Object.freeze({ emerging: 0.18, developing: 0.52, established: 0.84 }), // primary
        optionalInteractions:  Object.freeze({ emerging: 0.28, developing: 0.45, established: 0.58 }),
        ruleBreakingAttempts:  Object.freeze({ emerging: 0.25, developing: 0.48, established: 0.65 }),
        backtrackingBehavior:  Object.freeze({ emerging: 0.15, developing: 0.45, established: 0.80 }), // primary
        speedVariability:      Object.freeze({ emerging: 0.28, developing: 0.50, established: 0.68 }),
        creativeModifications: Object.freeze({ emerging: 0.22, developing: 0.45, established: 0.65 }),
      }),
    }),

    // ── Systems Thinking ──────────────────────────────────────────────────────
    systemsThinking: Object.freeze({
      label:         'Systems Thinking',
      chcAlignment:  Object.freeze(['Gf', 'RG', 'I']),
      ttctAlignment: Object.freeze(['Relational Synthesis', 'Boundary Extension']),
      priors: Object.freeze({
        emerging: 0.50, developing: 0.35, established: 0.15,
      }),
      primarySignals: Object.freeze([
        'sequencePaths', 'backtrackingBehavior', 'speedVariability',
      ]),
      signalWeights: Object.freeze({
        timeToFirstAction:     Object.freeze({ emerging: 0.32, developing: 0.54, established: 0.78 }),
        retryFrequency:        Object.freeze({ emerging: 0.35, developing: 0.52, established: 0.65 }),
        explorationBreadth:    Object.freeze({ emerging: 0.28, developing: 0.48, established: 0.62 }),
        abandonmentPoints:     Object.freeze({ emerging: 0.62, developing: 0.36, established: 0.16 }), // inverse
        sequencePaths:         Object.freeze({ emerging: 0.14, developing: 0.50, established: 0.87 }), // primary
        optionalInteractions:  Object.freeze({ emerging: 0.25, developing: 0.42, established: 0.55 }),
        ruleBreakingAttempts:  Object.freeze({ emerging: 0.28, developing: 0.48, established: 0.65 }),
        backtrackingBehavior:  Object.freeze({ emerging: 0.18, developing: 0.48, established: 0.82 }), // primary
        speedVariability:      Object.freeze({ emerging: 0.22, developing: 0.50, established: 0.80 }), // primary
        creativeModifications: Object.freeze({ emerging: 0.25, developing: 0.48, established: 0.70 }),
      }),
    }),

    // ── Narrative Imagination ─────────────────────────────────────────────────
    narrativeImagination: Object.freeze({
      label:         'Narrative Imagination',
      chcAlignment:  Object.freeze(['Gc', 'Glr']),
      ttctAlignment: Object.freeze(['Originality', 'Storytelling Articulateness', 'Fantasy']),
      priors: Object.freeze({
        emerging: 0.50, developing: 0.35, established: 0.15,
      }),
      primarySignals: Object.freeze([
        'optionalInteractions', 'creativeModifications', 'ruleBreakingAttempts',
      ]),
      signalWeights: Object.freeze({
        timeToFirstAction:     Object.freeze({ emerging: 0.30, developing: 0.48, established: 0.62 }),
        retryFrequency:        Object.freeze({ emerging: 0.30, developing: 0.48, established: 0.60 }),
        explorationBreadth:    Object.freeze({ emerging: 0.25, developing: 0.48, established: 0.68 }),
        abandonmentPoints:     Object.freeze({ emerging: 0.58, developing: 0.38, established: 0.22 }), // inverse
        sequencePaths:         Object.freeze({ emerging: 0.28, developing: 0.48, established: 0.62 }),
        optionalInteractions:  Object.freeze({ emerging: 0.12, developing: 0.38, established: 0.88 }), // primary
        ruleBreakingAttempts:  Object.freeze({ emerging: 0.20, developing: 0.45, established: 0.75 }), // primary
        backtrackingBehavior:  Object.freeze({ emerging: 0.25, developing: 0.45, established: 0.60 }),
        speedVariability:      Object.freeze({ emerging: 0.32, developing: 0.50, established: 0.60 }),
        creativeModifications: Object.freeze({ emerging: 0.15, developing: 0.42, established: 0.85 }), // primary
      }),
    }),

    // ── Mechanical Intuition ──────────────────────────────────────────────────
    mechanicalIntuition: Object.freeze({
      label:         'Mechanical Intuition',
      chcAlignment:  Object.freeze(['Gv', 'Gkn']),
      ttctAlignment: Object.freeze(['Elaborative Construction', 'Figural Completion']),
      priors: Object.freeze({
        emerging: 0.50, developing: 0.35, established: 0.15,
      }),
      primarySignals: Object.freeze([
        'creativeModifications', 'sequencePaths', 'retryFrequency',
      ]),
      signalWeights: Object.freeze({
        timeToFirstAction:     Object.freeze({ emerging: 0.35, developing: 0.52, established: 0.72 }),
        retryFrequency:        Object.freeze({ emerging: 0.28, developing: 0.50, established: 0.75 }), // primary
        explorationBreadth:    Object.freeze({ emerging: 0.28, developing: 0.48, established: 0.62 }),
        abandonmentPoints:     Object.freeze({ emerging: 0.58, developing: 0.35, established: 0.18 }), // inverse
        sequencePaths:         Object.freeze({ emerging: 0.20, developing: 0.50, established: 0.78 }), // primary
        optionalInteractions:  Object.freeze({ emerging: 0.28, developing: 0.45, established: 0.58 }),
        ruleBreakingAttempts:  Object.freeze({ emerging: 0.30, developing: 0.50, established: 0.68 }),
        backtrackingBehavior:  Object.freeze({ emerging: 0.22, developing: 0.48, established: 0.70 }),
        speedVariability:      Object.freeze({ emerging: 0.40, developing: 0.50, established: 0.45 }), // low variability = fluent execution
        creativeModifications: Object.freeze({ emerging: 0.18, developing: 0.48, established: 0.85 }), // primary
      }),
    }),

    // ── Divergent Thinking ────────────────────────────────────────────────────
    divergentThinking: Object.freeze({
      label:         'Divergent Thinking',
      chcAlignment:  Object.freeze(['Grw']),
      ttctAlignment: Object.freeze([
        'Fluency', 'Originality', 'Elaboration', 'Resistance to Premature Closure',
      ]),
      priors: Object.freeze({
        emerging: 0.50, developing: 0.35, established: 0.15,
      }),
      primarySignals: Object.freeze([
        'ruleBreakingAttempts', 'creativeModifications', 'optionalInteractions',
      ]),
      signalWeights: Object.freeze({
        timeToFirstAction:     Object.freeze({ emerging: 0.30, developing: 0.48, established: 0.58 }),
        retryFrequency:        Object.freeze({ emerging: 0.28, developing: 0.50, established: 0.72 }),
        explorationBreadth:    Object.freeze({ emerging: 0.22, developing: 0.48, established: 0.78 }),
        abandonmentPoints:     Object.freeze({ emerging: 0.55, developing: 0.35, established: 0.25 }), // inverse
        sequencePaths:         Object.freeze({ emerging: 0.28, developing: 0.48, established: 0.65 }),
        optionalInteractions:  Object.freeze({ emerging: 0.18, developing: 0.45, established: 0.80 }), // primary
        ruleBreakingAttempts:  Object.freeze({ emerging: 0.15, developing: 0.42, established: 0.88 }), // primary
        backtrackingBehavior:  Object.freeze({ emerging: 0.25, developing: 0.48, established: 0.62 }),
        speedVariability:      Object.freeze({ emerging: 0.32, developing: 0.50, established: 0.65 }),
        creativeModifications: Object.freeze({ emerging: 0.15, developing: 0.45, established: 0.88 }), // primary
      }),
    }),

  }),

})
