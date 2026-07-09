## MODIFIED Requirements

### Requirement: Resolved hooks are invoked with a synthesized HookContext
For each fired event whose phase declares a non-null `HookReference` for that event, `EngineStore` SHALL resolve the hook via the configured `HookRegistry` and, if resolution succeeds, invoke it with a `HookContext` whose `phase` is the firing phase, whose `activeFilePath` is the engine state's current `activeFilePath` at the moment the event fired, and whose `instance`/`session` are freshly constructed for that call (not read from persisted state).

#### Scenario: A declared and resolvable hook is invoked
- **WHEN** an `onEnter` event fires for a phase whose `onEnter` field is a `HookReference` naming a hook registered in the configured `HookRegistry`
- **THEN** `EngineStore` calls that hook exactly once, with a `HookContext.phase` equal to the firing phase

#### Scenario: A phase with no hook declared for the firing event invokes nothing
- **WHEN** an `onExit` event fires for a phase whose `onExit` field is `null`
- **THEN** `EngineStore` does not call `HookRegistry.resolve` or any hook for that event

#### Scenario: HookContext carries the engine's current active file path
- **WHEN** a hook is invoked for an event fired while `EngineState.activeFilePath` is a non-null file path
- **THEN** the `HookContext` passed to that hook has `activeFilePath` equal to that same file path

### Requirement: Hook-produced FileMutations are applied via the configured FileMutationPort
`Hook` SHALL be invoked as a function returning `Promise<readonly FileMutation[]>`. `EngineStore` SHALL `await` that promise before applying the resolved `FileMutation[]`; when the awaited result is non-empty, `EngineStore` SHALL apply them via `applyMutations` against the configured `FileMutationPort`.

#### Scenario: A hook's returned mutations are applied
- **WHEN** a resolved hook is invoked and its returned promise resolves with one or more `FileMutation`s
- **THEN** `EngineStore` calls `applyMutations` with the configured `FileMutationPort` and that mutation list

#### Scenario: EngineStore awaits an interactive hook before proceeding
- **WHEN** a resolved hook's body awaits a user-facing prompt before its returned promise resolves
- **THEN** `EngineStore` does not call `applyMutations` for that event until the hook's promise resolves, and does not skip or reorder later events ahead of it in the same dispatch
