# transition-predicate-resolution Specification

## Purpose
TBD - created by archiving change custom-condition-resolution. Update Purpose after archive.
## Requirements
### Requirement: A 'custom' TransitionCondition resolves via a configured PredicateRegistry
When `resolveNextPhaseId` evaluates a transition whose `condition.kind` is `'custom'`, it SHALL resolve `condition.predicate` via the configured `PredicateRegistry` and, if resolution succeeds, evaluate the resolved `Predicate` against the current `fromPhaseId` and `visitCounts`. The transition is satisfied if and only if the predicate returns `true`.

#### Scenario: A resolvable predicate returning true satisfies the transition
- **WHEN** `resolveNextPhaseId` evaluates a `'custom'` transition whose predicate name resolves via the configured `PredicateRegistry` to a function that returns `true`
- **THEN** `resolveNextPhaseId` returns that transition's `toPhaseId`

#### Scenario: A resolvable predicate returning false does not satisfy the transition
- **WHEN** `resolveNextPhaseId` evaluates a `'custom'` transition whose predicate name resolves to a function that returns `false`, and a later candidate transition's condition is satisfied
- **THEN** `resolveNextPhaseId` does not return the `'custom'` transition's `toPhaseId`, and returns the later candidate's `toPhaseId` instead

### Requirement: An unresolved or absent predicate is treated as not satisfied
When a `'custom'` condition's predicate name does not resolve via the configured `PredicateRegistry` (`resolve` returns `undefined`), or no `PredicateRegistry` is supplied at all, `resolveNextPhaseId` SHALL treat that condition as not satisfied rather than throwing.

#### Scenario: An unregistered predicate name does not throw
- **WHEN** `resolveNextPhaseId` evaluates a `'custom'` transition whose predicate name is not present in the configured `PredicateRegistry`, and a later candidate transition's condition is satisfied
- **THEN** `resolveNextPhaseId` does not throw, and returns the later candidate's `toPhaseId`

#### Scenario: No PredicateRegistry configured treats every custom condition as unsatisfied
- **WHEN** `resolveNextPhaseId` is called without a `PredicateRegistry` argument and evaluates a `'custom'` transition
- **THEN** that transition is treated as not satisfied, without throwing

#### Scenario: Every candidate unsatisfied still throws the existing "no eligible transition" error
- **WHEN** every candidate transition from a phase is unsatisfied, including one or more `'custom'` conditions whose predicates are unresolved
- **THEN** `resolveNextPhaseId` throws the same "no eligible transition" error it throws today for any other fully-unsatisfied graph

### Requirement: engineReducer accepts an optional PredicateRegistry without changing existing behavior when omitted
`engineReducer` SHALL accept an optional `PredicateRegistry` parameter, threaded through to `resolveNextPhaseId`. Omitting it SHALL produce behavior identical to today for any graph that declares no `'custom'` `TransitionCondition`.

#### Scenario: Existing three-argument call sites are unaffected
- **WHEN** `engineReducer` is called with only `(state, action, graph)` against a graph with no `'custom'` transitions
- **THEN** the resulting state matches the behavior `engineReducer` produced before `PredicateRegistry` was introduced
