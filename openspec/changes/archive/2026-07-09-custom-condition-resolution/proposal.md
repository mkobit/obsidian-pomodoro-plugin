## Why

`docs/examples/habit-tracking.md` (flow-gu1.21) surfaced that a `'custom'` `TransitionCondition` is a hard stop today: `resolveNextPhaseId` throws unconditionally the moment one is evaluated, because `TransitionCondition.custom.predicate` is typed as `HookName` but `HookRegistry` only resolves to `Hook`, `(context) => Promise<FileMutation[]>` — there is no boolean-predicate registry anywhere (flow-b74). Investigating the sibling gap in the same area, `CompletionPolicy`'s `'custom'` variant (flow-gu1.22) turns out to be pure duplication once looked at closely: its shape is identical to `Hook`, and a phase wanting custom completion-time side effects already has `onComplete: HookReference` for exactly that — implementing a second, parallel resolution path for it would just create two ways to do the same thing.

## What Changes

- Add a `Predicate` type, `resolve(name): Predicate | undefined` via a new `PredicateRegistry`, mirroring `HookRegistry`'s shape but boolean-returning. `Predicate`'s context is deliberately narrower than `HookContext` — see design.md for why (in short: `HookContext` requires impure construction that can't happen synchronously inside the reducer, and this must be evaluated inside it).
- Give `TransitionCondition.custom`'s field its own branded `PredicateName` (replacing its current `HookName` typing), so it stops borrowing `Hook`'s namespace — a name registered as a predicate is not resolvable as a hook and vice versa.
- Thread a `PredicateRegistry` into `resolveNextPhaseId` / `engineReducer` as a new synchronous, optional dependency, mirroring how `PhaseGraph` is already injected. Unlike `Hook` resolution (which deliberately lives one layer up in `EngineStore.dispatch` so the reducer stays hook-unaware), this must be evaluated synchronously inside the pure reducer, since it decides `EngineState.currentPhaseId` itself.
- Change `resolveNextPhaseId`'s behavior for an unresolved or absent predicate: treat it as "condition not satisfied" (fall through to the next transition candidate) instead of throwing — matching `Hook`'s existing "resolve returns `undefined` => no-op" precedent.
- **BREAKING**: Remove `CompletionPolicy`'s `'custom'` variant and `CompletionPolicyNameSchema` entirely. A phase needing custom completion-time `FileMutation`s should declare an `onComplete` `HookReference` instead. `completePhase` continues to throw for the two remaining unimplemented variants, `queueCycle` and `futureDate` — those are unaddressed by this change (see Impact) and tracked as separate follow-up work.
- Update `docs/examples/habit-tracking.md` and `docs/examples/README.md`, which currently describe the `'custom'`-condition throw as a hard stop, to reflect that the mechanism now resolves (while noting no concrete `isRestDay` predicate is registered anywhere yet — `main.ts` wires an empty `PredicateRegistry`, same as `HookRegistry` before its first real hook).

## Capabilities

### New Capabilities
- `transition-predicate-resolution`: `PredicateRegistry`/`Predicate` types and `resolveNextPhaseId`'s resolution behavior for `'custom'` `TransitionCondition`s, including the unresolved-name fallback.

### Modified Capabilities
- `completion-policy-execution`: removes the `'custom'` completion-policy scenario (the variant no longer exists in `CompletionPolicySchema`); `queueCycle`/`futureDate` still throw, unchanged.

## Impact

- `src/domain/phase/phase-graph.ts`: `TransitionConditionSchema`'s `custom` case changes from `HookNameSchema` to a new `PredicateNameSchema`.
- `src/domain/policy/completion-policy.ts`: removes the `custom` variant and `CompletionPolicyNameSchema`.
- `src/timer/phase-graph.ts`: `resolveNextPhaseId`/`isConditionSatisfied` gain a `PredicateRegistry` parameter and resolve instead of throwing on `'custom'`.
- `src/timer/reducer.ts`: `engineReducer`'s signature grows a `PredicateRegistry` parameter (threaded through `advancePhase`).
- `src/timer/store.ts`: `EngineStore` accepts and threads through an optional `PredicateRegistry`, mirroring the existing optional `HookRegistry`/`FileMutationPort` pattern.
- `src/main.ts`: constructs an empty `PredicateRegistry` (`resolve: () => undefined`), same starting state `HookRegistry` had before flow-8to.
- Out of scope, tracked as separate bd follow-ups: implementing real `queueCycle`/`futureDate` semantics (blocked on flow-djx's `TaskSource` runtime integration) and the missing "deliberate finish" event for duration-less/manual phases (discovered via `docs/examples/workout.md` and `spaced-repetition.md` — the only exit from a duration-less phase today is `advance-phase`, which always derives `onSkip`, never `onComplete`).
