## 1. Domain module

- [x] 1.1 Create `src/domain/mutation/apply-mutations.ts` with the `FileMutationPort` interface (`writeFrontmatter`, `appendText`, `reorderQueueItem`, `changeQueueItemStatus`), each method typed against `Extract<FileMutation, { kind: '...' }>`
- [x] 1.2 Add `ApplyMutationsResult` discriminated union carrying the failing `mutation` and `cause` on failure (revised from a thrown `MutationApplyError` class — `src/domain/**` is held to strict functional lint rules that disallow classes/throw/reject; see design.md's Decisions)
- [x] 1.3 Implement `applyMutations(port, mutations): Promise<ApplyMutationsResult>` — sequential dispatch by `mutation.kind` via a ternary chain (no `switch`), recursive iteration (no loop), fail-fast, empty array resolves immediately with `{ success: true }`

## 2. Tests

- [x] 2.1 Create `tests/apply-mutations.test.ts` with a hand-written fake `FileMutationPort` (records calls, can be configured to reject on a given method)
- [x] 2.2 Test: each `FileMutation` kind dispatches to its matching port method with the mutation intact
- [x] 2.3 Test: multiple mutations dispatch in array order
- [x] 2.4 Test: a failure partway through a batch stops dispatch (later port methods never called) and resolves with `{ success: false, mutation, cause }` for the failing mutation
- [x] 2.5 Test: an empty mutation list resolves with `{ success: true }` without invoking the port

## 3. Verification

- [x] 3.1 `bun test ./tests` passes
- [x] 3.2 `bun run typecheck` passes
- [x] 3.3 `bun run lint` passes
- [x] 3.4 Close flow-2yp in beads, referencing this change
