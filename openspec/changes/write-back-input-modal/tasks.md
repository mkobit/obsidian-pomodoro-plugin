## 1. Domain: WriteBackPromptPort

- [ ] 1.1 Create `src/domain/mutation/write-back-prompt.ts` with `WriteBackFormValues`, `WriteBackPromptResult`, and `WriteBackPromptPort` (see design.md decision 1)

## 2. Orchestrator changes

- [ ] 2.1 Add `writeBackPrompt: WriteBackPromptPort` to `WriteBackDeps` in `src/timer/write-back.ts`
- [ ] 2.2 In `writeBackPhaseCompletion`, after computing `entry` via `nextLogEntry`, call `deps.writeBackPrompt.prompt({ filePath, property: entry.property, value: entry.value })`
- [ ] 2.3 On `{ kind: 'cancelled' }`, return `{ kind: 'skipped' }` without calling `applyMutations`
- [ ] 2.4 On `{ kind: 'submitted', values }`, build the `FileMutation` from `values` (not the original `entry`) and apply it via `applyMutations`, same as today

## 3. Obsidian-backed implementation

- [ ] 3.1 Create `src/views/write-back-modal.ts` with `WriteBackModal extends Modal`: three `Setting` rows (file, property, value) pre-filled from constructor `defaults`, Submit/Cancel controls, and `waitForResult(): Promise<WriteBackPromptResult>`
- [ ] 3.2 Implement the file field with a custom `AbstractInputSuggest<TFile>` over `this.app.vault.getFiles()`, filtered by substring match against `query` (see design.md decision 3)
- [ ] 3.3 Implement submit-value coercion: parse the value field's trimmed text as a finite number if possible, else pass through as a string (see design.md decision 4)
- [ ] 3.4 Implement the submitted/cancelled resolution exactly once: a `submitted` flag set by the submit handler before `close()`, checked in `onClose()` to decide whether to resolve `{ kind: 'cancelled' }`
- [ ] 3.5 Add `ObsidianWriteBackPromptPort implements WriteBackPromptPort` (in the same file or `src/timer/obsidian-write-back-prompt.ts`) whose `prompt(defaults)` constructs a fresh `WriteBackModal` and returns `.waitForResult()`

## 4. Wiring

- [ ] 4.1 In `src/main.ts`, construct an `ObsidianWriteBackPromptPort` and add it to `writeBackDeps`

## 5. Tests

- [ ] 5.1 Add a fake `WriteBackPromptPort` helper to `tests/write-back.test.ts` (mirrors `createFakePort`/`createFakeReader`) that resolves `{ kind: 'submitted', values: defaults }` by default
- [ ] 5.2 Update existing "writes back" scenarios to use the fake prompt and assert the applied mutation matches the (unedited) defaults
- [ ] 5.3 Add a test: prompt resolves `{ kind: 'cancelled' }` → `writeBackPhaseCompletion` returns `{ kind: 'skipped' }` and `FileMutationPort` is never called
- [ ] 5.4 Add a test: prompt resolves `{ kind: 'submitted', values }` with edited `filePath`/`property`/`value` → the applied `FileMutation` reflects the edited values, not the original defaults
- [ ] 5.5 Add a test: no-target-resolved cases (`activeFilePath: null`, unregistered/null-returning callback) never call `deps.writeBackPrompt.prompt` at all

## 6. Manual verification

- [ ] 6.1 Run the plugin in the dev vault (`scripts/vault-dev.ts` per existing workflow) and manually complete a focus phase: confirm the modal opens pre-filled, submitting with no edits behaves like today's auto-increment, editing fields writes the edited values, and cancelling writes nothing

## 7. Quality gates

- [ ] 7.1 `bun test ./tests` passes
- [ ] 7.2 `bun run typecheck` passes
- [ ] 7.3 `bun run lint` passes
- [ ] 7.4 Close flow-gu1.8 in beads, referencing this change
