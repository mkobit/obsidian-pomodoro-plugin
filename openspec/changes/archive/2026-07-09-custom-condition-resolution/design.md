## Context

`engineReducer` (`src/timer/reducer.ts`) is deliberately pure and synchronous — no I/O, no wall-clock reads, no randomness. Everything that needs those (hook invocation, `FileMutation` application, `PhaseInstance`/`Session` synthesis via `crypto.randomUUID()`/`Temporal.Now.instant()`) is pushed one layer up into `EngineStore.dispatch` (`src/timer/store.ts`), which runs the reducer first and only then derives/fires hook events against the resulting state. This split is what makes `engineReducer` trivially testable today (`tests/timer.test.ts`, 18 call sites, no fakes needed for time or randomness).

`resolveNextPhaseId` (`src/timer/phase-graph.ts`) is called from inside this pure reducer (via `advancePhase`), to decide `EngineState.currentPhaseId` itself. Its `'custom'` `TransitionCondition` case currently throws unconditionally, because `TransitionCondition.custom.predicate` is typed as `HookName` and there is no predicate-shaped registry — only `HookRegistry`, which resolves to `Hook = (context: HookContext) => Promise<readonly FileMutation[]>`.

A first pass at this design assumed a `'custom'` predicate could just be `(context: HookContext) => boolean`, reusing `HookContext` as-is. That doesn't hold up: `HookContext` carries a freshly-constructed `PhaseInstance`/`Session` (via `synthesizeHookContext`, which calls `crypto.randomUUID()` and `Temporal.Now.instant()` — impure by construction) built from the reducer's *output* state. `resolveNextPhaseId` runs *before* the next state exists (it's what decides it), so there is no `HookContext` to hand a predicate at that point without either (a) making `engineReducer` impure, or (b) fabricating a not-yet-real "next state" to build one from, which is circular. See `docs/examples/habit-tracking.md`'s "Where it strains" section for the concrete use case (`isRestDay`) that originally motivated this.

## Goals / Non-Goals

**Goals:**
- Give `'custom'` `TransitionCondition` a real, non-throwing resolution path, keeping `engineReducer` pure and deterministic.
- Stop `TransitionCondition.custom` from borrowing `HookName`'s namespace (a name meant for one registry silently failing to resolve in the other, with no type-level signal).
- Remove `CompletionPolicy`'s `'custom'` variant, which duplicates `onComplete: HookReference` under a different schema.

**Non-Goals:**
- Supporting predicates that need external/async state (vault content, wall-clock date, anything requiring I/O) — those cannot be synchronous by construction and are out of scope here. `habit-tracking.md`'s concrete `isRestDay` example (checking a note for a rest-day marker) is *not* implementable on top of this change alone.
- Registering any real predicate anywhere. `main.ts` wires an empty `PredicateRegistry` (`resolve: () => undefined`), exactly as `HookRegistry` started before flow-8to populated it.
- Implementing `queueCycle`/`futureDate` `CompletionPolicy` execution (flow-djx + a new duration-less-phase-finish-event gap, filed separately).
- Revisiting whether predicate resolution should eventually share a mechanism with flow-gu1.10's script runner — that question stays open on flow-gu1.10.

## Decisions

**1. `Predicate`'s context is `(fromPhaseId: PhaseId, visitCounts: Readonly<Record<PhaseId, number>>)`, not `HookContext`.**
This is exactly what `resolveNextPhaseId`/`isConditionSatisfied` already have on hand synchronously and purely — the same inputs `'everyNth'` already uses. No new context type is introduced; a predicate that needs more than visit-count/phase-id data (i.e., anything real-world) isn't expressible yet, and that limitation is explicit rather than papered over with a richer-looking type nothing can safely populate.
*Alternative considered:* reuse `HookContext` — rejected per Context above (requires impure construction of a not-yet-real next state).

**2. New branded `PredicateName`, not reused `HookName`.**
`src/domain/hook/predicate.ts` adds `PredicateNameSchema = z.string().min(1).brand<'PredicateName'>()`. `TransitionCondition.custom.predicate` changes from `HookNameSchema` to this. A name registered as a predicate is now a type error if passed where a `HookName` is expected, and vice versa — closing the exact confusion `habit-tracking.md` flagged.
*Alternative considered:* keep `HookName`, just add a second registry keyed by the same brand — rejected, since nothing stops a caller from passing a hook's name to `PredicateRegistry.resolve` (or a predicate's name to `HookRegistry.resolve`) and silently getting `undefined` back with no signal anything was mistyped.

**3. Unresolved or absent predicate ⇒ condition not satisfied (`false`), not a throw.**
Mirrors `HookRegistry`'s existing "resolve returns `undefined` ⇒ skip, don't throw" precedent (`src/timer/store.ts:85-86`). `resolveNextPhaseId`'s existing final throw ("no eligible transition") remains the real safety net for a graph that's actually misconfigured (every candidate unsatisfied).

**4. Delete `CompletionPolicy`'s `'custom'` variant and `CompletionPolicyNameSchema` rather than building a parallel registry for it.**
Its shape, `(context) => FileMutation[]`, is identical to `Hook`, and a phase wanting custom completion-time mutations already has `onComplete: HookReference`. Building a second, same-shaped resolution path here would be exactly the interface/registry proliferation flagged in prior feedback on this domain layer (`HookRegistry`, `CompletionPolicy`+registry, `TaskSource` already exist as extension seams) — collapsing rather than adding one is the smaller, more consistent change.
*Alternative considered:* implement it via `HookRegistry` directly (reuse `HookName` for `CompletionPolicy.custom.name`) — rejected as strictly worse than deletion: it would keep two schema surfaces (`onComplete` and `completionPolicy: { kind: 'custom' }`) that do the same thing, and introduce an ordering question (does the completion-policy hook fire before or after the phase's own `onComplete`?) that deletion makes moot.

**5. `PredicateRegistry` threads through `resolveNextPhaseId` → `advancePhase` → `engineReducer` as a new **optional** parameter, defaulting to a no-op resolver when omitted.**
Mirrors how `HookRegistry`/`FileMutationPort` are optional on `EngineStore` today ("omitting either makes hook firing a no-op — existing/test construction sites don't need to supply fakes they don't care about"). All 18 existing `engineReducer(...)` call sites in `tests/timer.test.ts` keep working unchanged; only graphs that actually declare a `'custom'` transition need to supply one.

## Risks / Trade-offs

- **[Predicate context is narrower than `HookContext`, so real-world custom conditions can't be built on this alone]** → Documented as a non-goal. `flow-gu1.10` already has this exact tension open (whether predicate resolution needs an async-capable mechanism); resolving it there, holistically, beats bolting an async workaround onto this change now.
- **[Removing `CompletionPolicy.custom` is a breaking schema change]** → The variant was never executable (`completePhase` throws on it today) and `POMODORO_PHASE_GRAPH` never uses it. No persisted vault data is affected — `routine-file.ts`'s frontmatter conversion only special-cases `futureDate`, never `custom`.

## Migration Plan

None needed. No shipped phase graph or vault-persisted routine file uses `CompletionPolicy.custom` or `CompletionPolicyNameSchema`.

## Open Questions

None blocking this change. Whether `flow-gu1.10`'s eventual script-runner design should let predicates (or hooks) become resolvable against richer/async context, and whether that ever loops back to widen `Predicate` beyond `(fromPhaseId, visitCounts)`, is deferred to that ticket.
