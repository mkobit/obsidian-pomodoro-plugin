## Context

`main.ts` currently wires a `store.subscribe` callback that special-cases focus-kind phases:

```ts
if (lastState.currentPhaseId !== state.currentPhaseId
    && lastPhase?.kind === FOCUS_PHASE_KIND
    && state.activeFilePath) {
  void this.handlePhaseComplete(state.activeFilePath)
}
```

`handlePhaseComplete` calls `app.fileManager.processFrontMatter` directly, reading and incrementing `settings.writeBackProperty` inline. This predates the `FileMutation`/`FileMutationPort`/`applyMutations` machinery (flow-2yp) and the `LogEntry` domain type (flow-gu1.12), both already built but unused for this purpose. `Phase.logTarget` was added in the same pass as scaffolding for exactly this — `'activeItem'` for focus, `'dailyNote'` for breaks — but nothing resolves it.

An earlier direction considered resolving `'dailyNote'` via Obsidian's core Daily Notes plugin (using the community `obsidian-daily-notes-interface` npm package to read its settings). This was explicitly rejected: the user does not want the plugin to depend on another plugin (core or community) for this, and hasn't yet trialed real usage enough to commit to that behavior. The design below defers `'dailyNote'` resolution entirely rather than guessing at the right mechanism.

## Goals / Non-Goals

**Goals:**
- Replace the `FOCUS_PHASE_KIND` special-case with a general mechanism driven by `Phase.logTarget`, so any phase's completion can define where its write-back goes.
- Route the actual vault write through the existing `FileMutationPort`/`applyMutations`, not a direct Obsidian API call.
- Provide an extension point for non-`activeItem` targets (e.g. a future daily-note target) without building that resolution logic now or taking on a new dependency.
- Keep the single global `writeBackProperty` setting and single-field (`property`/`value`) write-back shape — no per-phase property configuration, no multi-field log records.

**Non-Goals:**
- Implementing a real `'dailyNote'` resolver (or any other named resolver). This change ships the registry and zero implementations.
- Migrating write-back onto the `HookRegistry`/`onComplete` Hook system — that's flow-8to, deliberately sequenced after this change.
- Per-phase-configurable write-back property, or a settings UI change.
- Any Obsidian core-plugin or community-plugin dependency.

## Decisions

### 1. `Phase.logTarget` becomes a discriminated union, not a richer enum

`PhaseLogTargetSchema` changes from `z.enum(['dailyNote', 'activeItem'])` to:
```ts
z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('activeItem') }),
  z.object({ kind: z.literal('callback'), name: LogTargetResolverNameSchema }),
])
```
**Why:** `'activeItem'` needs no parameters (resolved from `EngineState.activeFilePath`), but any other target needs a name to look up in a registry — a flat enum has nowhere to carry that. A discriminated union matches the existing `CompletionPolicy`/`TransitionCondition` pattern in this codebase (built-in variants plus a named `custom`/`callback` escape hatch).
**Alternative considered:** Keep `logTarget` a plain enum and inject a single `resolveLogTargetPath` function directly into the wiring in `main.ts` (no name indirection). Rejected: `Phase` is zod-validated data that may eventually be user/frontmatter-authored (per the `HookName`/`CompletionPolicyName` precedent of "never eval, always resolve by name"); baking a live function reference into `Phase` data closes off that path for no real savings here.

### 2. A dedicated `LogTargetResolverRegistry`, not the existing `HookRegistry`

New types: `LogTargetResolverName` (branded string, mirrors `HookName`) and `LogTargetResolverRegistry = { resolve: (name: LogTargetResolverName) => ((phase: Phase) => string | null) | undefined }`.
**Why:** `HookRegistry`/`HookContext` already exists and could theoretically resolve a "hook" that returns a `FileMutation` targeting wherever it wants — but that's exactly the mechanism flow-8to is scoped to introduce later, deliberately after this change (per bd dependency order: flow-gu1.7 blocks flow-8to). Reusing it now would mean synthesizing a throwaway `HookContext` (with placeholder `PhaseInstance`/`Session` — see `synthesizeHookContext`'s documented placeholders) just to answer "what file path," and would collapse the two changes into one. A resolver is a much narrower question (`Phase → string | null`) than a hook (`HookContext → FileMutation[]`), so it gets its own minimal registry.
**Ships with zero resolvers registered.** `main.ts` passes `{ resolve: () => undefined }`, mirroring the existing no-op `hookRegistry` already in `main.ts`. The built-in graph's break/long-break phases carry `{ kind: 'callback', name: 'dailyNote' }`; since it's unregistered, resolution returns `undefined` and write-back for those phases is a documented no-op.

