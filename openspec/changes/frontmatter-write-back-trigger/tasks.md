## 1. Phase.logTarget schema change

- [ ] 1.1 In `src/domain/phase/phase.ts`, add `LogTargetResolverNameSchema` (branded string, mirrors `HookNameSchema`) and change `PhaseLogTargetSchema` to the `activeItem`/`callback` discriminated union
- [ ] 1.2 Update `src/timer/phase-graph.ts`'s built-in `POMODORO_PHASE_GRAPH` phases to the new `logTarget` shape (focus → `{ kind: 'activeItem' }`, break/long-break → `{ kind: 'callback', name: 'dailyNote' }`)
- [ ] 1.3 Update all existing test fixtures using the old `logTarget` enum values (`tests/timer.test.ts`, `tests/hook-execution.test.ts`, `tests/domain-v2.test.ts`) to the new shape
- [ ] 1.4 Run `bun run typecheck` and `bun run test` to confirm the schema change alone doesn't break anything else

## 2. LogTargetResolverRegistry

- [ ] 2.1 Define `LogTargetResolverRegistry` type (`{ resolve: (name: LogTargetResolverName) => ((phase: Phase) => string | null) | undefined }`) — decide its home (e.g. alongside `HookRegistry` in `src/domain/hook/` or a new `src/domain/log-target/` module) per design.md decision 2
- [ ] 2.2 Write unit tests: unregistered name → `undefined`; registered name → returns the registered function

## 3. nextLogEntry pure function

- [ ] 3.1 Add `nextLogEntry(currentValue: unknown, property: string, recordedAt: Temporal.Instant): LogEntry` to `src/domain/mutation/log-entry.ts`
- [ ] 3.2 Write unit tests: numeric current value increments by 1; non-numeric/undefined current value yields `1`; `property`/`recordedAt` pass through unchanged

## 4. FrontmatterReader

- [ ] 4.1 Define a minimal `FrontmatterReader` interface (`readValue(filePath: string, property: string): unknown`)
- [ ] 4.2 Implement an Obsidian-backed version using `app.metadataCache.getFileCache(file)?.frontmatter?.[property]`, resolving the file the same way `ObsidianFileMutationPort` does

## 5. Write-back orchestrator

- [ ] 5.1 Create the orchestrator module (e.g. `src/timer/write-back.ts`) implementing target resolution (`activeItem` from `EngineState.activeFilePath`; `callback` via `LogTargetResolverRegistry`), read-current-value, `nextLogEntry`, `FileMutation` construction, and `applyMutations` dispatch, returning `{ kind: 'skipped' } | { kind: 'applied', result: ApplyMutationsResult }`
- [ ] 5.2 Write unit tests using `bun:test` `mock()` fakes for `FileMutationPort`, `FrontmatterReader`, and `LogTargetResolverRegistry` (style matching `tests/obsidian-file-mutation-port.test.ts` / `tests/hook-execution.test.ts`), covering all scenarios in `specs/frontmatter-write-back-trigger/spec.md`

## 6. main.ts wiring

- [ ] 6.1 Delete `handlePhaseComplete` and the `FOCUS_PHASE_KIND` gating in the `store.subscribe` callback
- [ ] 6.2 Wire the new orchestrator into `onload`: construct the (empty, no-op) `LogTargetResolverRegistry` and the `FrontmatterReader`, call the orchestrator unconditionally on every `currentPhaseId` change
- [ ] 6.3 Log a failed write-back (`kind: 'applied', result: { success: false }`) via `console.error`

## 7. Quality gates and cleanup

- [ ] 7.1 Run `bun run typecheck`, `bun run lint`, `bun run test` — all clean
- [ ] 7.2 Confirm no remaining references to the old `logTarget` enum shape (`rg "logTarget: '(dailyNote|activeItem)'"` returns nothing)
- [ ] 7.3 Update bd issue flow-gu1.7 with `--design` pointing at `openspec/changes/frontmatter-write-back-trigger/`
