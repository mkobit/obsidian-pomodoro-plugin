# frontmatter-write-back-trigger Specification

## Purpose
TBD - created by archiving change frontmatter-write-back-trigger. Update Purpose after archive.
## Requirements
### Requirement: Phase.logTarget represents where completion write-back goes
`Phase.logTarget` SHALL be one of two variants: `{ kind: 'activeItem' }`, meaning the write-back targets the engine's currently active task file, or `{ kind: 'callback', name: LogTargetResolverName }`, meaning the write-back target is resolved by looking up `name` in a `LogTargetResolverRegistry`.

#### Scenario: A phase with an activeItem log target
- **WHEN** a `Phase` is constructed with `logTarget: { kind: 'activeItem' }`
- **THEN** the schema validates it without requiring any additional parameters

#### Scenario: A phase with a callback log target
- **WHEN** a `Phase` is constructed with `logTarget: { kind: 'callback', name: 'dailyNote' }`
- **THEN** the schema validates it, carrying `name` for later resolution

### Requirement: LogTargetResolverRegistry resolves callback targets by name, never by eval
A `LogTargetResolverRegistry` SHALL expose `resolve(name: LogTargetResolverName): ((phase: Phase) => string | null) | undefined`. Resolution SHALL be a plain lookup against resolvers the registry was constructed with — never evaluating a name as code.

#### Scenario: An unregistered callback name resolves to nothing
- **WHEN** `resolve` is called with a name the registry has no resolver for
- **THEN** it returns `undefined`

#### Scenario: A registered callback name resolves to its function
- **WHEN** `resolve` is called with a name the registry was constructed with
- **THEN** it returns the corresponding `(phase: Phase) => string | null` function

### Requirement: nextLogEntry computes the next single-field write-back value
`nextLogEntry(currentValue: unknown, property: string, recordedAt: Temporal.Instant)` SHALL return a `LogEntry` whose `value` is `currentValue + 1` when `currentValue` is a `number`, and `1` otherwise (including when `currentValue` is `undefined`, a string, a boolean, or any other non-number). The returned `LogEntry`'s `property` and `recordedAt` SHALL echo the given arguments unchanged.

#### Scenario: Current value is a number
- **WHEN** `nextLogEntry(3, 'pomodoros', now)` is called
- **THEN** it returns `{ property: 'pomodoros', value: 4, recordedAt: now }`

#### Scenario: Current value is missing or non-numeric
- **WHEN** `nextLogEntry(undefined, 'pomodoros', now)` or `nextLogEntry('not-a-number', 'pomodoros', now)` is called
- **THEN** it returns a `LogEntry` with `value: 1`

### Requirement: Write-back orchestration resolves a target, then reads, computes, and applies a single frontmatter mutation
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

### Requirement: Write-back triggers on every phase completion, not only focus-kind phases
The plugin SHALL invoke the write-back orchestrator on every phase transition (i.e. whenever the engine's current phase id changes), regardless of the completed phase's `kind`. Whether a write actually occurs SHALL be determined solely by the completed phase's `logTarget` resolution, not by a phase-kind check.

#### Scenario: A non-focus phase with a resolvable target still writes back
- **WHEN** a break phase (kind `break`) completes and its `logTarget` resolves to a file path
- **THEN** the orchestrator applies the write-back the same as it would for a focus phase

