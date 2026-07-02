## Context

`engineReducer` (`src/timer/reducer.ts`) is a pure function over `EngineState`/`PhaseGraph`. `EngineStore` (`src/timer/store.ts`) is the sole caller of `dispatch`, holding the current state and notifying subscribers — it already lives in `src/timer/**`, one of the four locations exempted from `eslint.config.mts`'s strict `functional` ruleset, so classes/mutation/async orchestration are already idiomatic here (unlike `src/domain/**`, which flow-2yp's `apply-mutations.ts` held to the stricter no-throw/no-class rules).

`Hook` (`src/domain/hook/hook.ts`) is `(context: HookContext) => readonly FileMutation[]` — synchronous, given `{ phase, instance, session }`. `HookRegistry.resolve(name)` is also synchronous. Only applying the resulting `FileMutation[]` (`applyMutations`, `src/domain/mutation/apply-mutations.ts`) is async. `PhaseInstance`/`Session` (`src/domain/session/session.ts`) are real domain types with required fields (`id`, `startedAt`/`endedAt` `Temporal.Instant`, `itemsTouched`, `mutationsApplied`, etc.) that `EngineState` does not track — `flow-c08` is the (currently downstream) issue for real history tracking.

`src/main.ts` currently drives side effects off state transitions itself: `store.subscribe` keeps a `lastState` closure variable and diffs `lastState.currentPhaseId !== state.currentPhaseId` to trigger a hardcoded frontmatter write. That pattern — diff old vs. new state in the layer that already sees every transition — is the shape this design reuses, moved into `EngineStore` itself so there's one place that owns "which lifecycle events just happened," not one per subscriber.

## Goals / Non-Goals

**Goals:**
- Resolve and invoke `onEnter`/`onComplete`/`onSkip`/`onExit` hooks at the correct moments, derived entirely from existing `EngineState`/`EngineAction`/`EngineStatus` — no new `EngineAction` variant.
- Apply the `FileMutation[]` a hook returns via `applyMutations`, through an injected `FileMutationPort` (a fake in tests; no real implementation this pass).
- Keep `engineReducer` pure and hook-unaware — all new logic lives in `EngineStore`.
- Make hook firing optional/injectable so `EngineStore` works unchanged (no-op hooks) when constructed without a registry — existing callers/tests aren't forced to supply one.

**Non-Goals:**
- A real Obsidian-backed `FileMutationPort`, or touching `src/main.ts`'s existing write-back. (See proposal.md's Explicitly out of scope.)
- Real `Session`/`PhaseInstance` history tracking (flow-c08) — this design synthesizes a throwaway context per hook call instead.
- Declaring hooks on `POMODORO_PHASE_GRAPH`.
- Any new `EngineAction` (e.g. a dedicated `skip-phase` action) — `onSkip` is derived from `advance-phase` dispatched against a non-`'completed'` status instead.
- Concurrent/overlapping hook execution — one `dispatch` call's hook firing completes (or fails) before that `dispatch` call returns its promise; `EngineStore.dispatch` becomes `async`.

## Decisions

