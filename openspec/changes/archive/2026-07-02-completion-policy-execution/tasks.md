## 1. Domain model

- [x] 1.1 Add `'completed'` to `EngineStatusSchema` in `src/domain/session/engine-state.ts`

## 2. Reducer

- [x] 2.1 In `src/timer/reducer.ts`'s `tick` case, branch on the current phase's `completionPolicy.kind` at the point `remaining.sign <= 0` (instead of unconditionally calling `advancePhase`)
- [x] 2.2 `manualClear` branch: return `{ ...state, status: 'completed' }`, unchanged `currentPhaseId`/`remaining`
- [x] 2.3 `null` and `noOp` branches: call `advancePhase` exactly as today (no behavior change)
- [x] 2.4 `queueCycle`/`futureDate`/`custom` branches: throw, matching `src/timer/phase-graph.ts`'s `isConditionSatisfied` `'custom'` precedent
- [x] 2.5 Leave `advance-phase` action handling unchanged — no policy branching there

## 3. Tests

- [x] 3.1 Add a `manualClear` phase to `tests/timer.test.ts`'s test graph (or a dedicated local graph) and test: `tick` at zero remaining sets `status: 'completed'` without changing `currentPhaseId`/`remaining`
- [x] 3.2 Test: `advance-phase` dispatched from `status: 'completed'` advances to the graph-resolved next phase with `status: 'stopped'`, same as from `'running'`
- [x] 3.3 Test: existing "tick at 0 advances to next phase and stops" case (implicit `null` policy) still passes unchanged
- [x] 3.4 Test: a `noOp`-policy phase at zero remaining advances identically to the `null` case
- [x] 3.5 Test: `tick` at zero remaining throws for `queueCycle`, `futureDate`, and `custom` policies (one case each)

## 4. Verification

- [x] 4.1 `bun test ./tests` passes
- [x] 4.2 `bun run typecheck` passes
- [x] 4.3 `bun run lint` passes
- [x] 4.4 Close flow-xn3 in beads, referencing this change
