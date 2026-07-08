## ADDED Requirements

### Requirement: WriteBackPromptPort resolves user confirmation as data, not a live callback baked into Phase
A `WriteBackPromptPort` SHALL expose `prompt(defaults: WriteBackFormValues): Promise<WriteBackPromptResult>`, where `WriteBackFormValues` is `{ filePath: string, property: string, value: number | string | boolean }` and `WriteBackPromptResult` is either `{ kind: 'submitted', values: WriteBackFormValues }` or `{ kind: 'cancelled' }`. The port SHALL be injected into the write-back orchestrator as a dependency, consistent with `FrontmatterReader` and `FileMutationPort`.

#### Scenario: Submitting the prompt returns the (possibly edited) values
- **WHEN** `prompt(defaults)` is called and the user submits the form with some fields changed from `defaults`
- **THEN** the returned promise resolves to `{ kind: 'submitted', values }` where `values` reflects what the user actually submitted, not `defaults`

#### Scenario: Cancelling the prompt returns no values
- **WHEN** `prompt(defaults)` is called and the user cancels (e.g. Escape, clicking outside, or a Cancel action) without submitting
- **THEN** the returned promise resolves to `{ kind: 'cancelled' }`

### Requirement: The real prompt implementation is a vault-wide file-suggest modal, seeded with resolved defaults
The Obsidian-backed `WriteBackPromptPort` implementation SHALL open a modal with three fields — target file, property, value — pre-filled from `defaults`. The file field SHALL suggest from every file in the vault (not limited to `LogTargetResolverRegistry`-resolvable paths) as the user types.

#### Scenario: Modal opens pre-filled with computed defaults
- **WHEN** the modal opens with `defaults: { filePath, property, value }`
- **THEN** the file, property, and value fields display exactly those values before the user types anything

#### Scenario: File field suggests vault-wide as the user types
- **WHEN** the user types a query into the file field
- **THEN** the suggestion list shows files from anywhere in the vault whose path matches the query, not only files a registered log-target resolver could produce

### Requirement: Submitted text values are coerced to a number when they parse as one
On submit, the value field's raw text SHALL be coerced to a `number` if trimming it yields a non-empty string that parses to a finite number (via `Number(trimmed)`); otherwise it SHALL be submitted as the raw string.

#### Scenario: Accepting a numeric default keeps it numeric
- **WHEN** the value field is pre-filled with a numeric default (e.g. `4`) and the user submits without editing it
- **THEN** the submitted `values.value` is the number `4`, not the string `"4"`

#### Scenario: A non-numeric value is submitted as a string
- **WHEN** the user types a value that does not parse as a finite number (e.g. `"in progress"`)
- **THEN** the submitted `values.value` is that raw string
