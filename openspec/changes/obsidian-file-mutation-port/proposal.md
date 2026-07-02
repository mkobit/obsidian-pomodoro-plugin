## Why

`FileMutationPort` (src/domain/mutation/apply-mutations.ts) has only ever had a test fake behind it. `EngineStore` (src/timer/store.ts) has accepted an optional `hookRegistry`/`port` pair since flow-qx9, but `main.ts` never supplies them, so hook-produced `FileMutation`s have nowhere real to land. Without a real port, the hook-execution and mutation-apply machinery already built stays inert.

## What Changes

- Add `ObsidianFileMutationPort`, a `FileMutationPort` implementation backed by Obsidian's `app.vault`/`app.fileManager` APIs.
  - `writeFrontmatter`: resolve the mutation's `filePath` to a `TFile`, then set the property via `fileManager.processFrontMatter`.
  - `appendText`: resolve the `TFile`, then append via `vault.append`.
  - `reorderQueueItem` / `changeQueueItemStatus`: reject with a "not yet supported" error. `FileMutation`'s `queueReorder`/`queueStatusChange` variants carry only a branded `TaskQueueItemId`, not a file path, and there is no TaskSource/queue runtime yet to resolve an id to a vault file (tracked separately as flow-gu1.9). Implementing these for real is out of scope here.
  - Any `filePath` that doesn't resolve to a `TFile` rejects the returned promise, which `applyMutations` already turns into a `{ success: false, ... }` result.
- Wire `main.ts` to construct `EngineStore` with the new port and a `HookRegistry`. No phase in `POMODORO_PHASE_GRAPH` currently sets any hook reference (`onEnter`/`onComplete`/`onSkip`/`onExit` all default to `null`), so an empty registry (`{ resolve: () => undefined }`) is sufficient to complete the wiring — there is nothing to resolve yet.

**Out of scope:** migrating `main.ts`'s existing hardcoded `handlePhaseComplete` (the direct `processFrontMatter` increment on focus-phase completion) onto the hook/port path. That write-back predates the hook system and stays as-is. Moving it over requires two things this change doesn't touch: `flow-gu1.7`/`flow-gu1.8` (write-back trigger + input modal scope) being fleshed out, and threading an active-file-path equivalent into `HookContext` (`PhaseInstance.activeItem` is always `null` today). A follow-up bd issue, blocked on `flow-gu1.7`/`flow-gu1.8`, will track that migration.

## Capabilities

### New Capabilities
- `obsidian-file-mutation-port`: a `FileMutationPort` implementation that performs real vault writes (frontmatter, append) via Obsidian's API, and explicitly rejects the two queue-mutation kinds pending queue-runtime support.

### Modified Capabilities
(none — `file-mutation-apply`'s dispatch requirements and `hook-execution`'s firing requirements are unchanged; this change only supplies a real consumer of both.)

## Impact

- New file: an `ObsidianFileMutationPort` class under `src/timer/` (exempted from the repo's strict functional-style lint rules, same as `main.ts`/`settings.ts`/`src/views/**`).
- `src/main.ts`: construct `EngineStore` with the new port and a `HookRegistry` instead of `new EngineStore(POMODORO_PHASE_GRAPH)`.
- No changes to `src/domain/**` (interfaces and dispatch logic are already correct and stable).
- Tests: new unit tests for `ObsidianFileMutationPort` against Obsidian's test/mock surface, matching the style of `tests/apply-mutations.test.ts` and `tests/hook-execution.test.ts` (bun:test, `mock()`).
