## Why

`src/timer/phase-graph.ts` exports one hardcoded `PhaseGraph` literal (`POMODORO_PHASE_GRAPH`), and `main.ts` instantiates exactly one `EngineStore` against it, once, at plugin load. `PomodoroTimerView` (`src/views/timer-view.ts`) is a pure renderer subscribed to that single store — it has no `PhaseGraph` of its own, even though it already has a real per-view-instance configuration mechanism (`getViewOptions()`, used today for `focusProperty`/`breakProperty`). A routine can't be anything other than a TypeScript literal shipped in the plugin bundle, and no two Base views can run different routines. flow-gu1.10 (transition hook script runner) needs routines to be real data before hook attachment has anywhere to bind — this change unblocks it.

## What Changes

- A routine becomes vault-file data: an ordinary note with a `pomodoro-routine: true` frontmatter marker (vault-wide discoverable) and a single fenced JSON code block in the body holding a `PhaseGraph` literal, validated through the existing `PhaseGraphSchema` unchanged.
- Durations serialize as ISO 8601 strings (`"PT25M"`) in routine files; a loader converts string → `Temporal.Duration` at the two known field paths (`phases[].duration`, `phases[].completionPolicy.after`) before schema validation.
- `PomodoroTimerView.getViewOptions()` gains a `routineFile` option (Bases' `FileOption` kind). Unset falls back to today's built-in `POMODORO_PHASE_GRAPH`.
- Clicking Start loads the view's parsed routine into the plugin's single `EngineStore` via `setGraph` — starting a routine **is** promoting it; there's no separate promote step or per-view engine.
- If a session is already running under a different routine, Start prompts for confirmation (reusing the write-back modal's pattern) before replacing it, rather than silently resetting `EngineState`.
- A routine file that fails to parse (malformed JSON or schema-invalid) renders an inline error in the view instead of throwing.
- Explicitly out of scope (tracked separately): running two routines concurrently (flow-gu1.23's notes; deferred to a future session-manager design if a real need appears), resolving `HookReference`/`TransitionCondition.custom` names to executable code (flow-gu1.10), and changing how `Phase.taskSourceId` resolves to a live queue (unchanged).

## Capabilities

### New Capabilities
- `routine-file-format`: parsing and validating a vault note (frontmatter marker + fenced JSON `PhaseGraph` block, with ISO-duration-string conversion) into a `PhaseGraph`, or a structured parse error — no throw.
- `base-view-routine-selection`: a Base view selecting a routine file via `getViewOptions()`, falling back to the built-in default when unset, starting/replacing the active routine with confirmation when one is already running, and rendering inline errors for invalid routine files.

### Modified Capabilities
(none — `PhaseGraphSchema`, `POMODORO_PHASE_GRAPH`, and `Phase.taskSourceId` resolution are all unchanged; no existing spec's requirements change)

## Impact

- New loader module (exact location finalized in design.md) exporting `parseRoutineFile`, plus a small ISO-duration ↔ `Temporal.Duration` codec.
- `src/views/timer-view.ts`: `getViewOptions()` gains `routineFile`; `render()`/Start handling loads a parsed routine and handles the replace-confirmation flow; adds an inline error-rendering path.
- `src/timer/store.ts`: `EngineStore.setGraph`'s while-running contract gets made explicit (today: silent reset) as part of wiring in the confirmation step.
- New confirmation modal (or reuse of `src/views/write-back-modal.ts`'s pattern), finalized in design.md.
- `tests/`: new unit tests for the loader/codec; view-level tests for fallback, start, and replace-confirmation behavior.
- No changes to `PhaseGraphSchema`, `HookReferenceSchema`, `CompletionPolicySchema`, `TaskSource`, or settings schema.
