## Context

`EngineStore.dispatch` (`src/timer/store.ts`) already derives fired `HookEvent`s (`deriveHookEvents`, `src/timer/reducer.ts`), resolves each via an injected `HookRegistry`, invokes the resolved `Hook`, and applies its returned `FileMutation[]` via `applyMutations` against an injected `FileMutationPort`. This was built by the (archived) `hook-execution` change, entirely exercised via fakes — no real `Hook` has ever been registered. `src/main.ts` constructs `EngineStore` with a stub `hookRegistry = { resolve: () => undefined }` and instead drives write-back itself: a `store.subscribe` callback keeps a `lastState` closure, diffs `lastState.currentPhaseId !== state.currentPhaseId`, and on change calls `writeBackPhaseCompletion(lastPhase, lastState.activeFilePath, this.settings.writeBackProperty, writeBackDeps)` (`src/timer/write-back.ts`) directly.

`writeBackPhaseCompletion` is `async`: it resolves the phase's `logTarget` to a file path, reads the file's current frontmatter value, computes the next `LogEntry`, `await`s `WriteBackPromptPort.prompt(...)` (opens `WriteBackModal`, an Obsidian `Modal` — `src/views/write-back-modal.ts`), and only on `{ kind: 'submitted' }` builds and applies a `FileMutation`. `{ kind: 'cancelled' }` yields `{ kind: 'skipped' }` — nothing written.

