# Per-Base routine selection design

This document describes how a Base view selects which routine (PhaseGraph) it runs, replacing today's single hardcoded `POMODORO_PHASE_GRAPH`.
It resolves flow-gu1.23.
It is a prerequisite for flow-gu1.10 (transition hook script runner): hooks need somewhere real to attach before their resolution mechanism can be designed against a working example.

## Problem

`src/timer/phase-graph.ts` exports one hardcoded `PhaseGraph` literal.
`main.ts` instantiates exactly one `EngineStore` against it, once, at plugin load.
`PomodoroTimerView` is a pure renderer subscribed to that single store — it has no PhaseGraph of its own, even though it already has a real per-view-instance configuration mechanism (`getViewOptions()`, used today for `focusProperty`/`breakProperty`).
There is no way for a routine to be anything other than a TypeScript literal shipped in the plugin bundle, and no way for two different Base views to run different routines.

## Goals

- A routine is vault-file data, validated through the existing `PhaseGraphSchema`, not a code constant.
- A Base view selects which routine file it runs.
- Starting a view's routine is the only way it becomes active — there is no separate "promote" step.

## Non-goals

- Running two routines concurrently.
  Discussed and deliberately deferred, not rejected: `EngineStore` is already free of singleton state, so a multi-session manager remains an additive change later if a real use case appears.
  Concurrent routines also cut against the point of the plugin — a second timer running in the background is a distraction from the phase already in progress, not a convenience.
- Changing how `Phase.taskSourceId` resolves to an actual task queue.
  The loader parses whatever `taskSourceId` a routine file declares; how that id becomes a live queue is unchanged, existing behavior.
- Resolving `HookReference`/`TransitionCondition.custom` names to executable code.
  A routine file can declare hooks (the schema already supports it), but nothing executes them until flow-gu1.10 lands.

## Routine file format

A routine file is an ordinary vault note:

- A frontmatter marker, `pomodoro-routine: true`, so routine files are discoverable by a vault-wide scan (the same discovery style flow-gu1.10 plans to use for hook scripts — frontmatter property, not a folder convention).
- A single fenced JSON code block in the note body holding the `PhaseGraph` literal (`id`, `name`, `phases`, `transitions`, matching `PhaseGraphSchema` in `src/domain/phase/phase-graph.ts`).

A fenced block, not deeper frontmatter nesting, because `PhaseGraph` nests phases, transitions, completion policies, and hooks several levels deep.
Obsidian's Properties UI only renders flat properties usefully — a deeply nested structure in frontmatter would be hand-edited YAML with none of the UI's benefit, so it gains nothing over a plain code block and costs Properties-panel clarity for the one property (`pomodoro-routine`) that does belong there.

Durations don't serialize directly: `Phase.duration` and `CompletionPolicy`'s `futureDate.after` are `Temporal.Duration` instances (`PositiveDurationSchema`), not JSON-native.
A routine file spells these as ISO 8601 duration strings (`"PT25M"`), and the loader converts string → `Temporal.Duration` before handing the object to `PhaseGraphSchema.safeParse` — a preprocessing pass over the parsed JSON, not a schema change.

## Loader

A new pure function, `parseRoutineFile(content: string): Result<PhaseGraph, RoutineParseError>` (exact `Result` shape to match this codebase's existing resolved-result conventions, e.g. `apply-mutations.ts`'s pattern), that:

1. Extracts the fenced JSON block from the note body.
2. `JSON.parse`s it, converting a parse failure into a `RoutineParseError`.
3. Walks the parsed object converting ISO duration strings to `Temporal.Duration` at the two known field paths (`phases[].duration`, `phases[].completionPolicy.after` when `kind === 'futureDate'`).
4. Runs `PhaseGraphSchema.safeParse`, converting a Zod failure into a `RoutineParseError` that carries enough detail (Zod's issue path/message) to render a useful in-view error.

No new Zod schema is introduced — the loader targets the existing `PhaseGraphSchema` exactly, so anything already valid for `POMODORO_PHASE_GRAPH` is valid in a routine file.

## View wiring and start/promote semantics

`PomodoroTimerView.getViewOptions()` gains a `routineFile` option (Obsidian's Bases `FileOption` ViewOption kind, a vault file picker).
Unset, the view falls back to today's built-in `POMODORO_PHASE_GRAPH` — existing behavior is the default, not a special case.

Clicking Start loads the view's parsed routine into the plugin's single `EngineStore` via `setGraph`.
Starting a routine is promoting it — there is no separate global/local distinction, and no state to design for "promote" beyond this.

If a session is already running under a different routine, Start must not silently replace it.
`EngineStore.setGraph` resets `EngineState` unconditionally today (`src/timer/store.ts`), which is fine once replacing is a deliberate, confirmed action rather than an accident of clicking Start in the wrong pane.
The confirmation reuses the write-back modal's established pattern (`src/views/write-back-modal.ts`): a small Obsidian `Modal` prompting to confirm or cancel, no new UI primitive.

## Error handling

A routine file that fails to parse (malformed JSON, or JSON that fails `PhaseGraphSchema`) must not throw.
The view renders an inline error state instead — extending the existing early-return-on-invalid-state pattern already in `PomodoroTimerView.render()` (`if (!phase || state.remaining === null) return`) — showing the parse error's message rather than a blank or crashed view.

## Testing

- Unit: the ISO-duration-string ↔ `Temporal.Duration` conversion (round-trip, and malformed-string rejection); `parseRoutineFile` against a valid fenced block, invalid JSON, and schema-invalid JSON (each producing the expected `RoutineParseError`).
  Pure functions, fits this codebase's existing `src/domain/` test style.
- View-level: `routineFile` unset falls back to `POMODORO_PHASE_GRAPH`; Start with no existing session loads and runs immediately; Start with a different routine already running shows the confirmation modal and only replaces on confirm.
- No new e2e scope: this rides the existing Playwright smoke setup.
  A generated routine-file fixture in `e2e/vault/generator.ts` can wait until a second real routine exists to exercise it with.

## Deferred: concurrent routines

If a real need for two simultaneously-running routines appears later, the natural extension is a session manager keyed by routine identity (file path or graph id, not by view — Bases views have no stable identity across pane close/reopen), holding a map of `EngineStore` instances plus a `primary` pointer that the status bar (flow-gu1.11) and other cross-workspace surfaces subscribe to.
Nothing in this design forecloses that: `EngineStore` stays multi-instance-capable, the routine-file format is unchanged, and hook binding (once flow-gu1.10 lands) is a property of the routine file either way.
This is explicitly out of scope until a concrete use case demands it.

## Follow-on work

- flow-gu1.10 (transition hook script runner): once routine files exist, hooks have somewhere real to attach (`onEnter`/`onComplete`/`onSkip`/`onExit` fields in a routine file's phases), unblocking that design.
- flow-b74 / flow-gu1.22: `TransitionCondition`'s `custom` predicate and `CompletionPolicy`'s `custom`/`queueCycle`/`futureDate` variants still throw in the reducer — unaffected by this change, since `POMODORO_PHASE_GRAPH` and hand-authored routine files are both `PhaseGraph` values subject to the same engine.
- Define `setGraph`-while-running's exact contract as part of implementation (today: silent reset) — the replace-confirmation modal in this design is the UI-level answer, but the store-level method should probably assert or make the precondition explicit rather than rely on callers remembering to confirm first.
