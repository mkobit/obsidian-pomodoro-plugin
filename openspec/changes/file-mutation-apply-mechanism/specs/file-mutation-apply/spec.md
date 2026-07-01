## ADDED Requirements

### Requirement: Dispatch to the matching port method
`applyMutations` SHALL route each `FileMutation` to the `FileMutationPort` method matching its `kind`: `frontmatter` → `writeFrontmatter`, `append` → `appendText`, `queueReorder` → `reorderQueueItem`, `queueStatusChange` → `changeQueueItemStatus`. The full mutation object SHALL be passed to the port method, not a subset of its fields.

#### Scenario: Each mutation kind reaches its matching port method
- **WHEN** `applyMutations` is called with one mutation of each kind
- **THEN** each corresponding `FileMutationPort` method is called exactly once, with the matching mutation object intact

### Requirement: Sequential, ordered dispatch
`applyMutations` SHALL dispatch mutations one at a time, in the order they appear in the input array, awaiting each port call before starting the next.

#### Scenario: Mutations apply in array order
- **WHEN** `applyMutations` is called with multiple mutations
- **THEN** the port records calls in the same order as the input array, with no call starting before the previous one resolves

### Requirement: Fail-fast on the first error
`applyMutations` SHALL stop dispatching further mutations as soon as one port call rejects. It SHALL reject with a `MutationApplyError` that carries the failing mutation and the original rejection as `cause`. Mutations after the failing one in the input array SHALL NOT be dispatched to the port.

#### Scenario: A failure partway through a batch stops the batch
- **WHEN** `applyMutations` is called with three mutations and the port rejects on the second
- **THEN** the port's method for the third mutation is never called, and `applyMutations` rejects with a `MutationApplyError` referencing the second mutation

### Requirement: Empty batch is a no-op
`applyMutations` SHALL resolve immediately, without invoking any port method, when called with an empty mutations array.

#### Scenario: Empty mutation list touches nothing
- **WHEN** `applyMutations` is called with an empty array
- **THEN** it resolves without calling any `FileMutationPort` method