`Hook`'s current type (`src/domain/hook/hook.ts`) is `(context: HookContext) => readonly FileMutation[]` — synchronous, by deliberate choice in `hook-execution`'s design (that change made `dispatch` itself `async` only for the `applyMutations` step, not because any `Hook` was expected to be interactive). `HookContext` is `{ phase, instance, session }` — no field carries `EngineState.activeFilePath`, the plain string `Phase.logTarget.kind === 'activeItem'` already resolves against (distinct from `PhaseInstance.activeItem`, a richer `TaskQueueItem`-shaped field hardcoded `null` pending `flow-djx`'s `TaskSource` work).

This is the first change to give `HookRegistry` a real entry, and per a standing project note, its Hook-contract decisions are precedent `flow-gu1.10` (the transition hook script runner) will design against — so the sync-vs-async fork below is deliberate, not a shortcut.

## Goals / Non-Goals

**Goals:**
- Replace `main.ts`'s inline state-diff write-back trigger with a real `Phase.onComplete` `Hook`, resolved and invoked through `EngineStore`/`HookRegistry` — no parallel mechanism.
- Preserve today's observable write-back behavior exactly: same prompt, same fields, same skip/apply/cancel semantics, fired on the same phase completions (all three `POMODORO_PHASE_GRAPH` phases, gated only by `logTarget` resolvability).
- Resolve the sync/async mismatch between `Hook`'s current contract and write-back's inherently interactive body, in a way that generalizes (doesn't special-case write-back inside `EngineStore`).

**Non-Goals:**
- Per-phase opt-in/skip of the modal (`flow-00x`), richer value types (`flow-9v9`), script-runner/agent-authored hooks (`flow-gu1.10`), real `PhaseInstance`/`Session` history (`flow-c08`), or `TaskSource` integration (`flow-djx`) — all separately tracked, none blocking this migration.
- Changing `WriteBackPromptPort`, `WriteBackModal`, `FileMutationPort`, or `ObsidianFileMutationPort`.
- Per-phase `HookReference.params` threading for `writeBackProperty` — it stays a global setting read live from `main.ts`'s closure, matching today.

## Decisions

**`Hook` becomes `(context: HookContext) => Promise<readonly FileMutation[]>` — always async, not a sync/async union.**
There is no way to synchronously `await` a `Promise` in JS, and `writeBackPhaseCompletion`'s body must `await deps.writeBackPrompt.prompt(...)` before it knows whether there's a mutation at all (cancel → none; submit → one, built from the *submitted*, possibly-edited values). Keeping `Hook` synchronous would force the interactive step outside the `Hook` body entirely. A `FileMutation[] | Promise<FileMutation[]>` union was considered and rejected: it buys nothing (every real call site would need to `await`/wrap anyway once one `Hook` needs it) and adds a second code path to `EngineStore.dispatch`'s hook loop for no benefit — one call shape (`await hook(context)`) covers both a pure synchronous hook (trivially resolves) and an interactive one.

**Alternative considered and rejected: keep `Hook` synchronous; wrap `FileMutationPort` in a confirm-before-apply decorator instead.**
Under this alternative, the write-back `Hook` would stay pure — compute the auto-incremented `FileMutation` synchronously, same shape as any other hook — and a `ConfirmingFileMutationPort` decorator (wrapping the real `ObsidianFileMutationPort`) would show `WriteBackModal` before delegating to the real `apply`, for every mutation that flows through it. Rejected: `FileMutationPort` is the single choke point *every* hook's mutations flow through, including future `flow-gu1.10` script-runner output. Gating all of them behind the write-back confirmation modal would silently reintroduce exactly the coupling `flow-gu1.8`'s proposal explicitly scoped out ("agent-authored/scriptable handlers (flow-gu1.10)... out of scope"). Keeping the prompt inside the write-back `Hook` itself, not the port, keeps it opt-in per-hook.

**`HookContext` gains a new top-level field, `activeFilePath: string | null`, populated by `synthesizeHookContext` from `nextState.activeFilePath` — not folded into `instance.activeItem`.**
`instance.activeItem` is documented (`reducer.ts`) as reserved for `flow-djx`'s real `TaskQueueItem` runtime integration, currently hardcoded `null`. Reusing it for the plain-string `activeFilePath` would conflate two different concepts (a resolved queue item vs. a resolved file path) and would need un-conflating again once `flow-djx` lands. A new sibling field on `HookContext` costs one line in `synthesizeHookContext` and keeps the two concerns separate from the start.

**The write-back `Hook` is built by a factory, `createWriteBackHook(deps): Hook`, constructed once in `main.ts` and resolved by name through a real `HookRegistry`.**
`deps` is a narrower shape than today's `WriteBackDeps`: `logTargetResolverRegistry`, `frontmatterReader`, `writeBackPrompt`, and a `getWriteBackProperty: () => string` accessor closing over live `this.settings.writeBackProperty` — but not `fileMutationPort`. The factory's returned `Hook` only *returns* `FileMutation[]`; it does not apply them. `EngineStore.dispatch`'s existing loop applies whatever the hook returns via the `FileMutationPort` already injected into `EngineStore`. `writeBackPhaseCompletion`'s own `applyMutations` call is dropped — that responsibility moves to `EngineStore`, which is the one place `hook-execution` already centralized it.
`HookRegistry.resolve` in `main.ts` becomes a single-entry lookup: `{ resolve: (name) => name === WRITE_BACK_HOOK_NAME ? writeBackHook : undefined }`. A `WRITE_BACK_HOOK_NAME` constant (branded `HookName`) is exported from wherever the factory lives so `phase-graph.ts` can reference the same value in each phase's `onComplete: { name: WRITE_BACK_HOOK_NAME, params: {} }`.

**`writeBackPhaseCompletion` (the standalone async function) is removed; its logic is absorbed into `createWriteBackHook`.**
Nothing else calls `writeBackPhaseCompletion` once `main.ts`'s `store.subscribe` block is deleted. Keeping both would be two ways to do the same thing — `resolveTargetFilePath` is the only piece of logic reused verbatim (moved alongside the factory, not duplicated).

**All three `POMODORO_PHASE_GRAPH` phases (`focus`, `break`, `long-break`) get `onComplete: { name: WRITE_BACK_HOOK_NAME, params: {} }`, replacing `null`.**
Matches today's actual behavior: `main.ts`'s current subscriber fires `writeBackPhaseCompletion` for *whichever* phase just departed, with no phase-kind check — `break`/`long-break` already resolve to `{ kind: 'skipped' }` today only because no `dailyNote` `LogTargetResolverRegistry` entry is registered, not because they're excluded from firing. Declaring the hook on only `focus` would be a silent behavior narrowing (the existing `frontmatter-write-back-trigger` spec's "triggers on every phase completion, not only focus-kind phases" requirement would no longer hold once a real resolver is eventually registered).

**`deriveHookEvents`/`engineReducer` are untouched.** This change is additive at the `Hook`/`HookContext`/`HookRegistry`/`phase-graph`/`main.ts` layer only; no new `EngineAction`, no change to event-derivation rules.

## Risks / Trade-offs

- [Widening `Hook` to always-`Promise` is a breaking type change] → Accepted: no other in-tree `Hook` implementation exists yet (confirmed — `hookRegistry` has never resolved to anything real), so there is nothing else to migrate. This is the cheapest point in the project's life to make this call.
- [`EngineStore.dispatch`'s hook loop already runs events sequentially and doesn't roll back `EngineState` on failure; making the write-back hook's own body slower (it now blocks on a user decision, potentially indefinitely if the modal sits open) means `dispatch`'s returned promise doesn't settle until the user closes the modal] → Accepted, matches today: `writeBackPhaseCompletion` already blocks on the same modal today, called from an un-awaited `void writeBackPhaseCompletion(...).then(...)` in `main.ts`. Post-migration, `TimerTicker`'s `dispatch` call is likewise never `await`ed (per `hook-execution`'s design, "existing callers that don't await keep working exactly as before") — the timer isn't blocked, only `dispatch`'s own promise resolution is delayed. No behavior change for the user.
- [Declaring the same `HookReference` on all three phases means a future phase-specific write-back variant needs a different mechanism (e.g. `HookReference.params`) to differentiate] → Deferred: no such requirement exists today; `flow-00x` (per-phase opt-in) is the natural place to revisit this if/when it's scoped.
- [Removing `writeBackPhaseCompletion` changes `tests/write-back.test.ts`'s primary entry point] → Expected and scoped into tasks.md; the existing scenarios (submit/cancel/edit/skip variants) get re-expressed against `createWriteBackHook`'s returned `Hook`, invoked with a fake `HookContext`, rather than calling the old function directly.

## Migration Plan

No persisted state, no data migration. Implementation order (detailed in tasks.md): (1) widen `Hook`/`HookContext` and update `EngineStore.dispatch`'s invocation to `await`; (2) build `createWriteBackHook` + `WRITE_BACK_HOOK_NAME`, absorbing `writeBackPhaseCompletion`; (3) declare `onComplete` on all three `POMODORO_PHASE_GRAPH` phases; (4) wire the real `HookRegistry` in `main.ts` and delete the `store.subscribe` write-back block; (5) update/port tests; (6) manual verification in the dev vault (this repo's established pattern per `flow-gu1.8`'s task 6.1 and the `obsidian-verification-bun-vs-node` memory — drive via `bunx playwright test`, not a raw `bun -e`/CDP script) confirming write-back still fires identically for focus-phase completion.

## Open Questions

None outstanding. The one real fork (sync vs. async `Hook`, and where the interactive-confirm step lives) is resolved above with its rejected alternative documented.
