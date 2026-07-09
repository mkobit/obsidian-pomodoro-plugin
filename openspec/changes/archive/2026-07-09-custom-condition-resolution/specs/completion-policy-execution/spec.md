## MODIFIED Requirements

### Requirement: Unimplemented completion policies throw at tick-driven completion
When the current phase's `completionPolicy.kind` is `queueCycle` or `futureDate` and a `tick` action would bring `remaining` to zero (or below), `engineReducer` SHALL throw rather than silently applying `null`/`noOp` behavior or partially executing the policy. `CompletionPolicy` no longer has a `'custom'` variant — a phase needing custom completion-time `FileMutation`s declares an `onComplete` `HookReference` instead.

#### Scenario: queueCycle throws instead of silently advancing
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'queueCycle' }` and `remaining` is zero
- **THEN** `engineReducer` throws

#### Scenario: futureDate throws instead of silently advancing
- **WHEN** `tick` is dispatched against a `'running'` phase whose `completionPolicy` is `{ kind: 'futureDate', after: <duration> }` and `remaining` is zero
- **THEN** `engineReducer` throws
