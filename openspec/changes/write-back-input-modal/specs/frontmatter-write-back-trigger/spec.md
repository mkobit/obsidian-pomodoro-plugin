## MODIFIED Requirements

### Requirement: Write-back orchestration resolves a target, then reads, computes, prompts, and applies a single frontmatter mutation
On a phase completion, the orchestrator SHALL resolve the completed phase's write-back target from its `logTarget`: for `{ kind: 'activeItem' }`, the target is the engine's current `activeFilePath` (or no target if it is `null`); for `{ kind: 'callback', name }`, the target is whatever the resolved function (if any) returns for that `name`, given the phase. When a target file path is resolved, the orchestrator SHALL read the file's current value at the configured write-back property, compute the next `LogEntry` via `nextLogEntry`, and prompt the user (via `WriteBackPromptPort`) with those computed values as defaults. If the user submits the prompt, the orchestrator SHALL build a `FileMutation` of kind `frontmatter` from the (possibly user-edited) submitted values and apply it via the given `FileMutationPort`. The orchestrator SHALL return `{ kind: 'skipped' }` when no target resolves or the user cancels the prompt, or `{ kind: 'applied', result }` (the `ApplyMutationsResult` from applying the mutation) when the user submits.

#### Scenario: activeItem target with an active file prompts and writes back on submit
- **WHEN** a completed phase has `logTarget: { kind: 'activeItem' }`, the engine state's `activeFilePath` is set, and the user submits the prompt without changing any field
- **THEN** the orchestrator reads the current frontmatter value at that file, prompts with defaults computed via `nextLogEntry`, applies a `frontmatter` `FileMutation` matching those defaults, and returns `{ kind: 'applied', result }`

#### Scenario: activeItem target with no active file is skipped without prompting
- **WHEN** a completed phase has `logTarget: { kind: 'activeItem' }` and the engine state's `activeFilePath` is `null`
- **THEN** the orchestrator returns `{ kind: 'skipped' }` without reading any file, showing a prompt, or calling the `FileMutationPort`

#### Scenario: callback target with an unregistered resolver is skipped without prompting
- **WHEN** a completed phase has `logTarget: { kind: 'callback', name: 'dailyNote' }` and the `LogTargetResolverRegistry` has no resolver registered for `'dailyNote'`
- **THEN** the orchestrator returns `{ kind: 'skipped' }` without reading any file, showing a prompt, or calling the `FileMutationPort`

#### Scenario: callback target with a registered resolver prompts and writes back on submit
- **WHEN** a completed phase has `logTarget: { kind: 'callback', name }`, the registry's resolver for `name` returns a file path for that phase, and the user submits the prompt
- **THEN** the orchestrator reads that file's current frontmatter value, prompts with defaults computed via `nextLogEntry`, applies a `frontmatter` `FileMutation` from the submitted values, and returns `{ kind: 'applied', result }`

#### Scenario: callback target with a registered resolver that returns null is skipped without prompting
- **WHEN** a completed phase has `logTarget: { kind: 'callback', name }` and the registry's resolver for `name` is registered but returns `null` for that phase
- **THEN** the orchestrator returns `{ kind: 'skipped' }` without reading any file, showing a prompt, or calling the `FileMutationPort`

#### Scenario: User cancels the prompt
- **WHEN** a target resolves and the user cancels the prompt (e.g. presses Escape) instead of submitting
- **THEN** the orchestrator returns `{ kind: 'skipped' }` without calling the `FileMutationPort`

#### Scenario: User edits a field before submitting
- **WHEN** a target resolves and the user changes the file, property, and/or value in the prompt before submitting
- **THEN** the orchestrator builds and applies the `FileMutation` from the edited values, not the originally computed defaults
