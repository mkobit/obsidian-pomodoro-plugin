## ADDED Requirements

### Requirement: writeFrontmatter sets the property on the resolved file
Given a `frontmatter` mutation whose `filePath` resolves to a vault file, `writeFrontmatter` SHALL set that file's frontmatter `property` to the mutation's `value`, and the returned promise SHALL resolve.

#### Scenario: Frontmatter property is written on an existing file
- **WHEN** `writeFrontmatter` is called with a mutation whose `filePath` resolves to a file
- **THEN** the file's frontmatter is updated so `property` equals `value`, and the returned promise resolves

### Requirement: appendText appends to the resolved file
Given an `append` mutation whose `filePath` resolves to a vault file, `appendText` SHALL append the mutation's `text` to that file's contents, and the returned promise SHALL resolve.

#### Scenario: Text is appended to an existing file
- **WHEN** `appendText` is called with a mutation whose `filePath` resolves to a file
- **THEN** the mutation's `text` is appended to the file, and the returned promise resolves

### Requirement: An unresolvable filePath rejects the mutation
When a `frontmatter` or `append` mutation's `filePath` does not resolve to a vault file, `writeFrontmatter`/`appendText` SHALL reject rather than throwing synchronously or silently no-op'ing, so `applyMutations` can surface the failure via its `{ success: false, cause }` result.

#### Scenario: writeFrontmatter rejects for a missing file
- **WHEN** `writeFrontmatter` is called with a mutation whose `filePath` does not resolve to a vault file
- **THEN** the returned promise rejects, and no frontmatter write is attempted

#### Scenario: appendText rejects for a missing file
- **WHEN** `appendText` is called with a mutation whose `filePath` does not resolve to a vault file
- **THEN** the returned promise rejects, and no append is attempted

### Requirement: Queue mutation methods are not yet supported
`reorderQueueItem` and `changeQueueItemStatus` SHALL reject unconditionally, regardless of the mutation's `itemId`, because no TaskSource/queue runtime exists yet to resolve a `TaskQueueItemId` to a vault file.

#### Scenario: reorderQueueItem always rejects
- **WHEN** `reorderQueueItem` is called with any `queueReorder` mutation
- **THEN** the returned promise rejects

#### Scenario: changeQueueItemStatus always rejects
- **WHEN** `changeQueueItemStatus` is called with any `queueStatusChange` mutation
- **THEN** the returned promise rejects
