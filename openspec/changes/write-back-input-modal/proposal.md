## Why

`src/timer/write-back.ts#writeBackPhaseCompletion` (flow-gu1.7) silently resolves a target file and auto-increments a frontmatter value on every phase completion — the user never sees or confirms what's about to be written. flow-gu1.8 replaces that silent path with a modal so the user can see and, if they want, override the target file, property, and value before anything is written to the vault.

## What Changes

- **BREAKING**: `writeBackPhaseCompletion` no longer applies a mutation directly. It resolves the target file and computes the default property/value (unchanged logic), then shows a modal seeded with those defaults, and only applies a mutation if the user submits.
- Add a `WriteBackModal` (Obsidian `Modal` subclass) with three fields: target file (vault-wide file-suggest), property (text), value (text) — pre-filled with the resolved defaults.
- Submitting the modal applies the (possibly edited) file/property/value via the existing `FileMutationPort`/`applyMutations` — no changes to `FileMutation`, `applyMutations`, or `nextLogEntry`.
- Cancelling (Escape, clicking outside, or a Cancel button) yields `{ kind: 'skipped' }`, identical to today's no-target-resolved case — nothing is written.
- `writeBackProperty` setting is unchanged; it still seeds the property field's default.
- Explicitly out of scope (tracked separately): agent-authored/scriptable write-back handlers (flow-gu1.10), per-phase opt-in/skip of the modal (flow-00x), richer value types/validation (flow-9v9).

## Capabilities

### New Capabilities
- `write-back-input-modal`: presenting a pre-filled, user-editable confirmation modal (file/property/value) before applying a phase-completion write-back mutation, replacing the previous silent auto-apply.

### Modified Capabilities
- `frontmatter-write-back-trigger`: the "resolve target, compute default value, apply mutation" flow now inserts a user-confirmation step between "compute default" and "apply" — the resolution and default-computation requirements are unchanged, but unconditional auto-apply is replaced by apply-on-submit/skip-on-cancel.

## Impact

- `src/timer/write-back.ts`: `writeBackPhaseCompletion` becomes interactive (awaits modal submit/cancel) instead of computing-and-applying synchronously.
- New file for `WriteBackModal` (Obsidian-adjacent, under `src/timer/` or `src/views/`, finalized in design.md).
- `src/main.ts`: wiring that calls `writeBackPhaseCompletion` needs the `App`/modal dependency threaded in.
- `tests/`: existing `write-back`-related tests need a fake/stub modal to keep covering the resolve-and-compute logic without real Obsidian UI.
- No changes to `FileMutation`, `applyMutations`, `nextLogEntry`, or settings schema.
