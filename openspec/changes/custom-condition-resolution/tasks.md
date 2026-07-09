## 1. Domain schema changes

- [ ] 1.1 Add `src/domain/hook/predicate.ts`: `PredicateNameSchema`/`PredicateName`, `Predicate = (fromPhaseId: PhaseId, visitCounts: Readonly<Record<PhaseId, number>>) => boolean`, and `PredicateRegistry { resolve(name: PredicateName): Predicate | undefined }`
- [ ] 1.2 `src/domain/phase/phase-graph.ts`: change `TransitionConditionSchema`'s `'custom'` case from `predicate: HookNameSchema` to `predicate: PredicateNameSchema`; drop the now-unused `HookNameSchema` import if nothing else in the file needs it
- [ ] 1.3 `src/domain/policy/completion-policy.ts`: remove the `'custom'` variant and `CompletionPolicyNameSchema`; update the file's doc comment (no longer "two-tier... plus a custom escape hatch")

## 2. Tests (update existing, add new coverage for the new behavior)

- [ ] 2.1 `tests/domain-v2.test.ts`: remove the `CompletionPolicySchema` `'custom'` parse assertion; add a `TransitionConditionSchema` `'custom'` parse test using `PredicateNameSchema`
- [ ] 2.2 `tests/timer.test.ts`: drop `'custom'` from the `test.each` throw table (now just `queueCycle`/`futureDate`); remove the now-unused `CompletionPolicyNameSchema` import if nothing else in the file needs it
- [ ] 2.3 Add `resolveNextPhaseId` tests in `tests/timer.test.ts` (or `src/timer/phase-graph.ts`'s existing test coverage, wherever `resolveNextPhaseId` is currently tested) for: a resolvable predicate returning `true` satisfies its transition; returning `false` falls through to the next candidate; an unresolved predicate name falls through without throwing; omitting `PredicateRegistry` entirely treats every `'custom'` condition as unsatisfied; every candidate unsatisfied still throws the existing "no eligible transition" error
- [ ] 2.4 Confirm (via the existing 18 three-argument `engineReducer(...)` call sites already in `tests/timer.test.ts`) that omitting `PredicateRegistry` doesn't change behavior for graphs with no `'custom'` transitions — no new test needed if these keep passing unmodified

## 3. Implementation

- [ ] 3.1 `src/timer/phase-graph.ts`: thread an optional `PredicateRegistry` parameter through `resolveNextPhaseId` → `isConditionSatisfied`; for `'custom'`, resolve via the registry and evaluate `predicate(fromPhaseId, visitCounts)`; treat an unresolved name or an absent registry as `false` instead of throwing
- [ ] 3.2 `src/timer/reducer.ts`: add an optional `PredicateRegistry` parameter to `engineReducer`, threaded through `advancePhase` into `resolveNextPhaseId`
- [ ] 3.3 `src/timer/store.ts`: `EngineStore` accepts an optional `PredicateRegistry` (new constructor parameter, stored alongside `hookRegistry`/`port`) and passes it to its `engineReducer` call in `dispatch`
- [ ] 3.4 `src/main.ts`: construct an empty `PredicateRegistry` (`resolve: () => undefined`) and pass it to `new EngineStore(...)`, matching `HookRegistry`'s starting state before flow-8to

## 4. Docs

- [ ] 4.1 `docs/examples/habit-tracking.md`: update the walk-through and "Where it strains" sections — the `'custom'` transition now resolves (falling through to `always` when unregistered, since no `isRestDay` predicate exists yet) instead of being a hard stop; keep noting no concrete predicate is registered anywhere
- [ ] 4.2 `docs/examples/README.md`: update the "Known gaps this doc surfaces repeatedly" section — remove or rephrase the "a `custom` transition condition throws (this is flow-b74)" line to reflect the new resolution mechanism

## 5. Quality gates

- [ ] 5.1 `bun run typecheck`
- [ ] 5.2 `bun run lint`
- [ ] 5.3 `bun run test`

## 6. Tracking and follow-up

- [ ] 6.1 Close flow-b74, referencing this change
- [ ] 6.2 Close flow-gu1.22, referencing the `'custom'` deletion and noting `queueCycle`/`futureDate` are split into a new follow-up issue
- [ ] 6.3 File a new bd issue for the missing "deliberate finish" event for duration-less/manual phases (docs/examples/workout.md, spaced-repetition.md), dep-chained as a blocker of the new `queueCycle`/`futureDate` issue
- [ ] 6.4 File a new bd issue for implementing real `queueCycle`/`futureDate` `CompletionPolicy` execution, depending on flow-djx and the new issue from 6.3
- [ ] 6.5 Archive this OpenSpec change once merged, syncing its delta specs into `openspec/specs/`
