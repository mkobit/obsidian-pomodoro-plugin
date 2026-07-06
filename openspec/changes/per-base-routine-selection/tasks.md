## 1. Domain: routine file format

- [ ] 1.1 Create `src/domain/routine/routine-file.ts` with `RoutineParseError` (carries a message and, for schema failures, the Zod issue path/message) and `parseRoutineFile(content: string): Result<PhaseGraph, RoutineParseError>` (see design.md decisions 3-4)
- [ ] 1.2 Implement fenced-JSON-block extraction from note body content; missing or multiple blocks produce a `RoutineParseError`
- [ ] 1.3 Implement the ISO 8601 duration string ↔ `Temporal.Duration` codec, applied at `phases[].duration` and `phases[].completionPolicy.after` (when `kind === 'futureDate'`) before schema validation; malformed strings produce a `RoutineParseError`
- [ ] 1.4 Run `PhaseGraphSchema.safeParse` on the converted object; map Zod failures to `RoutineParseError`

## 2. Store: setGraph-while-running contract

- [ ] 2.1 Decide and implement `EngineStore.setGraph`'s while-running contract (see design.md Open Questions): either assert/reject when called while a session is running, or document that callers must confirm first
- [ ] 2.2 Update or add tests in `tests/store.test.ts` (or equivalent) covering the chosen contract

## 3. View: routine selection and start/replace flow

- [ ] 3.1 Add `routineFile` (`FileOption`) to `PomodoroTimerView.getViewOptions()` in `src/views/timer-view.ts`
- [ ] 3.2 Resolve the view's routine on render/start: parse `routineFile` via `parseRoutineFile` when set, else fall back to `POMODORO_PHASE_GRAPH`
- [ ] 3.3 Render an inline error state (extending the existing early-return pattern in `render()`) when `parseRoutineFile` fails, showing the error message instead of the timer panel
- [ ] 3.4 On Start: if no session is running, or the running session's routine matches the view's resolved routine, load it via `setGraph` and start immediately
- [ ] 3.5 On Start: if a different routine is already running, open the replace-confirmation modal (see section 4) before calling `setGraph`; only replace on confirm, leave the running session untouched on cancel

## 4. Replace-confirmation modal

- [ ] 4.1 Create a confirmation modal (e.g. `src/views/routine-replace-modal.ts`), following the "Modal as an awaitable" pattern already used by `WriteBackModal` (`src/views/write-back-modal.ts`): `open()`s, exposes a `waitForResult(): Promise<'confirmed' | 'cancelled'>` resolved exactly once regardless of which path (confirm button, cancel button, Escape, click-outside) fires
- [ ] 4.2 Wire the modal into the Start handler from task 3.5

## 5. Tests

- [ ] 5.1 Unit tests for the duration codec: valid ISO strings round-trip, malformed strings produce `RoutineParseError`
- [ ] 5.2 Unit tests for `parseRoutineFile`: valid single fenced block, malformed JSON, schema-invalid JSON, missing/multiple fenced blocks — each asserting the specific `RoutineParseError` case, never a throw
- [ ] 5.3 View-level tests: `routineFile` unset falls back to `POMODORO_PHASE_GRAPH`; Start with no session running loads and starts immediately; Start with a different routine running opens the confirmation modal and only replaces on confirm; Start with the same routine already running does not prompt
- [ ] 5.4 View-level test: an unparseable `routineFile` renders the inline error state, not the timer panel

## 6. Manual verification

- [ ] 6.1 Run the plugin in the dev vault (`scripts/vault-dev.ts`) with two Base views: one on the built-in default, one on a hand-authored routine file. Confirm: default view behaves exactly as today; authored-routine view starts the authored graph; starting the second view while the first is running prompts for confirmation; a malformed routine file renders an inline error instead of crashing the view

## 7. Quality gates

- [ ] 7.1 `bun test` passes
- [ ] 7.2 `bun run typecheck` passes
- [ ] 7.3 `bun run lint` passes
- [ ] 7.4 Close flow-gu1.23 in beads, referencing this change; confirm flow-gu1.10 is now unblocked
