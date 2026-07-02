## 1. Reducer-adjacent event derivation

- [x] 1.1 Add `deriveHookEvents(prevState, nextState, action, graph): readonly { event: HookEvent, phase: Phase }[]` to `src/timer/reducer.ts`, exported alongside `engineReducer`
- [x] 1.2 Implement the `manualClear` halt case: `tick`, `nextState.status === 'completed'`, `prevState.status !== 'completed'` → `[onComplete(currentPhase)]` only
- [x] 1.3 Implement the `null`/`noOp` auto-advance case: `tick`, `currentPhaseId` changes → `[onComplete(prevPhase), onExit(prevPhase), onEnter(nextPhase)]`
- [x] 1.4 Implement the skip case: `advance-phase`, `prevState.status` is `'running'` or `'paused'` → `[onSkip(prevPhase), onExit(prevPhase), onEnter(nextPhase)]`
- [x] 1.5 Implement the clear case: `advance-phase`, `prevState.status === 'completed'` → `[onExit(prevPhase), onEnter(nextPhase)]`
- [x] 1.6 Implement the stopped-reset case: `advance-phase`, `prevState.status === 'stopped'` → `[onExit(prevPhase), onEnter(nextPhase)]`
- [x] 1.7 All other actions (`start`/`pause`/`resume`/`stop`, or a `tick` that doesn't cross zero) → `[]`

## 2. Synthesized HookContext

- [x] 2.1 Add a helper (e.g. `synthesizeHookContext(phase, event, prevState, nextState): HookContext` in `src/timer/reducer.ts` or a new co-located file) building `instance`/`session` per design.md's field-derivation table
- [x] 2.2 `instance.id`/`session.id`: `crypto.randomUUID()`
- [x] 2.3 `instance.actualDuration`: `plannedDuration === null ? Duration.from({ seconds: 0 }) : plannedDuration.subtract(nextState.remaining ?? plannedDuration)`, or zero for `onEnter`
- [x] 2.4 `instance.startedAt`/`endedAt`, `session.startedAt`/`endedAt`: `Temporal.Now.instant()`, `endedAt: null` for `onEnter`
- [x] 2.5 `instance.endReason`: `'completed'` for `onComplete`, `'skipped'` for `onSkip`, `null` otherwise
- [x] 2.6 `instance.activeItem: null`, `itemsTouched: []`, `mutationsApplied: []`; `session.history: []`, `session.phaseGraphId: nextState.phaseGraphId`
- [x] 2.7 One-line comment at each provisional field noting it's superseded once flow-c08 lands

## 3. EngineStore wiring

- [x] 3.1 Add optional `HookRegistry`/`FileMutationPort` constructor params to `EngineStore` (`src/timer/store.ts`); omitting either disables hook firing entirely
- [x] 3.2 Change `dispatch`'s signature to `async dispatch(action: EngineAction): Promise<readonly { event: HookEvent, phase: Phase, result: ApplyMutationsResult }[]>`
- [x] 3.3 After calling `engineReducer` and updating `this.state`/notifying subscribers (unchanged), call `deriveHookEvents` and, for each returned event in order: resolve via `HookRegistry.resolve`; if resolved, build the `HookContext` (task 2), invoke the hook, and `applyMutations` the result against the configured `FileMutationPort`
- [x] 3.4 Skip (no entry in the returned summary) any event whose hook name doesn't resolve — don't throw, don't block other events
- [x] 3.5 Continue processing all derived events even if one's `applyMutations` result is `{ success: false }`
- [x] 3.6 Return the collected `{ event, phase, result }[]` from `dispatch`; never reject

## 4. Tests

- [x] 4.1 New test file (e.g. `tests/hook-execution.test.ts`) with fakes for `HookRegistry` and `FileMutationPort` in the style of `tests/apply-mutations.test.ts`
- [x] 4.2 Cover each spec scenario in `openspec/changes/hook-execution/specs/hook-execution/spec.md`: onExit/onEnter pairing, onComplete (manualClear halt and null/noOp auto-advance orderings), clearing a completed phase (no onComplete/onSkip), onSkip from running/paused, no-op actions, unresolved hook name skipped without throwing, failed mutation doesn't block other events, no-HookRegistry/FileMutationPort construction fires nothing, dispatch's resolved summary shape
- [x] 4.3 Confirm no existing test relies on `EngineStore.dispatch`'s previous synchronous/`void` signature (check `tests/timer.test.ts` and any other `EngineStore` usage); update call sites to `await`/handle the promise if needed

## 5. Verification

- [x] 5.1 `bun test ./tests` passes
- [x] 5.2 `bun run typecheck` passes
- [x] 5.3 `bun run lint` passes
- [x] 5.4 Close flow-qx9 in beads, referencing this change
