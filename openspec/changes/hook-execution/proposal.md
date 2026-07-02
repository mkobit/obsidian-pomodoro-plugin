## Why

`Phase.onEnter`/`onComplete`/`onSkip`/`onExit` (`src/domain/hook/hook.ts`, `src/domain/phase/phase.ts`) exist in the domain model, and `flow-2yp` built the `FileMutation`-apply mechanism they need, but nothing in the engine resolves or invokes a `Hook` yet — `flow-gu1.17` deliberately left this out of scope when migrating the reducer to `PhaseGraph`. This change wires the mechanism: resolve declared hooks via a `HookRegistry` at the right dispatch-driven lifecycle moments and apply the resulting `FileMutation[]`.

## What Changes

- `EngineStore` (`src/timer/store.ts`) gains hook-firing: after each `dispatch` produces a new state, it diffs old vs. new `EngineState` to determine which `HookEvent`s fired for which phase, resolves each via an injected `HookRegistry`, invokes the `Hook` with a `HookContext`, and applies the resulting `FileMutation[]` via an injected `FileMutationPort` (`applyMutations` from `src/domain/mutation/apply-mutations.ts`). `engineReducer` itself stays pure/synchronous and gains no hook awareness — hook resolution and application is new orchestration around dispatch, not inside the reducer.
- Event-to-transition mapping (derived from existing `EngineAction`/`EngineStatus`, no new action type):
  - `onExit` (leaving phase A) / `onEnter` (entering phase B): fires whenever `currentPhaseId` changes, for both phases involved, regardless of how the transition happened.
  - `onComplete`: fires when a phase concludes on its own terms — tick-driven zero-crossing for `null`/`noOp` completion policy, or the tick-driven transition into `'completed'` status for `manualClear`.
  - `onSkip`: fires when `advance-phase` is dispatched while `status` is `'running'` or `'paused'` — i.e. a phase is abandoned before it naturally concluded. (`advance-phase` dispatched from `'completed'`, i.e. clearing a `manualClear` phase, is not a skip — `onComplete` already fired when `'completed'` was reached.)
- `HookContext` (`phase`, `instance`, `session`) is satisfied with a **synthesized, non-persisted** `PhaseInstance`/`Session` built fresh at the moment a hook fires — derived from what `EngineState` actually has (`currentPhaseId`, `remaining`, `activeFilePath`) plus a fresh id and clock read for the fields it doesn't (`startedAt`, `id`). Nothing is stored back onto `EngineState`; this is explicitly provisional scaffolding, not the real history-tracking flow-c08 will design. See design.md for exact field derivation and its documented limitations.

**Explicitly out of scope (follow-up work, not this change):**
- A real Obsidian-backed `FileMutationPort` implementation, or any change to `src/main.ts`/`src/settings.ts`'s existing hardcoded write-back (`handlePhaseComplete`, `writeBackProperty`). That's Obsidian-integration-layer work (this project's domain-first convention defers it) and overlaps with flow-gu1.7/flow-gu1.8's not-yet-scoped "write-back trigger"/"custom input modal" work — this change stays inside `src/timer/` + `src/domain/` and is exercised via test fakes, same boundary flow-2yp held for `FileMutationPort`.
- Declaring real hooks on `POMODORO_PHASE_GRAPH` (`src/timer/phase-graph.ts` — all phases currently have every hook field `null`). Wiring the shipped graph up to real hook behavior needs the real port above.
- Real `Session`/`PhaseInstance` history tracking (flow-c08) — this change's synthesized context is provisional scaffolding, not that design.

## Capabilities

### New Capabilities
- `hook-execution`: resolving and invoking `Phase.onEnter`/`onComplete`/`onSkip`/`onExit` hooks at the right `EngineStore` dispatch-driven lifecycle moments, and applying the resulting `FileMutation[]` via `FileMutationPort`.

### Modified Capabilities
(none — no existing `openspec/specs/` capability covers hook firing or `EngineStore`'s dispatch behavior yet)

## Impact

- `src/timer/store.ts`: `EngineStore` constructor takes an optional `HookRegistry` + `FileMutationPort`; `dispatch` gains post-reduce hook resolution/invocation/application.
- `src/domain/session/session.ts`, `src/domain/hook/hook.ts`: no type changes — `PhaseInstance`/`Session`/`HookContext` shapes are reused as-is for the synthesized context.
- New tests for `EngineStore`'s hook-firing behavior (event derivation, resolution, application, failure handling when `applyMutations` fails), using fakes for `HookRegistry`/`FileMutationPort` in the style of `tests/apply-mutations.test.ts`.
- No changes to `src/main.ts`, `src/settings.ts`, `src/timer/phase-graph.ts`, or `src/views/timer-view.ts`.
