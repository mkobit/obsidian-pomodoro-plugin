## 1. Domain: WriteBackPromptPort

- [x] 1.1 Create `src/domain/mutation/write-back-prompt.ts` with `WriteBackFormValues`, `WriteBackPromptResult`, and `WriteBackPromptPort` (see design.md decision 1)

## 2. Orchestrator changes

- [x] 2.1 Add `writeBackPrompt: WriteBackPromptPort` to `WriteBackDeps` in `src/timer/write-back.ts`
- [x] 2.2 In `writeBackPhaseCompletion`, after computing `entry` via `nextLogEntry`, call `deps.writeBackPrompt.prompt({ filePath, property: entry.property, value: entry.value })`
- [x] 2.3 On `{ kind: 'cancelled' }`, return `{ kind: 'skipped' }` without calling `applyMutations`
- [x] 2.4 On `{ kind: 'submitted', values }`, build the `FileMutation` from `values` (not the original `entry`) and apply it via `applyMutations`, same as today

## 3. Obsidian-backed implementation

- [x] 3.1 Create `src/views/write-back-modal.ts` with `WriteBackModal extends Modal`: three `Setting` rows (file, property, value) pre-filled from constructor `defaults`, Submit/Cancel controls, and `waitForResult(): Promise<WriteBackPromptResult>`
- [x] 3.2 Implement the file field with a custom `AbstractInputSuggest<TFile>` over `this.app.vault.getFiles()`, filtered by substring match against `query` (see design.md decision 3)
- [x] 3.3 Implement submit-value coercion: parse the value field's trimmed text as a finite number if possible, else pass through as a string (see design.md decision 4) -- extracted as the pure, unit-tested `coerceWriteBackValue` in `src/domain/mutation/write-back-prompt.ts`
- [x] 3.4 Implement the submitted/cancelled resolution exactly once: a `submitted` flag set by the submit handler before `close()`, checked in `onClose()` to decide whether to resolve `{ kind: 'cancelled' }`
- [x] 3.5 Add `ObsidianWriteBackPromptPort implements WriteBackPromptPort` (in the same file or `src/timer/obsidian-write-back-prompt.ts`) whose `prompt(defaults)` constructs a fresh `WriteBackModal` and returns `.waitForResult()`

## 4. Wiring

- [x] 4.1 In `src/main.ts`, construct an `ObsidianWriteBackPromptPort` and add it to `writeBackDeps`

## 5. Tests

- [x] 5.1 Add a fake `WriteBackPromptPort` helper to `tests/write-back.test.ts` (mirrors `createFakePort`/`createFakeReader`) that resolves `{ kind: 'submitted', values: defaults }` by default
- [x] 5.2 Update existing "writes back" scenarios to use the fake prompt and assert the applied mutation matches the (unedited) defaults
- [x] 5.3 Add a test: prompt resolves `{ kind: 'cancelled' }` → `writeBackPhaseCompletion` returns `{ kind: 'skipped' }` and `FileMutationPort` is never called
- [x] 5.4 Add a test: prompt resolves `{ kind: 'submitted', values }` with edited `filePath`/`property`/`value` → the applied `FileMutation` reflects the edited values, not the original defaults
- [x] 5.5 Add a test: no-target-resolved cases (`activeFilePath: null`, unregistered/null-returning callback) never call `deps.writeBackPrompt.prompt` at all -- covered by the existing skip-scenario tests, extended with a `prompt.prompt` not-called assertion

## 6. Manual verification

- [ ] 6.1 Run the plugin in the dev vault (`scripts/vault-dev.ts` per existing workflow) and manually complete a focus phase: confirm the modal opens pre-filled, submitting with no edits behaves like today's auto-increment, editing fields writes the edited values, and cancelling writes nothing -- left for the user to run by hand (`bun run vault:dev`); not something this agent can drive/observe in a GUI Electron window

## 7. Quality gates

- [x] 7.1 `bun test ./tests` passes (92 pass, 0 fail)
- [x] 7.2 `bun run typecheck` passes
- [x] 7.3 `bun run lint` passes
- [ ] 7.4 Close flow-gu1.8 in beads, referencing this change -- deferred until after 6.1 (manual verification) confirms the modal actually works end to end
