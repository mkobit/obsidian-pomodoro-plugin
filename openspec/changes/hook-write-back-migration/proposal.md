## Why

`src/main.ts`'s `handlePhaseComplete`-equivalent (a `store.subscribe` callback that diffs `lastState.currentPhaseId` against `state.currentPhaseId`) calls `writeBackPhaseCompletion` directly on every phase change, entirely bypassing `EngineStore`'s own hook-firing machinery (`hookRegistry` is a stub — `{ resolve: () => undefined }` — because "no phase currently sets onEnter/onComplete/onSkip/onExit"). That machinery (`flow-qx9`, already shipped) exists specifically to resolve and invoke `Phase.onComplete` hooks and apply their `FileMutation[]`, but has never had a real hook registered against it. `flow-gu1.7`/`flow-gu1.8` (write-back trigger + input modal) are now both shipped, satisfying `flow-8to`'s stated prerequisites — this change does the migration.

## What Changes

- **`Hook` (`src/domain/hook/hook.ts`) becomes async**: `(context: HookContext) => Promise<readonly FileMutation[]>`, not `readonly FileMutation[]`. **BREAKING** for any future in-tree `Hook` implementation (none exist yet — this is the first). `EngineStore.dispatch` (`src/timer/store.ts`) awaits the hook's result before calling `applyMutations`, same as it already awaits `applyMutations` itself.
- **`HookContext` gains `activeFilePath: string | null`**, threaded from `EngineState.activeFilePath` by `synthesizeHookContext` (`src/timer/reducer.ts`). Distinct from `PhaseInstance.activeItem` (stays `null`, still pending `flow-djx`'s `TaskSource` work) — this is the plain-string concept `Phase.logTarget.kind === 'activeItem'` already resolves against.
- **A new `createWriteBackHook` factory** (`src/timer/write-back.ts` or a new `src/timer/write-back-hook.ts`) wraps today's `writeBackPhaseCompletion` logic as a `Hook`: resolves the target file path from `context.phase`/`context.activeFilePath`, reads the current value, computes the next log entry, awaits `WriteBackPromptPort.prompt(...)`, and returns either `[]` (no target resolved, or the user cancelled) or a single-element `FileMutation[]` (the user's submitted values). No direct `applyMutations` call inside it — `EngineStore.dispatch`'s existing loop applies whatever it returns, same as any other hook.
- **`POMODORO_PHASE_GRAPH`'s three phases (`focus`, `break`, `long-break`) each declare `onComplete` as a `HookReference`** pointing at the write-back hook's registered name — preserving today's "fires on every phase completion" behavior (break/long-break already resolve to no-op today since no `dailyNote` log-target resolver is registered; that's unchanged, not newly introduced by this migration).
- **`src/main.ts` constructs a real `HookRegistry`** that resolves that one name to the hook built from `writeBackDeps`, passes it to `EngineStore`'s constructor, and **removes** the `store.subscribe` diff-and-call-`writeBackPhaseCompletion` block — `EngineStore.dispatch`'s own hook-firing replaces it.
- `writeBackProperty` (a global `PomodoroSettings` field) stays a live closure read off `this.settings` at hook-construction time in `main.ts` (matching today's per-call `this.settings.writeBackProperty` read) — no per-phase `HookReference.params` threading. That's a separate, unscoped broadening (arguably `flow-00x`-adjacent), not part of a straight migration.

**Explicitly out of scope (follow-up work, not this change):**
- Per-phase opt-in/skip of the write-back modal (`flow-00x`).
- Richer value types/validation in the modal (`flow-9v9`).
- Agent-authored/scriptable hook handlers or a script-runner registry (`flow-gu1.10`) — this change's `Hook`-contract decision (async, single hook example) is deliberately made to give that future design something real to build against, not to preempt it.
- Real `PhaseInstance`/`Session` history tracking (`flow-c08`) — `HookContext.instance`/`.session` stay synthesized/throwaway as `flow-qx9` left them.
- `TaskSource`/`PhaseInstance.activeItem` runtime integration (`flow-djx`).

## Capabilities

### New Capabilities
(none — no new user-facing capability; this rewires an existing one onto existing machinery)

### Modified Capabilities
- `hook-execution`: `Hook`'s signature changes from synchronous to `Promise`-returning, and `EngineStore.dispatch` must `await` it before applying mutations.
- `frontmatter-write-back-trigger`: the write-back trigger's mechanism changes from a `main.ts`-level state-diff subscriber to a registered `Phase.onComplete` `Hook`, resolved and invoked through `EngineStore`/`HookRegistry`. The observable behavior (what gets written, when, with what prompt) is unchanged — this is a delivery-mechanism change, not a behavior change.

## Impact

- `src/domain/hook/hook.ts`: `Hook` type signature change (sync → async).
- `src/timer/reducer.ts`: `synthesizeHookContext` gains `activeFilePath` derivation.
- `src/timer/store.ts`: `dispatch`'s hook-invocation loop adds an `await` around `hook(...)`.
- `src/timer/write-back.ts` (or new `src/timer/write-back-hook.ts`): new `createWriteBackHook` factory; `writeBackPhaseCompletion` likely removed once the hook factory subsumes it (confirm during design/tasks — some of its logic, e.g. `resolveTargetFilePath`, is reused either way).
- `src/timer/phase-graph.ts`: `focusPhase`/`breakPhase`/`longBreakPhase` each get a real `onComplete` `HookReference` instead of `null`.
- `src/main.ts`: constructs a real `HookRegistry` resolving the write-back hook by name; removes the `store.subscribe` write-back diffing block.
- Tests: `tests/write-back.test.ts` (or wherever the fake `WriteBackPromptPort` helper lives) needs updating for the new hook-shaped entry point; `tests/timer.test.ts`/`EngineStore` tests may need a fake async `Hook` fixture if none exists yet.
- No change to `WriteBackPromptPort`, `WriteBackModal`, `FileMutationPort`, or `ObsidianFileMutationPort` — those stay exactly as `flow-gu1.7`/`flow-gu1.8` shipped them.
