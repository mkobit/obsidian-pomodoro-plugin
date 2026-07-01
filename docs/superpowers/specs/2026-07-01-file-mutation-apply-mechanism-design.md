# FileMutation-apply mechanism design

This document describes the design for flow-2yp: a domain-layer mechanism that applies `FileMutation` intents produced by hooks and completion policies.
No code anywhere currently consumes a `FileMutation` — this closes that gap for the domain layer only, ahead of the Obsidian-side wiring that will come later.

## Goal

Hooks (`src/domain/hook/hook.ts`) and completion policies (`src/domain/policy/completion-policy.ts`) both intend to produce `FileMutation[]` — a closed union of vault write intents: `frontmatter`, `append`, `queueReorder`, `queueStatusChange`.
This bead builds the mechanism that turns those intents into calls against a vault, in a way that is fully unit-testable without Obsidian.
It exists to unblock flow-qx9 (wire Hook execution) and flow-xn3 (wire CompletionPolicy execution), which will call into this mechanism once they land.

## Scope

In scope:
- A `FileMutationPort` interface — the seam between domain intent and vault write.
- `applyMutations`, a pure-ish async dispatcher that routes each `FileMutation` to the matching port method.
- `MutationApplyError`, thrown on the first failed mutation.
- Unit tests against a hand-written fake `FileMutationPort`.

Out of scope, deliberately:
- A real Obsidian-backed `FileMutationPort` implementation. That is later integration work, once the surrounding Obsidian layer (TaskSource, frontmatter write-back triggers) is ready.
- Wiring `applyMutations` into `src/timer/reducer.ts`, `src/timer/store.ts`, or `EngineState`. That is flow-qx9 and flow-xn3.
- Populating `PhaseInstance.mutationsApplied` (`src/domain/session/session.ts`). That is flow-c08, which explicitly depends on this bead plus flow-qx9/flow-xn3.

## API surface

This design keeps the new public surface to three exports in one new file, `src/domain/mutation/apply-mutations.ts`.
The number of methods on `FileMutationPort` scales with the closed `FileMutation` union (currently 4), not with unrelated concerns — a single cohesive interface, not several small ones.

```typescript
export interface FileMutationPort {
  writeFrontmatter(mutation: Extract<FileMutation, { kind: 'frontmatter' }>): Promise<void>
  appendText(mutation: Extract<FileMutation, { kind: 'append' }>): Promise<void>
  reorderQueueItem(mutation: Extract<FileMutation, { kind: 'queueReorder' }>): Promise<void>
  changeQueueItemStatus(mutation: Extract<FileMutation, { kind: 'queueStatusChange' }>): Promise<void>
}

export class MutationApplyError extends Error {
  readonly mutation: FileMutation
  constructor(mutation: FileMutation, cause: unknown)
}

export function applyMutations(
  port: FileMutationPort,
  mutations: readonly FileMutation[],
): Promise<void>
```

Each port method takes the full discriminated `FileMutation` variant rather than destructured fields, so the port signature stays locked to the `FileMutation` schema as its single source of truth — no duplicated field lists to drift out of sync.

## Behavior

`applyMutations` awaits each mutation sequentially, in array order, dispatching to the matching port method by `mutation.kind`.
Sequential rather than `Promise.all` — real vault writes can target the same file (e.g. two `frontmatter` mutations against one note), so ordering must be deterministic and writes must not race.
On the first rejected port call, `applyMutations` wraps the failure in a `MutationApplyError` (carrying the offending mutation and the original cause) and rejects immediately — fail-fast.
Later mutations in the batch are never dispatched once one fails.
On success, `applyMutations` resolves with `void`: fail-fast plus a successful resolution already implies every mutation in the input was applied, so there is nothing further to report back.
An empty `mutations` array resolves immediately without invoking the port at all.

## Testing

Tests live in `tests/apply-mutations.test.ts`, matching this repo's flat `tests/` convention (no colocated `*.test.ts` files).
A hand-written fake `FileMutationPort` records each call it receives and can be configured to reject on a specific call.
Cases to cover:
- Each `FileMutation` kind dispatches to its matching port method with the mutation intact.
- Multiple mutations apply in array order.
- A failure partway through a batch stops dispatch — later port methods are never called — and rejects with a `MutationApplyError` wrapping the failing mutation.
- An empty mutation list resolves without touching the port.