**`EngineStore.dispatch` becomes `async`, returning `Promise<void>` once hook firing (if configured) settles.**
Today `dispatch` is synchronous and fire-and-forget (`src/timer/ticker.ts`'s `TimerTicker` calls it from a `setInterval` callback with no `await`). Making it `async` is additive — existing callers that don't `await` keep working exactly as before (an unhandled-but-not-thrown promise), and `TimerTicker`/`main.ts` are free to keep ignoring it. Callers that *do* want to know when hook-driven mutations have settled (e.g. future UI feedback) can `await`.
Alternative considered: keep `dispatch` synchronous and fire hooks in a detached `void (async () => {...})()` internally. Rejected — swallows the promise chain entirely, making the failure path (see below) unobservable even to a caller who wants it; an `async` method costs nothing extra for callers who don't care.

**Event derivation lives in a new pure function, `deriveHookEvents(prevState, nextState, action, graph): readonly { event: HookEvent, phase: Phase }[]`, in `src/timer/reducer.ts` (exported alongside `engineReducer`) — not inline in `EngineStore`.**
Keeps the "what happened" logic testable in isolation, next to `engineReducer`/`advancePhase`/`completePhase` which already encode the state machine it depends on (e.g. it needs to know `manualClear` vs `null`/`noOp` semantics, same as `completePhase` does). `EngineStore` calls it after `engineReducer` returns, using the pre- and post-reduce states plus the dispatched action — it doesn't duplicate reducer logic, just observes its output.
Derivation rules (applied to `(prevState, action, nextState)`), and the exact order events are emitted in when more than one rule matches the same dispatch:
- `action.type === 'tick'`, `nextState.status === 'completed'`, `prevState.status !== 'completed'` (`manualClear` halt, phase unchanged): emit only `{ event: 'onComplete', phase: currentPhase }` — no `onExit`/`onEnter` (the phase hasn't been left yet, just concluded).
- `action.type === 'tick'`, `prevState.currentPhaseId !== nextState.currentPhaseId` (`null`/`noOp` auto-advance, i.e. `completePhase` called `advancePhase` directly): emit, in order, `{ event: 'onComplete', phase: prevPhase }`, `{ event: 'onExit', phase: prevPhase }`, `{ event: 'onEnter', phase: nextPhase }` — the phase concludes, then is left, then the next one is entered.
- `action.type === 'advance-phase'`, `prevState.status === 'running'` or `'paused'` (abandoned before natural completion): emit, in order, `{ event: 'onSkip', phase: prevPhase }`, `{ event: 'onExit', phase: prevPhase }`, `{ event: 'onEnter', phase: nextPhase }`.
- `action.type === 'advance-phase'`, `prevState.status === 'completed'` (clearing a `manualClear` phase — `onComplete` already fired at the halt): emit, in order, `{ event: 'onExit', phase: prevPhase }`, `{ event: 'onEnter', phase: nextPhase }` — no `onComplete`, no `onSkip`.
- `action.type === 'advance-phase'`, `prevState.status === 'stopped'`: emit, in order, `{ event: 'onExit', phase: prevPhase }`, `{ event: 'onEnter', phase: nextPhase }` — matches today's behavior of `advancePhase` still resolving a next phase even from `'stopped'`; no phase was actively running, so no skip/complete.
- `pause`/`resume`/`stop`/`start`/a `tick` that doesn't cross zero: no events (no `currentPhaseId`/completion-relevant `status` change).
Alternative considered: derive events by diffing only `nextState` vs `prevState` with no `action` input (pure state-diffing, no action awareness). Rejected — `onSkip` vs. the `manualClear`-then-later-`advance-phase`-to-clear case are structurally identical state diffs (`status: 'completed' → 'stopped'`, `currentPhaseId` changes) but semantically different events (a `'completed'`-status phase already fired `onComplete`; clearing it isn't a skip). The action type is needed to disambiguate — see the next decision.

**Clearing a `'completed'` phase (`advance-phase` dispatched while `prevState.status === 'completed'`) fires only `onExit`/`onEnter`, not a second `onComplete` or an `onSkip`.**
`onComplete` already fired at the tick that produced `'completed'`. Firing it again on clear would double-fire for every `manualClear` phase. Firing `onSkip` would be wrong — the phase did complete, the user just hadn't dismissed it yet.

**`HookContext.instance`/`.session` are synthesized fresh per hook call, not carried on `EngineState`.**
Per the proposal's resolved Open Question, this is throwaway scaffolding: real field values where derivable, permissive defaults elsewhere, all discarded after the hook call.
- `instance.id` / `session.id`: freshly generated (`crypto.randomUUID()`, available in Obsidian's Electron/browser environment — no new dependency).
- `instance.phaseId`: the firing phase's id.
- `instance.plannedDuration`: that phase's `Phase.duration`.
- `instance.actualDuration`: for `onComplete`/`onExit`/`onSkip` (phase concluding), `plannedDuration === null ? Temporal.Duration.from({ seconds: 0 }) : plannedDuration.subtract(nextState.remaining ?? plannedDuration)` — best-effort "how much of the plan elapsed," not a wall-clock measurement (`EngineState` doesn't track one). For `onEnter`, `Temporal.Duration.from({ seconds: 0 })` (nothing has elapsed yet).
- `instance.startedAt` / `instance.endedAt` / `session.startedAt` / `session.endedAt`: `Temporal.Now.instant()` read at hook-fire time (same instant reused for both `instance.endedAt` and, if applicable, treated as "now" — not a real session start time, since `EngineState` doesn't track when the session began). `endedAt` is `null` for `onEnter` (phase just started, hasn't ended).
- `instance.endReason`: `'completed'` for `onComplete`, `'skipped'` for `onSkip`, `null` for `onEnter`/`onExit` (exit alone doesn't imply how the phase ended — the paired `onComplete`/`onSkip` event, if any, carries that).
- `instance.activeItem`: `null` (no `TaskSource`/`TaskQueueItem` runtime integration yet — flow-gu1.9).
- `instance.itemsTouched` / `instance.mutationsApplied`: `[]` (nothing tracked/applied yet at the moment the context is built — mutations from *this* hook call haven't been applied when the hook receives its context, since they're the hook's return value, not an input).
- `session.phaseGraphId`: `nextState.phaseGraphId`.
- `session.history`: `[]` (no accumulated history — this session object is not a real traversal record).
Each field derivation gets a one-line comment at its call site (not scattered doc-comments on the domain types, which stay unchanged) noting it's provisional pending flow-c08.
Alternative considered (from the earlier user decision): loosen `HookContext`'s type instead of synthesizing. Rejected per that decision — keeps `src/domain/hook/hook.ts` untouched, avoids a second domain-type revision once flow-c08 lands with the real shape.

**`EngineStore` fires and applies hooks sequentially per derived event, in the order `deriveHookEvents` returns them; failures are collected but don't stop later events or revert `EngineState`.**
`EngineState` has already transitioned by the time hooks fire (the reducer already ran) — there's no meaningful "roll back the timer" story if a hook's mutation fails, matching `advancePhase`'s existing "the timer always moves on" behavior. Each event: resolve via `HookRegistry.resolve` (skip silently if `undefined` — a `Phase` can reference a hook name that isn't registered yet, e.g. mid-configuration; this mirrors `FileMutationPort`'s per-mutation-kind granularity rather than failing the whole dispatch over one bad reference) → invoke the `Hook` → `applyMutations(port, mutations)` → on `{ success: false }`, keep going to the next event rather than aborting the batch (an `onExit` mutation failing shouldn't suppress the paired `onEnter`'s).
`EngineStore.dispatch`'s returned promise resolves with a summary (`{ event: HookEvent, phase: Phase, result: ApplyMutationsResult }[]`) rather than rejecting — consistent with `ApplyMutationsResult`'s resolved-result convention (`applyMutations` never rejects), and gives an `await`ing caller the per-event detail instead of collapsing multiple possible failures into one thrown error.
Alternative considered: abort remaining events on first failure (mirroring `applyMutations`'s own fail-fast-within-a-mutation-list behavior). Rejected at this granularity — `applyMutations`'s fail-fast is about ordering *within* one hook's mutation list (same file, real ordering dependency); different `HookEvent`s for different phases have no such dependency, so one failing shouldn't silently skip an unrelated one.

**`HookRegistry`/`FileMutationPort` are optional constructor params on `EngineStore`; omitting either makes hook firing a no-op.**
`new EngineStore(graph)` (today's call in `src/main.ts`) keeps compiling and behaving identically — no hooks fire because there's nothing to resolve them with. `new EngineStore(graph, { hookRegistry, port })` opts in. Avoids forcing every existing/future `EngineStore` construction site (tests included) to supply fakes it doesn't care about.

## Risks / Trade-offs

- [Synthesized `HookContext` fields (`actualDuration`, `startedAt`) are approximations, not real measurements — a hook that logs "time actually spent" will log something plan-derived, not wall-clock-accurate if the app was asleep/backgrounded mid-phase] → Accepted and documented; this is explicitly provisional per the resolved Open Question, superseded once flow-c08 lands. No shipped hook exists yet to be misled by it.
- [`crypto.randomUUID()` generates a new `instance`/`session` id on every single hook call (even multiple calls within one `dispatch`, e.g. `onExit`+`onEnter`), so `instance.id` is not stable across a phase's lifetime the way a real `PhaseInstance` id would be] → Accepted for this pass; nothing consumes/compares these ids yet (no persistence), so instability is unobservable. Flagged in code comments so flow-c08 doesn't inherit the assumption that these ids mean anything.
- [Making `dispatch` `async` changes its call signature; any test asserting on `dispatch`'s return value or calling it without `await` in a context that cares about ordering could behave subtly differently] → Checked: `EngineStore.dispatch`'s current return type is `void` (implicit), so no existing caller reads a return value; `tests/timer.test.ts` calls `dispatch` synchronously in sequence today — needs a pass to confirm no test relies on `dispatch` *not* returning a promise (e.g. strict-equality checks on a return value). Verify during implementation, not assumed clean here.
- [Silently skipping an unresolved `HookRegistry.resolve` name (rather than throwing) could hide a real misconfiguration] → Accepted: matches this project's existing precedent of `Phase.onEnter` etc. being `nullable` (many phases legitimately have no hook), so "name doesn't resolve" and "no hook declared" look the same on purpose for now. Revisit if a stricter validation pass is wanted later (e.g. `bd lint`-style config validation, out of scope here).

## Migration Plan

Not applicable — additive `EngineStore` constructor params (optional) and a new exported reducer-adjacent function; no persisted state, no data migration, no existing call site requires changes to keep compiling.

## Open Questions

None outstanding — the two forks that needed a decision before design (HookContext's Session/PhaseInstance requirement; how to disambiguate onSkip from onComplete without a new action) were resolved during proposal review: synthesize a throwaway context (user decision), and derive onSkip from `advance-phase`'s dispatch-time status rather than adding a new action (this document's own analysis, no fork remained once the state-machine was traced through).