### 3. Reading the current frontmatter value is a new, separate concern from applying the mutation

`FileMutationPort.writeFrontmatter` takes a final, already-decided `value` — it has no way to express "read current, then increment." The old `handlePhaseComplete` did the read itself inside `processFrontMatter`'s callback. This change introduces a minimal `FrontmatterReader` interface (`readValue(filePath: string, property: string): unknown`), backed by `app.metadataCache.getFileCache(file)?.frontmatter?.[property]`.
**Why not extend `FileMutationPort` with a read method:** its docstring scopes it to "the seam between a domain-produced `FileMutation` intent and an actual vault write" — reading isn't a mutation, and every port method (real and faked) would gain a method most callers don't need.
**Trade-off accepted:** reading via `metadataCache` and writing via `processFrontMatter` (inside the port) are two separate calls, not one atomic read-modify-write like the old code. For a single-user, timer-driven increment this race is negligible in practice; not treated as a correctness requirement here.

### 4. `nextLogEntry` is a pure function, not inlined in the orchestrator

`nextLogEntry(currentValue: unknown, property: string, recordedAt: Temporal.Instant): LogEntry` lives in `src/domain/mutation/log-entry.ts` next to `LogEntrySchema`. It's the direct extraction of the existing `typeof current === 'number' ? current + 1 : 1` logic, unit-testable with zero Obsidian dependencies.

### 5. Orchestration lives in `src/timer/`, main.ts stays thin

A new module (final filename decided during implementation, e.g. `src/timer/write-back.ts`) holds the orchestration: resolve target → read current value → build `LogEntry` → build `FileMutation` → `applyMutations`. This follows the existing convention where `src/timer/**` holds Obsidian-adjacent glue (`obsidian-file-mutation-port.ts`, `ticker.ts`, `store.ts`) while `src/domain/**` stays pure. `main.ts#handlePhaseComplete` and its `FOCUS_PHASE_KIND` check are deleted; the `store.subscribe` callback calls the new orchestrator unconditionally on every `currentPhaseId` change, and the orchestrator's own target resolution decides whether anything happens.
Result shape: `{ kind: 'skipped' } | { kind: 'applied', result: ApplyMutationsResult }`, so tests (and `main.ts`'s error logging) can distinguish "nothing to do" from "tried and failed."

### 6. Failure handling: `console.error`, no `Notice`

A failed write (`kind: 'applied', result: { success: false }`) is logged via `console.error` in `main.ts`. No user-facing `Notice` is added in this change — the user hasn't yet trialed real usage enough to want additional UI surface, and adding a `Notice` here is trivial to layer on later without touching the orchestrator.

## Risks / Trade-offs

- **[Risk]** Read-then-write via `metadataCache` isn't atomic, unlike the old `processFrontMatter`-only approach → **Mitigation:** accepted as negligible for a single-user, low-frequency (per-phase-completion) write; revisit only if evidence of lost writes appears.
- **[Risk]** `'dailyNote'` write-back silently does nothing until a resolver is registered — a user enabling break-phase logging might expect it to work → **Mitigation:** documented in code comments at the registry construction site in `main.ts`; follow-up bead needed before this is user-visible functionality (not filed as part of this change — file if/when the resolver design is ready).
- **[Trade-off]** Read/write split into two Obsidian API calls instead of one — acceptable given goal #2 (route through the existing port) outweighs the minor atomicity loss.

## Open Questions

- None blocking implementation. The `'dailyNote'` resolver's actual mechanism (a settings-configurable path template? a registered callback from vault config? something else) is deferred to a future change once there's a concrete need.
