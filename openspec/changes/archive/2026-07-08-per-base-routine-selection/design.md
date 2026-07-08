## Context

`src/timer/phase-graph.ts` exports one hardcoded `PhaseGraph` literal (`POMODORO_PHASE_GRAPH`). `src/main.ts` instantiates exactly one `EngineStore` against it, once, at plugin load, and holds it as a single field on the plugin object. `PomodoroTimerView` (`src/views/timer-view.ts`) is a pure renderer subscribed to that one store — it has no `PhaseGraph` of its own, even though it already has a real per-view-instance configuration mechanism (`getViewOptions()`, used today only to filter which vault entries populate the work/break queue via `focusProperty`/`breakProperty`).

The rest of the codebase already has precedents this design follows:
- Zod schemas validate configuration and runtime state (`PhaseGraphSchema` already exists and is reused unchanged — parsing untrusted vault data through it is a `safeParse` away).
- Resolved-result style, no throw, for anything that can fail on untrusted input (`domain/mutation/apply-mutations.ts`).
- Modal-as-awaitable for user confirmation (`src/views/write-back-modal.ts`'s `WriteBackModal`/`ObsidianWriteBackPromptPort` pair).

## Goals / Non-Goals

**Goals:**
- A routine is vault-file data, validated through the existing `PhaseGraphSchema`, not a code constant.
- A Base view selects which routine file it runs, falling back to today's built-in default when unset.
- Starting a view's routine is the only way it becomes active — no separate promote step, no per-view engine.

**Non-Goals:**
- Running two routines concurrently. `EngineStore` stays a single instance; see Decision 1.
- Resolving `HookReference`/`TransitionCondition.custom` names to executable code (flow-gu1.10) — a routine file can declare hooks since `PhaseGraphSchema` already supports it, but nothing executes them yet.
- Changing how `Phase.taskSourceId` resolves to a live task queue — unchanged.

## Decisions

### 1. Single global `EngineStore`; starting a routine is promoting it

No per-view or per-routine session multiplicity. Loading a routine via `setGraph` and starting it are the only states that exist — there's no "running locally" vs. "promoted to global."

**Alternatives considered:**
- A `routine` dropdown selecting among code-registered built-in graphs only, no vault-file authoring at all. Rejected: routines stay code, so flow-gu1.10 stays blocked — there's still nowhere for a user to author a routine that declares a hook.
- A session manager keyed by routine identity, holding multiple concurrent `EngineStore` instances plus a "primary" pointer for cross-workspace surfaces (status bar, flow-gu1.11) to subscribe to. Deferred, not rejected: this adds real scope (per-session tickers, and unresolved questions about whether hooks/notifications fire for non-primary sessions) with no concrete use case today. The user confirmed directly that concurrent routines "detracts from the focus work" — the plugin's point is a single thing to focus on.

**Why this is safe to defer rather than foreclose:** `EngineStore` (`src/timer/store.ts`) already has no singleton internal state — it's constructed with its `PhaseGraph`, `HookRegistry`, and `FileMutationPort` via the constructor, not module-level globals. A session manager remains a purely additive wrapper later if a real need appears; nothing in this design has to be unwound.

### 2. Routine file format: frontmatter marker + single fenced JSON body block

A routine file is a vault note with `pomodoro-routine: true` in frontmatter (vault-wide discoverable by scan) and exactly one fenced JSON code block in the body holding the `PhaseGraph` literal (`id`, `name`, `phases`, `transitions`).

**Alternatives considered:**
- Encoding the full `PhaseGraph` as nested frontmatter properties. Rejected: Obsidian's Properties UI only renders flat properties usefully; a graph nesting phases → transitions → completion policies → hooks several levels deep would just be hand-edited YAML with none of the UI's benefit, while also cluttering the Properties panel that the one marker property should occupy cleanly.
- Defining the routine via the Base view's own `getViewOptions()` fields (piggybacking on the mechanism `focusProperty`/`breakProperty` already use). Rejected structurally, not just aesthetically: `registerBasesView`'s `options: () => ViewOption[]` callback takes no arguments — it cannot see a view's current selection, so it can't generate fields dynamically, and no `ViewOption` kind can express an arbitrarily nested graph regardless.

### 3. Duration codec lives in the loader, not the schema

Routine files spell `phases[].duration` and `completionPolicy.after` (for `kind: 'futureDate'`) as ISO 8601 duration strings (`"PT25M"`). The loader converts these to `Temporal.Duration` instances at exactly those two known field paths before calling `PhaseGraphSchema.safeParse`.

**Alternative considered:** teaching `PositiveDurationSchema`/`NonNegativeDurationSchema` themselves to accept a string via `z.preprocess`. Rejected: those schemas are used throughout the domain layer for values that are already real `Temporal.Duration` instances at runtime (e.g. `EngineState`); loosening them to accept strings would weaken type safety everywhere they're used, not just at the routine-file boundary. Keeping the conversion in the loader means `PhaseGraphSchema` is reused completely unchanged.

### 4. Loader is a pure function returning a `Result`, never throws

`parseRoutineFile(content: string): Result<PhaseGraph, RoutineParseError>` (exact `Result` shape matching this codebase's existing convention, e.g. `apply-mutations.ts`). Steps: extract the fenced JSON block → `JSON.parse` → convert duration strings at the two known paths → `PhaseGraphSchema.safeParse`. Any failure at any step becomes a `RoutineParseError` carrying enough detail (for schema failures: the Zod issue path/message) to render a useful in-view error — never a thrown exception.

### 5. View wiring: `routineFile` `FileOption`, replace-confirmation reuses the write-back modal pattern

`PomodoroTimerView.getViewOptions()` gains `routineFile` (Bases' `FileOption` kind, a vault file picker). Unset falls back to `POMODORO_PHASE_GRAPH`. Start loads the resolved routine into the single `EngineStore` via `setGraph`. If a session is already running under a different routine, Start opens a confirmation modal (same "Modal as an awaitable" pattern as `WriteBackModal`) before replacing; declining leaves the running session untouched.

**Alternative considered:** matching today's actual `setGraph` behavior (silent, unconditional reset). Rejected: clicking Start in the wrong pane would silently discard an in-progress session with no warning — acceptable as an internal implementation detail today (nothing calls `setGraph` except the one hardcoded load at plugin startup), unacceptable once it's a user-triggered action from any of potentially several views.

### 6. Invalid routine files render inline, never throw

A `parseRoutineFile` failure renders as an inline error in the view — extending the existing early-return-on-invalid-state pattern already in `PomodoroTimerView.render()` (`if (!phase || state.remaining === null) return`) — rather than crashing the view or the plugin.

## Risks / Trade-offs

- **[Risk]** `EngineStore.setGraph`'s while-running contract is undocumented today (silent reset) → **Mitigation:** this change makes replacement an explicit, user-confirmed action at the view layer; whether `setGraph` itself should also assert/reject when called while running is tracked as an implementation task, not left ambiguous indefinitely.
- **[Risk]** Multiple Base views can each reference a different `routineFile` while only one routine is ever actually active (single global engine) — a view showing routine A's queue could be misread as "routine A is running" when routine B is actually active → **Mitigation:** `render()` always reflects the live global `EngineState` regardless of the view's own `routineFile` selection, exactly like today's single-store subscription; a view whose routine isn't the active one should visibly indicate that (inert/preview state) rather than implying it's running.
- **[Trade-off]** No concurrent routines → accepted; confirmed as matching intended usage, not merely a v1 limitation to revisit soon.
- **[Risk]** A routine file's JSON block could be arbitrarily malformed or oversized → **Mitigation:** it's still just data validated by `PhaseGraphSchema`; no code-execution path exists, since `HookReference`/`TransitionCondition` fields remain name-only references regardless of what a routine file contains (resolving those names to code is flow-gu1.10's separate, still-open concern).

## Migration Plan

Additive only. Unset `routineFile` is the fallback to today's exact existing behavior (`POMODORO_PHASE_GRAPH`), so no existing vault or view configuration breaks on upgrade. No stored data predates this change, so there's nothing to migrate.

## Open Questions

- Exact module location for the loader (`src/domain/routine/` vs. alongside `src/timer/phase-graph.ts`) — an implementation detail, doesn't block this design.
- Whether `EngineStore.setGraph` should itself assert/reject when called while a session is running (forcing every call site to confirm first) versus staying a plain setter with confirmation enforced only at the view layer — tracked as a task-level decision (see Risks), not blocking.
