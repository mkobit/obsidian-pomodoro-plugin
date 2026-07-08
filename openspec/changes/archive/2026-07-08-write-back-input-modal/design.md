## Context

`src/timer/write-back.ts#writeBackPhaseCompletion` resolves a target file, reads its current frontmatter value, computes the next `LogEntry` via `nextLogEntry`, and applies it through `FileMutationPort` — all synchronously, with no user interaction. `src/main.ts` calls it fire-and-forget (`void ...then(...)`) from `store.subscribe`. This change inserts a user-facing confirmation step between "compute default" and "apply."

The rest of the codebase already has two precedents to follow:
- Ports as narrow interfaces with a real Obsidian-backed class implementation (`FrontmatterReader`/`ObsidianFrontmatterReader`, `FileMutationPort`/`ObsidianFileMutationPort`), keeping `src/domain/**` free of any Obsidian dependency and test fakes small.
- UI lives in classes under `src/views/` (`PomodoroTimerView`) or `src/timer/obsidian-*.ts`, exempted from the functional-style rule that governs the rest of `src/domain/**`.

## Goals / Non-Goals

**Goals:**
- Let the user see and, if they want, change the target file/property/value before a write-back mutation is applied.
- Keep `writeBackPhaseCompletion`'s resolve-and-compute logic (and its tests) working without spinning up a real Obsidian `Modal` — the prompt step must be fake-able.
- Reuse `FileMutation`/`applyMutations`/`nextLogEntry` unchanged.

**Non-Goals:**
- Any scripting/handler mechanism (flow-gu1.10), per-phase opt-in of the modal (flow-00x), or richer value types/validation (flow-9v9) — out of scope, filed separately.
- Preventing overlapping modals if a second phase completes while one is still open (see Risks).
- Re-deriving the default `value` if the user edits the `property` field mid-modal.

## Decisions

### 1. A new `WriteBackPromptPort`, mirroring the existing port pattern

New file `src/domain/mutation/write-back-prompt.ts`:
```ts
export interface WriteBackFormValues {
  readonly filePath: string
  readonly property: string
  readonly value: number | string | boolean
}

export type WriteBackPromptResult
  = | { readonly kind: 'submitted', readonly values: WriteBackFormValues }
    | { readonly kind: 'cancelled' }

export interface WriteBackPromptPort {
  readonly prompt: (defaults: WriteBackFormValues) => Promise<WriteBackPromptResult>
}
```
`writeBackPhaseCompletion` awaits `deps.writeBackPrompt.prompt({ filePath, property: entry.property, value: entry.value })` right after computing `entry` via `nextLogEntry`, and only builds/applies a `FileMutation` on `{ kind: 'submitted' }`; `{ kind: 'cancelled' }` returns `{ kind: 'skipped' }`, identical to the existing no-target-resolved path. `WriteBackDeps` gains a `writeBackPrompt: WriteBackPromptPort` field.
**Why a new port instead of reusing something existing:** `FrontmatterReader` only reads; `FileMutationPort` only applies. Neither has a "ask the user" shape, and folding this into either would mix concerns the way the frontmatter-write-back-trigger design doc already deliberately avoided (see its decision 3).

### 2. Real implementation: a `Modal` subclass plus a thin adapter class

New `src/views/write-back-modal.ts`:
- `WriteBackModal extends Modal`: builds three `Setting` rows (file, property, value) pre-filled from the constructor's `defaults`, plus Submit/Cancel buttons. Exposes `waitForResult(): Promise<WriteBackPromptResult>`, which calls `this.open()` and returns a promise resolved either by the submit handler (before calling `this.close()`) or by `onClose()` — `onClose` only resolves `{ kind: 'cancelled' }` if a `submitted` flag wasn't already set, so the promise resolves exactly once regardless of which path fires. This is the standard "Modal as an awaitable" pattern used across community Obsidian plugins (no built-in Obsidian API does this).
- `ObsidianWriteBackPromptPort implements WriteBackPromptPort`: `prompt(defaults)` constructs a `WriteBackModal(this.app, defaults)` and returns `.waitForResult()`. This is the class `main.ts` instantiates and passes into `WriteBackDeps`, exactly like `ObsidianFrontmatterReader`/`ObsidianFileMutationPort` today.

**Why a separate adapter class instead of having `WriteBackModal` itself satisfy `WriteBackPromptPort`:** `WriteBackPromptPort.prompt` is called once per phase completion and must hand back a *fresh* modal each time (a `Modal` instance is single-use — it can't be reopened after `close()`); a thin adapter that constructs a new `WriteBackModal` per call keeps that lifecycle detail out of `write-back.ts` and matches "one instance per call" rather than a stateful singleton.

### 3. File field: `AbstractInputSuggest<TFile>` over a plain text input

The file field is a text `Setting` component paired with a custom `AbstractInputSuggest<TFile>` (Obsidian's suggest-popover base class): `getSuggestions(query)` filters `this.app.vault.getFiles()` by substring match against `file.path`, and `onSelect` writes the chosen file's path back into the input and internal state. This is vault-wide (per the earlier decision), not constrained to `LogTargetResolverRegistry`-resolvable paths.
**Why not `FuzzySuggestModal`:** that opens its own full-screen modal, which can't be embedded as one field inside another modal. `AbstractInputSuggest` is the documented mechanism for an inline suggest-as-you-type field.

### 4. Value coercion on submit: number-if-parseable, else string

The value field is a single text `Setting` component (no separate numeric/boolean widgets — that's flow-9v9). On submit, the raw input string is coerced with the same rule `nextLogEntry` already uses: trim, and if `Number(trimmed)` is finite and `trimmed !== ''`, submit `Number(trimmed)`; otherwise submit the raw string.
**Why:** the default value is usually a number (`nextLogEntry`'s increment). If accepting the default round-tripped it through a text field back into a string, the *next* phase completion's `frontmatterReader.readValue` would see a string, and `nextLogEntry`'s `typeof currentValue === 'number'` check would reset the counter to `1` every time instead of incrementing — silently breaking the common "just hit submit" path. Matching `nextLogEntry`'s own finite-number heuristic keeps that path working.
**Trade-off accepted:** a genuinely string-typed value that happens to look numeric (e.g. `"007"`) gets coerced to a number. Same class of heuristic the codebase already accepts in `nextLogEntry`; not treated as a correctness requirement here.

### 5. No pause/blocking of the timer while the modal is open

Opening the modal does not stop `TimerTicker` or block the next phase's natural progression — matches today's fire-and-forget write-back (a slow API call today also wouldn't have blocked anything). See Risks for the overlap case this permits.

## Risks / Trade-offs

- **[Risk]** The modal's open time is unbounded (waiting on the user), so if a second phase completes before the first modal is dismissed, a second `prompt()` call happens concurrently → **Mitigation:** not specially handled in this change; Obsidian's `Modal` stacks by default (each `open()` adds another layer), so the user would see two modals rather than a crash. Revisit only if manual testing shows this is actually disruptive — flow-00x (per-phase opt-in/skip) is the natural place to fix it if so.
- **[Trade-off]** Numeric coercion heuristic can misclassify a string that looks numeric → accepted, matches `nextLogEntry`'s existing heuristic (see Decision 4).
- **[Risk]** Existing tests around `writeBackPhaseCompletion` (if any assert synchronous auto-apply) need a fake `WriteBackPromptPort` that immediately resolves `{ kind: 'submitted', values: defaults }` to keep asserting today's default-value behavior, plus new tests for the cancelled/edited-value paths → tracked in tasks.md.

## Open Questions

None blocking implementation.
