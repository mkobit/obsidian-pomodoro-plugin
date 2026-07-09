## 1. Domain: async Hook + activeFilePath

- [x] 1.1 Change `Hook` in `src/domain/hook/hook.ts` from `(context: HookContext) => readonly FileMutation[]` to `(context: HookContext) => Promise<readonly FileMutation[]>`
- [x] 1.2 Add `activeFilePath: string | null` to `HookContext` in `src/domain/hook/hook.ts`, with a one-line comment distinguishing it from `instance.activeItem` (reserved for flow-djx's TaskQueueItem work)

## 2. Engine wiring

- [x] 2.1 In `src/timer/reducer.ts`'s `synthesizeHookContext`, populate the new `activeFilePath` field from `nextState.activeFilePath`
- [x] 2.2 In `src/timer/store.ts`'s `EngineStore.dispatch` hook loop, `await` the `hook(...)` call before passing its result to `applyMutations` (see design.md's "Hook-produced FileMutations are applied via the configured FileMutationPort" decision)

## 3. Write-back hook factory

- [x] 3.1 Add a `WRITE_BACK_HOOK_NAME` branded `HookName` constant (e.g. in `src/timer/write-back.ts`)
- [x] 3.2 Add `createWriteBackHook(deps): Hook` to `src/timer/write-back.ts`, absorbing `writeBackPhaseCompletion`'s resolve/read/compute/prompt logic (reusing `resolveTargetFilePath` as-is): returns `[]` when no target resolves or the prompt is cancelled, otherwise a single-element `FileMutation[]` built from the submitted values. `deps` narrows to `{ logTargetResolverRegistry, frontmatterReader, writeBackPrompt, getWriteBackProperty: () => string }` — no `fileMutationPort` (that's `EngineStore`'s job now)
- [x] 3.3 Remove `writeBackPhaseCompletion` and the now-unused `WriteBackDeps`/`WriteBackResult` types once `createWriteBackHook` fully subsumes them

## 4. Phase graph + main.ts wiring

- [x] 4.1 In `src/timer/phase-graph.ts`, set `onComplete: { name: WRITE_BACK_HOOK_NAME, params: {} }` on `focusPhase`, `breakPhase`, and `longBreakPhase` (replacing `null`)
- [x] 4.2 In `src/main.ts`, construct `createWriteBackHook` with real deps (including `getWriteBackProperty: () => this.settings.writeBackProperty`), build a real `HookRegistry` resolving `WRITE_BACK_HOOK_NAME` to it, and pass that registry into `EngineStore`'s constructor
- [x] 4.3 Remove the `store.subscribe` block in `main.ts` that diffs `currentPhaseId` and calls `writeBackPhaseCompletion` directly — `EngineStore.dispatch`'s own hook-firing now covers this

## 5. Tests

- [x] 5.1 Update `tests/hook-execution.test.ts`'s inline `Hook` fakes (currently `(context): readonly FileMutation[] => [...]`) to return `Promise`s (e.g. `async (context) => [...]`), and add a scenario asserting `EngineStore` awaits an interactive hook (one whose promise resolves after a microtask/timer tick) before applying its mutations or starting the next derived event
- [x] 5.2 Port `tests/write-back.test.ts`'s scenarios (submit/cancel/edit/skip, activeItem/callback targets, unregistered/null-returning resolvers) from calling `writeBackPhaseCompletion` directly to invoking the `Hook` returned by `createWriteBackHook`, constructing a fake `HookContext` (with `activeFilePath` set/unset as each scenario needs) instead of passing `activeFilePath` as a separate argument
- [x] 5.3 Add/port a `tests/write-back-prompt.test.ts` check (or fold into 5.2) confirming `createWriteBackHook`'s returned hook never calls `frontmatterReader`/`writeBackPrompt` when the resolved target is `null`
- [x] 5.4 Add a `src/timer/phase-graph.ts` or `tests/store.test.ts` assertion that `focusPhase`/`breakPhase`/`longBreakPhase` each declare `onComplete` naming `WRITE_BACK_HOOK_NAME`

## 6. Manual verification

- [x] 6.1 Run the plugin in the dev vault (`scripts/vault-dev.ts`) and confirm a focus-phase completion still opens the write-back modal pre-filled exactly as before, and that submit/edit/cancel all behave identically to pre-migration behavior — per the `obsidian-verification-bun-vs-node` memory, drive via `bunx playwright test`, not a raw `bun -e`/CDP script, wrapped in `xvfb-run`

## 7. Quality gates

- [x] 7.1 `bun test ./tests` passes
- [x] 7.2 `bun run typecheck` passes
- [x] 7.3 `bun run lint` passes
- [x] 7.4 Close flow-8to in beads, referencing this change
