## 1. Domain: TaskSourceRegistry, drop TaskSourceConfig

- [ ] 1.1 In `src/domain/queue/task-source.ts`, delete `TaskSourceConfig` and `TaskSourceKind` (dead, never consumed).
- [ ] 1.2 Add the resolve-only `TaskSourceRegistry` interface to `src/domain/queue/task-source.ts` (decision 2).
- [ ] 1.3 Update `src/domain/queue/task-source.ts:52`'s doc comment (currently points at flow-djx as a TODO) to describe the real `BaseQuerySource` implementation instead.

## 2. BaseQuerySource (TDD)

- [ ] 2.1 Write failing tests for `BaseQuerySource.getQueue()`: identity fields (`id`/`sourcePath` = entry path, `displayName` = basename), frontmatter projection, defaults when frontmatter is absent, and priority-based sort (including the "missing priority sorts as 0" case) — per `specs/base-query-task-source/spec.md`.
- [ ] 2.2 Implement `src/timer/base-query-task-source.ts`: `BaseQueryEntry` adapter interface + `createBaseQuerySource(entries): TaskSource` factory, until tests pass.

## 3. TaskSourceRegistry implementation (TDD)

- [ ] 3.1 Write failing tests for the `Map`-backed `MutableTaskSourceRegistry`: register/resolve/unregister/re-register-overwrites.
- [ ] 3.2 Implement `src/timer/task-source-registry.ts`'s `MutableTaskSourceRegistry` until tests pass.

## 4. ObsidianFileMutationPort: real queue mutations (TDD)

- [ ] 4.1 Write failing tests for `reorderQueueItem`/`changeQueueItemStatus` per `specs/obsidian-file-mutation-port/spec.md`: back/front priority writes, status writes, and unresolvable-`itemId` rejection.
- [ ] 4.2 Implement the real `reorderQueueItem`/`changeQueueItemStatus` in `src/timer/obsidian-file-mutation-port.ts`, removing `notYetSupported`, until tests pass.

## 5. Wire PomodoroTimerView to BaseQuerySource

- [ ] 5.1 In `src/views/timer-view.ts`, replace the inline `filteredEntries` computation (lines 121-158) with: build `BaseQueryEntry[]` from the current phase's focus/break-filtered entries (reading frontmatter via `app.metadataCache.getFileCache`), construct a `BaseQuerySource`, and `register` it under `phase.taskSourceId` (skip registration entirely when `taskSourceId` is `null`, same as today's "no queue" phases).
- [ ] 5.2 Render the queue list from `taskSource.getQueue()` instead of raw entries, preserving existing behavior (active-item highlighting, click-to-start).

## 6. Wire main.ts

- [ ] 6.1 Construct the `MutableTaskSourceRegistry` singleton in `PomodoroPlugin.onload()`.
- [ ] 6.2 Pass the narrow `TaskSourceRegistry` where a resolver is needed and the wide `MutableTaskSourceRegistry` to `PomodoroTimerView`'s factory.

## 7. Clean up stale flow-gu1.9 references

- [ ] 7.1 Update `src/timer/reducer.ts:160`.
- [ ] 7.2 Update `docs/examples/workout.md:42` and `docs/examples/pomodoro.md:12`.

## 8. e2e coverage

- [ ] 8.1 Add `pomodoro-status`/`pomodoro-priority` frontmatter to at least one fixture task note (e.g. in the Standup or Workout routine's backing notes) so a real queue has visible state.
- [ ] 8.2 Extend `e2e/timer.e2e.ts` (or add a new describe block) to assert the queue panel reflects real Bases entries and that clicking a reorder/status control (once such UI exists — otherwise dispatch the mutation directly, matching how `finish-phase` was verified) results in the expected frontmatter write, verified against real Obsidian.

## 9. Verify

- [ ] 9.1 `bun run typecheck`, `bun run lint`, `bun test ./tests` all pass.
- [ ] 9.2 `bun run build` then `bun x playwright test` (full e2e) pass — rebuild first per the `e2e-stale-build-false-green` gotcha.
