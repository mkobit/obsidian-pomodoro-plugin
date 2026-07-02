# completion-policy-execution Specification

## Purpose
TBD - created by archiving change completion-policy-execution. Update Purpose after archive.
## Requirements
### Requirement: manualClear halts at completion instead of auto-advancing
When the current phase's `completionPolicy.kind` is `manualClear` and a `tick` action brings `remaining` to zero (or below), `engineReducer` SHALL set `EngineState.status` to `'completed'` and SHALL NOT change `currentPhaseId` or `remaining`, and SHALL NOT call `advancePhase`.

#### Scenario: A manualClear phase reaching zero stops instead of advancing
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'manualClear' }` and `remaining` is zero
- **THEN** the resulting state has `status: 'completed'`, the same `currentPhaseId`, and the same (zero) `remaining`

### Requirement: advance-phase clears a completed manualClear phase
Dispatching `advance-phase` against an `EngineState` with `status: 'completed'` SHALL behave identically to dispatching it from `'running'` — resolving the next phase via the graph's transitions and returning to `status: 'stopped'` at that phase.

#### Scenario: advance-phase moves on from a completed phase
- **WHEN** `advance-phase` is dispatched against a state with `status: 'completed'`
- **THEN** the resulting state's `currentPhaseId` is the graph-resolved next phase, `remaining` is that phase's duration, and `status` is `'stopped'`

### Requirement: null and noOp completion policies preserve today's auto-advance
When the current phase's `completionPolicy` is `null` or `{ kind: 'noOp' }` and a `tick` action brings `remaining` to zero (or below), `engineReducer` SHALL call `advancePhase` exactly as it does today — unconditional immediate advance to the next phase, with no `'completed'` intermediate status.

#### Scenario: A null-policy phase reaching zero still auto-advances
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `null` and `remaining` is zero
- **THEN** the resulting state has advanced to the graph-resolved next phase with `status: 'stopped'`, matching pre-existing behavior

#### Scenario: A noOp-policy phase reaching zero still auto-advances
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'noOp' }` and `remaining` is zero
- **THEN** the resulting state has advanced to the graph-resolved next phase with `status: 'stopped'`, identically to the `null` case

### Requirement: Unimplemented completion policies throw at tick-driven completion
When the current phase's `completionPolicy.kind` is `queueCycle`, `futureDate`, or `custom` and a `tick` action would bring `remaining` to zero (or below), `engineReducer` SHALL throw rather than silently applying `null`/`noOp` behavior or partially executing the policy.

#### Scenario: queueCycle throws instead of silently advancing
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'queueCycle' }` and `remaining` is zero
- **THEN** `engineReducer` throws

#### Scenario: futureDate throws instead of silently advancing
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'futureDate', after: <duration> }` and `remaining` is zero
- **THEN** `engineReducer` throws

#### Scenario: custom throws instead of silently advancing
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'custom', name: <CompletionPolicyName> }` and `remaining` is zero
- **THEN** `engineReducer` throws
