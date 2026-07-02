## 1. ObsidianFileMutationPort

- [x] 1.1 Create `src/timer/obsidian-file-mutation-port.ts` with a local `ObsidianFileMutationPortDeps` interface (`vault: Pick<Vault, 'getFileByPath' | 'append'>`, `fileManager: Pick<FileManager, 'processFrontMatter'>`) and a `createObsidianFileMutationPort(deps): FileMutationPort` factory
- [x] 1.2 Implement `writeFrontmatter`: resolve `filePath` via `deps.vault.getFileByPath`; if `null`, throw a descriptive error; otherwise call `deps.fileManager.processFrontMatter(file, fm => { fm[property] = value })`
- [x] 1.3 Implement `appendText`: resolve `filePath` via `deps.vault.getFileByPath`; if `null`, throw a descriptive error; otherwise call `deps.vault.append(file, text)`
- [x] 1.4 Implement `reorderQueueItem` and `changeQueueItemStatus`: unconditionally throw an error referencing flow-gu1.9 (no TaskSource/queue runtime yet)

## 2. Tests

- [x] 2.1 Add `tests/obsidian-file-mutation-port.test.ts` (bun:test, `mock()`, matching the style of `tests/apply-mutations.test.ts`) with fake `vault`/`fileManager` deps (no import of `obsidian` as a value)
- [x] 2.2 Cover: writeFrontmatter writes the property on an existing file; writeFrontmatter rejects when `getFileByPath` returns `null`
- [x] 2.3 Cover: appendText appends text on an existing file; appendText rejects when `getFileByPath` returns `null`
- [x] 2.4 Cover: reorderQueueItem and changeQueueItemStatus reject unconditionally

## 3. Wire into main.ts

- [x] 3.1 In `src/main.ts`, construct `createObsidianFileMutationPort(this.app)` and an inline `HookRegistry` (`{ resolve: () => undefined }`)
- [x] 3.2 Pass both into `new EngineStore(POMODORO_PHASE_GRAPH, hookRegistry, port)`
- [x] 3.3 Confirm `handlePhaseComplete` is untouched (out of scope per proposal.md)

## 4. Verification

- [x] 4.1 `bun test` passes, including the new test file
- [x] 4.2 `bun x tsc --noEmit` (or repo's typecheck script) passes
- [x] 4.3 `bun x eslint .` (or repo's lint script) passes with no new violations
- [ ] 4.4 Manually load the plugin in Obsidian (per the `run`/`webapp-testing` skill or existing manual test flow) and confirm the timer still starts/ticks/completes a focus phase without error, since `main.ts`'s `EngineStore` construction changed
