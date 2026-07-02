## Why

No code anywhere consumes a `FileMutation` (`src/domain/mutation/file-mutation.ts`).
Hooks and completion policies both intend to produce `FileMutation[]` write-back intents, but nothing applies them, so flow-qx9 (wire Hook execution) and flow-xn3 (wire CompletionPolicy execution) are blocked with no mechanism to call into.

## What Changes

- Add `FileMutationPort`, a domain-layer interface with one typed method per `FileMutation` kind (`writeFrontmatter`, `appendText`, `reorderQueueItem`, `changeQueueItemStatus`).
- Add `applyMutations(port, mutations)`, a sequential, fail-fast async dispatcher that routes each mutation to its matching port method.
- Add `ApplyMutationsResult`, a discriminated union (`{ success: true } | { success: false, mutation, cause }`) resolved on the first failed mutation, carrying the offending mutation and its cause — mirrors zod's `safeParse` convention rather than throwing/rejecting (see design.md's Decisions for why: `src/domain/**` is held to strict functional-style lint rules that disallow `throw`/`Promise.reject`/classes, unlike the Obsidian-API-driven `src/timer/**`).
- Add unit tests against a hand-written fake `FileMutationPort`.
- Do **not** add a real Obsidian-backed `FileMutationPort` implementation — deferred to a later bead once the surrounding Obsidian integration layer (TaskSource, frontmatter write-back triggers) is ready.
- Do **not** wire `applyMutations` into `src/timer/reducer.ts`, `src/timer/store.ts`, or `EngineState` — that is flow-qx9 and flow-xn3.
- Do **not** populate `PhaseInstance.mutationsApplied` — that is flow-c08, which depends on this change plus flow-qx9/flow-xn3.

## Capabilities

### New Capabilities
- `file-mutation-apply`: applying `FileMutation` intents (produced by hooks and completion policies) against a vault, via a port interface and a fail-fast sequential dispatcher, fully testable without Obsidian.

### Modified Capabilities
(none — this is new domain surface, no existing spec's requirements change)

## Impact

- New file: `src/domain/mutation/apply-mutations.ts` (exports `FileMutationPort`, `ApplyMutationsResult`, `applyMutations`).
- New test file: `tests/apply-mutations.test.ts`.
- No changes to `src/timer/reducer.ts`, `src/timer/store.ts`, or `src/domain/session/engine-state.ts`.
- No new runtime dependencies.
- Unblocks flow-qx9 and flow-xn3 (tracked in beads, not in this proposal).
