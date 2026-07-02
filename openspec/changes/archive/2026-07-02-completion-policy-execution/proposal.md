## Why

`Phase.completionPolicy` (`src/domain/policy/completion-policy.ts`) exists in the domain model, but `src/timer/reducer.ts` never reads it — phase completion today is purely duration-driven (`tick` reaching `remaining.sign <= 0` always calls `advancePhase`, unconditionally moving to the next phase). A phase configured with `manualClear` should wait for an explicit action instead of auto-advancing the instant its duration elapses. Nothing branches on policy today, so that distinction doesn't exist yet.

## What Changes

- `engineReducer`'s `tick` case branches on the current phase's `completionPolicy.kind` when `remaining` reaches zero, instead of unconditionally calling `advancePhase`.
- `manualClear`: tick-to-zero stops the countdown and moves `EngineState.status` to a new `'completed'` value, without changing `currentPhaseId` or `remaining`. The existing `advance-phase` action (unchanged) is what actually moves to the next phase — dispatching it from `'completed'` works exactly as it already does from `'running'`.
- `null` and `noOp`: tick-to-zero keeps today's behavior exactly — call `advancePhase` immediately. (`noOp` and `null` are equivalent at this branch point; the distinction between "no completion semantics at all" and "explicit no-op policy" only matters once hooks fire on `onComplete`, which is flow-qx9, not this change.)
- `EngineStatusSchema` (`src/domain/session/engine-state.ts`) gains `'completed'` alongside `running`/`paused`/`stopped`.
- `advance-phase` itself is **not** changed — it continues to unconditionally advance regardless of policy, since it represents an explicit manual override (today's "skip", potentially also "clear" once flow-qx9 needs to distinguish `onSkip` from `onComplete` firing — that disambiguation is out of scope here).
- `queueCycle`, `futureDate`, and `custom` policies throw when reached at tick-to-zero completion — same precedent as `src/timer/phase-graph.ts`'s `isConditionSatisfied` throwing for the unimplemented `'custom'` `TransitionCondition`. None of the shipped phase graphs (`POMODORO_PHASE_GRAPH`) configure these yet, so nothing exercises the throw in practice.

**Explicitly out of scope (follow-up work, not this change):**
- Producing `FileMutation[]` for any policy (e.g. `futureDate`'s frontmatter write, `queueCycle`'s queue reorder/status change) — the reducer is a pure, synchronous function with no path to `applyMutations` (async) yet. That plumbing is shared with flow-qx9 (Hook execution) and doesn't exist for either.
- Real `queueCycle` behavior — cycling an active `TaskQueueItem` needs `TaskSource`/`TaskQueueItem` state that isn't tracked in `EngineState` at all (flow-gu1.9, not ready).
- Firing `onComplete`/`onSkip`/`onExit` hooks — flow-qx9.
- UI affordance for clearing a `'completed'` phase — `src/views/timer-view.ts`'s Start/Pause toggle isn't touched; it already renders *some* button when `status !== 'running'`, just not a purpose-built "Clear" one. That's flow-gu1.11 (status bar/view panel), not this change.

## Capabilities

### New Capabilities
- `completion-policy-execution`: reducer-level branching on `Phase.completionPolicy.kind` at natural (tick-driven) phase completion, including the new `'completed'` `EngineStatus` that `manualClear` phases sit in until explicitly advanced.

### Modified Capabilities
(none — no existing `openspec/specs/` capability covers the timer engine's completion behavior yet; `EngineState`/`engineReducer` predate OpenSpec adoption)

## Impact

- `src/timer/reducer.ts`: `tick` case branches on `completionPolicy.kind`; new local logic for the `manualClear` branch and the throwing branches.
- `src/domain/session/engine-state.ts`: `EngineStatusSchema` adds `'completed'`.
- `tests/timer.test.ts`: new cases for `manualClear` (halts at completion, `advance-phase` clears it), `null`/`noOp` (unchanged auto-advance), and `queueCycle`/`futureDate`/`custom` (throw).
- No changes to `src/main.ts`, `src/views/timer-view.ts`, `src/timer/store.ts`, `src/domain/mutation/**`, `src/domain/hook/**`, `src/domain/queue/**`.
- Partially unblocks flow-731 (tracked in beads, not in this proposal); flow-c08 still additionally needs flow-qx9.
