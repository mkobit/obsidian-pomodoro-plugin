## 1. Domain module

- [ ] 1.1 Create `src/domain/mutation/apply-mutations.ts` with the `FileMutationPort` interface (`writeFrontmatter`, `appendText`, `reorderQueueItem`, `changeQueueItemStatus`), each method typed against `Extract<FileMutation, { kind: '...' }>`
- [ ] 1.2 Add `MutationApplyError` class carrying the failing `mutation` and `cause`
- [ ] 1.3 Implement `applyMutations(port, mutations): Promise<void>` — sequential dispatch by `mutation.kind`, fail-fast, empty array resolves immediately

## 2. Tests

- [ ] 2.1 Create `tests/apply-mutations.test.ts` with a hand-written fake `FileMutationPort` (records calls, can be configured to reject on a given call)
- [ ] 2.2 Test: each `FileMutation` kind dispatches to its matching port method with the mutation intact
- [ ] 2.3 Test: multiple mutations dispatch in array order
- [ ] 2.4 Test: a failure partway through a batch stops dispatch (later port methods never called) and rejects with `MutationApplyError` wrapping the failing mutation
- [ ] 2.5 Test: an empty mutation list resolves without invoking the port

## 3. Verification

- [ ] 3.1 `bun test ./tests` passes
- [ ] 3.2 `bun run typecheck` passes
- [ ] 3.3 `bun run lint` passes
- [ ] 3.4 Close flow-2yp in beads, referencing this change
