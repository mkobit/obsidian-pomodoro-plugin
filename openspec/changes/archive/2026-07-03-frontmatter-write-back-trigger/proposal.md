## Why

`main.ts#handlePhaseComplete` hardcodes "focus-kind phase completes → increment `settings.writeBackProperty` on the active file" via a direct `app.fileManager.processFrontMatter` call, bypassing the `FileMutation`/`LogEntry`/`ObsidianFileMutationPort` machinery already built and wired into `EngineStore`. `Phase.logTarget` (`'dailyNote' | 'activeItem'`) already exists on every `Phase` but nothing reads it — the actual trigger is a `phase.kind === FOCUS_PHASE_KIND` check, not `logTarget`. This is bd issue flow-gu1.7, blocking flow-8to (Hook migration), flow-gu1.8 (write-back form modal), and flow-731 (pre-ship review).

## What Changes

- **BREAKING**: `PhaseLogTargetSchema` changes from `z.enum(['dailyNote', 'activeItem'])` to a discriminated union: `{ kind: 'activeItem' }` or `{ kind: 'callback', name: LogTargetResolverName }`. All existing `logTarget: 'dailyNote' | 'activeItem'` literals (built-in phase graph, test fixtures) update to the new shape.
- Add a new `LogTargetResolverName` (branded string) and a minimal `LogTargetResolverRegistry` (`name → (phase: Phase) => string | null`) — a plain name-to-function lookup distinct from the existing `HookRegistry`/`HookContext` (that machinery is reserved for flow-8to's later onComplete-Hook migration). The plugin ships **zero** built-in resolvers; the built-in graph's break/long-break phases reference an unregistered `'dailyNote'` name, so break-phase write-back is a no-op until a future change registers a real resolver. No dependency on Obsidian's core Daily Notes plugin or any daily-notes npm library.
- Extract the ad hoc `typeof current === 'number' ? current + 1 : 1` logic into a pure `nextLogEntry(currentValue, property, recordedAt): LogEntry` function.
- Add a new write-back orchestrator that resolves a completed phase's target file (via `logTarget`), reads the file's current frontmatter value, computes the next `LogEntry`, and applies it as a `FileMutation` through the existing `FileMutationPort`.
- Remove `main.ts#handlePhaseComplete` and its `FOCUS_PHASE_KIND` gating entirely. Every phase transition now goes through the orchestrator, which decides internally (via `logTarget` resolution) whether there's anything to write.

## Capabilities

### New Capabilities
- `frontmatter-write-back-trigger`: resolving a completed phase's write-back target via `Phase.logTarget` (built-in `activeItem` or a named, registry-resolved `callback`), computing the next single-field `LogEntry`, and applying it as a `FileMutation` — replacing the previous hardcoded focus-phase-only write-back.

### Modified Capabilities
(none — no existing `openspec/specs/*` capability currently governs `Phase.logTarget` or phase-completion write-back; `file-mutation-apply` and `obsidian-file-mutation-port` are consumed as-is, unchanged.)

## Impact

- `src/domain/phase/phase.ts`: `PhaseLogTargetSchema` shape change (breaking for any external consumer, none exist yet).
- `src/timer/phase-graph.ts`: built-in `POMODORO_PHASE_GRAPH` phase definitions updated to the new `logTarget` shape.
- `src/domain/mutation/log-entry.ts`: new `nextLogEntry` pure function.
- New file for the write-back orchestrator and `LogTargetResolverRegistry`/`FrontmatterReader` types (under `src/timer/` and/or `src/domain/`, finalized in design.md).
- `src/main.ts`: `handlePhaseComplete` deleted; `store.subscribe` wiring simplified.
- `tests/timer.test.ts`, `tests/hook-execution.test.ts`, `tests/domain-v2.test.ts`: fixtures using the old `logTarget` enum values updated.
- No settings changes (`writeBackProperty` stays a single global setting).
- No new dependencies.
