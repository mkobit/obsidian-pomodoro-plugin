## Context

`FileMutationPort` (src/domain/mutation/apply-mutations.ts) is a 4-method interface; only a `bun:test` fake (tests/apply-mutations.test.ts, tests/hook-execution.test.ts) implements it today. `EngineStore` (src/timer/store.ts) already accepts an optional `hookRegistry`/`port` pair and calls `applyMutations(port, mutations)` after firing hooks, but `main.ts` constructs it with neither.

Constraint that shapes this design: the `obsidian` npm package is **types-only** (`package.json` has `"main": ""`, no runtime JS). Values like `TFile`/`Plugin` can be imported and used at runtime only inside the real Obsidian app (which injects its own module at load time via esbuild's `external`). `main.ts` already relies on this (`import { TFile } from 'obsidian'`, used for `instanceof`), which is fine for app code but means nothing that does `instanceof TFile` can be unit-tested under `bun:test` — there's no such test today, and none of `src/main.ts`/`src/views/**` are unit-tested currently. This change's port implementation needs to be unit-testable, so it must avoid depending on any runtime value from `obsidian`.

## Goals / Non-Goals

**Goals:**
- A `FileMutationPort` implementation that performs real vault writes for `frontmatter` and `append` mutations.
- Unit-testable with plain fakes, no real Obsidian runtime or `instanceof` checks against Obsidian classes.
- Wire it (plus a hook registry) into `main.ts`'s `EngineStore` construction.

**Non-Goals:**
- Resolving `queueReorder`/`queueStatusChange` mutations to real vault files (blocked on the TaskSource/queue runtime, flow-gu1.9).
- Migrating `handlePhaseComplete`'s increment write-back onto the hook/port path (blocked on flow-gu1.7/flow-gu1.8 scope + `HookContext` lacking an active-file-path field — see proposal.md).
- Any change to `applyMutations`, `FileMutationPort`'s method signatures, or `FileMutation`'s schema.

## Decisions

**File resolution via `Vault.getFileByPath`, not `getAbstractFileByPath` + `instanceof TFile`.**
`Vault.getFileByPath(path): TFile | null` (available since Obsidian 1.5.7; manifest's `minAppVersion` is 1.10.0) returns `TFile | null` directly, with no folder case to rule out. This sidesteps the `instanceof TFile` problem above entirely — the port never imports `TFile` as a value, only as a type (erased at compile time), so a `bun:test` fake vault just returns a plain object or `null` from `getFileByPath`. Alternative considered: `getAbstractFileByPath` + `instanceof TFile` (what `main.ts`'s existing `handlePhaseComplete` uses) — rejected because it requires the real `TFile` class at runtime, which doesn't exist outside the Obsidian app.

**Narrow structural dependency type, not the full `App`, and not Obsidian's real `TFile`.**
The port's constructor takes a small local interface (`ObsidianFileMutationPortDeps`) rather than `App`. `App` pulls in workspace/keymap/metadataCache/etc., none of which this port touches. The first cut of this type used `{ vault: Pick<Vault, 'getFileByPath' | 'append'>, fileManager: Pick<FileManager, 'processFrontMatter'> }` — reusing Obsidian's real method signatures via `Pick`. That still returns/accepts the real `TFile` (a recursive class: `TFile.vault: Vault`), so faking one for a test needs a value that's typed as `TFile` — and eslint-plugin-obsidianmd's `no-tfile-tfolder-cast` rule (correctly) rejects `as TFile`/`as unknown as TFile` to get there.

The actual shape: a local `VaultFile` interface with just `{ readonly path: string }` (the only field this port reads), and `ObsidianFileMutationPortDeps`'s `getFileByPath`/`append`/`processFrontMatter` are declared against `VaultFile`, not `TFile`. Test fakes become plain `{ path }` object literals — no cast anywhere. This only works because those three members are declared with **method-shorthand syntax** (`getFileByPath(path: string): VaultFile | null`, not `getFileByPath: (path: string) => VaultFile | null`): method-shorthand parameters are checked bivariantly, so Obsidian's real `Vault`/`FileManager` (whose methods take the much wider `TFile`) still structurally satisfy this narrower interface at the `main.ts` call site, with zero cast in either direction. Property/arrow-style signatures don't get this leniency (contravariant checking rejects the real `Vault`/`FileManager` there), which is also why `eslint.config.mts`'s `src/timer/**` override now turns off `functional/prefer-property-signatures` — that rule otherwise forces the (incompatible-here) arrow-style form.

**A class, not a factory function.**
`ObsidianFileMutationPort` (a class implementing `FileMutationPort`) was the first cut's rejected alternative, then became necessary: `writeFrontmatter` mutates `processFrontMatter`'s callback parameter (`frontmatter[property] = value`) — Obsidian's API has no non-mutating shape for this — which trips `functional/immutable-data` for a plain factory function. `eslint.config.mts`'s `src/timer/**` override sets `ignoreClasses: true` on that rule specifically so class-bodied Obsidian-API code (see `EngineStore`) can do this; a factory function returning an object literal doesn't get that exemption. Confirmed empirically: the identical mutation inside a class lints clean, inside a factory it doesn't.

**Uniform error handling: throw/reject with a plain `Error`.**
Both "path doesn't resolve to a file" and "queue mutation kind not yet supported" cases throw a plain `Error` with a descriptive message (including the offending path or a pointer to flow-gu1.9 for the queue cases). `applyMutations`'s failure result already carries the raw `cause: unknown`, so no custom error class is needed — `functional/no-throw-statements`/`no-promise-reject` are off for `src/timer/**`, matching how `main.ts` already throws/uses Obsidian APIs that reject.

**`reorderQueueItem`/`changeQueueItemStatus` always throw, unconditionally.**
No attempt to inspect `itemId` or partially resolve it. Both methods throw immediately regardless of input — this is dead-simple and correct today because nothing produces these mutations yet (no phase has a hook wired, no TaskSource runtime exists). Revisit only when flow-gu1.9 lands.

**`main.ts` wiring: inline no-op `HookRegistry`, no new file.**
`{ resolve: () => undefined }` satisfies `HookRegistry` and is passed inline at the `new EngineStore(...)` call site. No phase in `POMODORO_PHASE_GRAPH` sets any hook reference, so there is nothing to resolve — a dedicated registry module would be speculative until a real hook exists to register.

## Risks / Trade-offs

- **[Risk]** `getFileByPath` requires Obsidian ≥1.5.7; if `minAppVersion` were ever lowered below that, this call would need to fall back to `getAbstractFileByPath` + `instanceof TFile`. → **Mitigation**: `manifest.json`'s `minAppVersion` (1.10.0) already exceeds this by a wide margin (the plugin depends on the Bases API, itself 1.10+), so this is not a near-term concern.
- **[Risk]** `reorderQueueItem`/`changeQueueItemStatus` throwing unconditionally means any future hook author who wires a queue-mutation-producing hook before flow-gu1.9 lands will get a runtime failure surfaced through `applyMutations`'s `{ success: false }` path, not a compile-time signal. → **Mitigation**: acceptable for now since nothing produces these mutations; the error message will point at flow-gu1.9 to make the cause obvious in logs/tests.

## Open Questions

None — scope was narrowed with the user before writing this design (see proposal.md's "Out of scope" section).
