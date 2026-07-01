## Context

`FileMutation` (`src/domain/mutation/file-mutation.ts`) is a closed union of vault write intents: `frontmatter`, `append`, `queueReorder`, `queueStatusChange`.
`Hook` (`src/domain/hook/hook.ts`) and `CompletionPolicy` (`src/domain/policy/completion-policy.ts`) both intend to produce `FileMutation[]`, but nothing in the codebase consumes one yet.
This repo follows a domain-first priority: build and unit-test the domain/application layer before the Obsidian integration layer.
The domain already has a couple of similar extension seams (`HookRegistry`, `TaskSource`) — this design deliberately adds only one more (`FileMutationPort`), not a family of new interfaces or a registry.

## Goals / Non-Goals

**Goals:**
- Define the seam (`FileMutationPort`) between a domain-produced `FileMutation` intent and an actual vault write, so a real Obsidian adapter can be written later without changing the domain layer.
- Provide a pure, fully unit-testable dispatcher (`applyMutations`) that hooks/completion-policy wiring can call.
- Keep the new public surface minimal: one interface, one error class, one function.

**Non-Goals:**
- Implementing a real Obsidian-backed `FileMutationPort`. That is later integration work, once TaskSource and frontmatter write-back triggers exist.
- Wiring `applyMutations` into `src/timer/reducer.ts`, `src/timer/store.ts`, or `EngineState`. That is flow-qx9 (Hook execution) and flow-xn3 (CompletionPolicy execution).
- Populating `PhaseInstance.mutationsApplied` (`src/domain/session/session.ts`). That is flow-c08, which depends on this change plus flow-qx9/flow-xn3.
- Retry, rollback, or undo semantics for a partially-applied batch.

## Decisions

**One `FileMutationPort` interface with 4 typed methods, not a single generic `apply(mutation)`.**
Each method takes the full discriminated `FileMutation` variant (e.g. `writeFrontmatter(mutation: Extract<FileMutation, { kind: 'frontmatter' }>)`), so the port signature stays locked to the `FileMutation` schema as its single source of truth, and a test fake can selectively reject one kind without inspecting `mutation.kind` itself. The alternative (one generic method) has a smaller interface but pushes the kind-switch into every implementer and loses per-kind type safety and fakability. Method count scales 1:1 with the closed union (currently 4); interface *count* stays at one.

**Sequential dispatch, not `Promise.all`.**
Real vault writes can target the same file (e.g. two `frontmatter` mutations against one note in a single batch). Sequential dispatch keeps ordering deterministic and avoids write races. The cost is no parallelism, which is acceptable — batches are small (a handful of mutations from one hook/policy invocation), not bulk operations.

**Fail-fast, not collect-all-results.**
On the first rejected port call, `applyMutations` wraps it in `MutationApplyError` (carrying the mutation and the cause) and rejects immediately; later mutations in the batch are never dispatched. This was chosen over collecting a `{ applied, failed }` result set — the caller (flow-qx9/flow-xn3, later) needs a single clear failure signal, not partial-success bookkeeping this early. `applyMutations` resolves with `void` on success: fail-fast plus a successful resolution already implies the entire input was applied.

**New file `src/domain/mutation/apply-mutations.ts`, not added to `file-mutation.ts`.**
Keeps the schema/type definition (`file-mutation.ts`) separate from the port and dispatch logic, matching how `hook.ts` and `completion-policy.ts` are already split from the types they operate on.

## Risks / Trade-offs

- [Fail-fast discards partial-success information] → Acceptable for now since no caller needs it yet; flow-c08's `mutationsApplied` design pass can revisit if a future caller needs partial-success detail.
- [Sequential dispatch is slower than parallel for large batches] → Batches are expected to be small (single hook/policy invocation's worth of mutations), so this is not a real bottleneck.
- [No real adapter means this change alone doesn't make anything visibly work in Obsidian] → Intentional; matches domain-first priority. flow-qx9/flow-xn3 and a later Obsidian-adapter change are required before this has any user-visible effect.

## Migration Plan

Not applicable — purely additive new module and test file. No existing code changes, no data migration, no rollback concerns.

## Open Questions

None outstanding. Scope, error-handling model, and interface shape were confirmed during design review (see proposal.md's Impact section for what's explicitly excluded).
