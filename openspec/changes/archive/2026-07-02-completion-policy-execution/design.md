## Context

`engineReducer` (`src/timer/reducer.ts`) is a pure function over `EngineState` (`src/domain/session/engine-state.ts`) and `PhaseGraph` — it lives in `src/timer/**`, one of the four locations exempted from `eslint.config.mts`'s strict `functional` ruleset because the Obsidian API forces imperative patterns elsewhere in the plugin (switch statements, throw, etc. are already used here, e.g. `advancePhase`'s `requirePhaseById` throw and `src/timer/phase-graph.ts`'s `isConditionSatisfied`).

Today, `tick` treats "duration reached zero" and "advance to the next phase" as the same event — reaching zero unconditionally calls `advancePhase`. `Phase.completionPolicy` was added to the domain model (flow-gu1.13) to let a phase declare different completion behavior, but nothing reads it yet.

`EngineStore` (`src/timer/store.ts`) drives the ticker from `state.status === 'running'` (see `src/main.ts`'s subscriber) and the file-path write-back off `currentPhaseId` changing — both matter for how a new terminal-ish status interacts with existing code without changes there.

## Goals / Non-Goals

**Goals:**
- Make `manualClear` actually mean something: a phase with this policy stops at zero remaining and waits for an explicit `advance-phase` dispatch, instead of skipping straight to the next phase.
- Preserve today's behavior exactly for `null`/`noOp` policies (the only ones any shipped `PhaseGraph` uses) — zero risk of regressing `POMODORO_PHASE_GRAPH`.
- Give `queueCycle`/`futureDate`/`custom` an honest "not implemented" signal (throw) rather than a silent wrong behavior, consistent with the existing `'custom'` `TransitionCondition` precedent.
- Keep the change inside `src/timer/reducer.ts` and `src/domain/session/engine-state.ts` — no new files, no new public surface beyond one `EngineStatus` value.

**Non-Goals:**
- Producing or applying `FileMutation[]` for any policy. The reducer has no async escape hatch to `applyMutations` (`src/domain/mutation/apply-mutations.ts`) — that plumbing doesn't exist for hooks either yet (flow-qx9) and building it just for this change would mean redesigning it again once flow-qx9 lands. `futureDate`'s write-back and `queueCycle`'s queue mutation are both real `FileMutation`-producing behaviors deferred until that plumbing exists.
- Real `queueCycle` semantics (cycling a `TaskQueueItem`). `EngineState` has no queue-item state at all today (only `activeFilePath: string | null`); that needs `TaskSource`/`TaskQueueItem` integration, which is flow-gu1.9 and explicitly not ready.
- Disambiguating "skip" from "clear" as distinct `advance-phase`-like actions, or firing `onComplete`/`onSkip` hooks. Both are flow-qx9's concern — `Phase.onComplete`'s doc comment ("fired when this phase completes, naturally or manually cleared") already anticipates `advance-phase` serving both the manual-clear and manual-skip cases without the reducer itself needing to tell them apart.
- Any UI change. `src/views/timer-view.ts` already renders a generic non-"running" button; a purpose-built "Clear" affordance is flow-gu1.11.

## Decisions

**New `EngineStatus` value `'completed'`, not a boolean flag or a separate field.**
`EngineStatus` (`running`/`paused`/`stopped`) is already the single source of truth for "what is the ticker doing" and both consumers (`src/main.ts`'s `state.status === 'running'` ticker gate, `src/views/timer-view.ts`'s `state.status !== 'running'` button branch) key off it directly. Adding `'completed'` slots into both call sites for free: the ticker stops (since it's not `'running'`), and the view's existing "show a non-running button" branch still renders something, even though it doesn't yet special-case the label. A separate `awaitingClear: boolean` field would need both consumers updated to check two fields instead of one, for a distinction `EngineStatus` already exists to carry.
Alternative considered: reuse `'stopped'` for the completed-but-uncleared state. Rejected — `'stopped'` already means "reset to the graph's first phase" (see `initialEngineState`/the `stop` action), which is a different state (`currentPhaseId` back at the start, `remaining` at the first phase's full duration) than "sitting at a completed phase awaiting clear." Overloading it would make `stopped` ambiguous.

**Policy branch lives inline in `tick`, not as a new reducer case or a helper keyed by `EngineAction['type']`.**
Only the tick-driven (natural completion) path needs to consult `completionPolicy` — `advance-phase` is an explicit override and stays policy-blind (see Non-Goals). This is a single `if` inside the existing `remaining.sign > 0 ? ... : ...` ternary's else-branch, not a new action type or a parallel code path.

**`queueCycle`/`futureDate`/`custom` throw at the point they're reached, matching `isConditionSatisfied`'s `'custom'` `TransitionCondition` precedent in the same file's neighbor (`src/timer/phase-graph.ts`) — not a silent fallback to `null`/`noOp` behavior.**
A silent fallback would make a misconfigured phase (one that declares `queueCycle` before the engine can honor it) look like it works, then behave wrong the moment real `queueCycle`/`futureDate` semantics land and someone notices the auto-advance was never actually cycling the queue. Throwing fails loudly at the exact moment it matters, same trade-off already accepted for `'custom'` transitions. Since no shipped `PhaseGraph` configures these policies, the throw path isn't reachable in practice yet — this only matters once a routine author configures one, at which point loud failure is the right signal that flow-xn3's `queueCycle`/`futureDate` slice hasn't landed yet.

**`null` and `noOp` are handled identically at this branch point.**
Both mean "no special completion behavior for the reducer's state machine" — the difference (per `completion-policy.ts`'s doc comment, "no completion semantics at all" vs. an explicit no-op) only becomes observable once `onComplete` hooks fire (flow-qx9): a `null`-policy phase presumably still fires `onComplete` if one is configured on the phase (hooks are a separate field), while `noOp` is a real policy value a hook-firing implementation could pattern-match on. Nothing here needs that distinction yet.

## Risks / Trade-offs

- [`'completed'` is a new value on an existing, small `EngineStatusSchema` enum — any exhaustive `switch` over `EngineStatus` elsewhere would need updating] → Checked: no exhaustive switch over `EngineStatus` exists in `src/` today (only `===`/`!==` comparisons in `main.ts`/`timer-view.ts`), so this is additive with zero required call-site changes.
- [Throwing for `queueCycle`/`futureDate`/`custom` means a future routine author who configures one before the follow-up lands gets a hard crash, not a graceful degradation] → Accepted, matches the existing `'custom'` `TransitionCondition` precedent; the alternative (silent wrong behavior) is worse for a policy whose entire point is a specific side effect.
- [`src/views/timer-view.ts` doesn't yet have a "Clear" button, so a `manualClear` phase visibly renders a generic "Start" button at completion, which is a bit misleading] → Acceptable for this domain-first pass; the underlying mechanism (`advance-phase` from `'completed'`) is correct and tested, UI polish is flow-gu1.11's job.

## Migration Plan

Not applicable — additive `EngineStatus` value and new branching in an existing pure function; no persisted state, no data migration. `EngineState` isn't persisted across plugin reloads today (`EngineStore`'s constructor always calls `initialEngineState`), so there's no stored-state shape to migrate either.

## Open Questions

None outstanding — scope was narrowed during this design pass specifically to avoid overlapping with flow-qx9's not-yet-built `FileMutation`-routing plumbing (see Non-Goals); `queueCycle`/`futureDate`/`custom` real semantics are a deliberate, explicit follow-up rather than a gap discovered later.
