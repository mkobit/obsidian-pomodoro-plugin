import { z } from 'zod'
import type { Temporal } from 'temporal-polyfill'
import type { PhaseId } from '../phase/phase'
import type { PhaseGraphId } from '../phase/phase-graph'

/**
 * Whether the engine's ticker is running, paused, or stopped. `'completed'` is
 * distinct from `'stopped'` — a `manualClear`-policy phase that reaches zero
 * remaining sits here, at the same phase, until an explicit `advance-phase`
 * moves on; `'stopped'` means reset to the graph's first phase.
 */
export const EngineStatusSchema = z.enum(['running', 'paused', 'stopped', 'completed'])
export type EngineStatus = z.infer<typeof EngineStatusSchema>

/**
 * Runtime engine state for a live traversal of a PhaseGraph — the
 * PhaseGraph-based replacement for src/timer/reducer.ts's TimerState.
 *
 * `phaseVisitCounts` backs TransitionCondition's 'everyNth' case (e.g. a long
 * break every 4th cycle) — it's derived at runtime by counting phase exits,
 * not part of the static PhaseGraph config.
 *
 * Deliberately does NOT embed a `Session`/`PhaseInstance` history yet — that
 * bookkeeping (itemsTouched, mutationsApplied, endReason) only means
 * something once Hook/CompletionPolicy execution and a FileMutation-apply
 * mechanism exist, which are follow-up work, not this pass.
 */
export interface EngineState {
  readonly status: EngineStatus
  /** ID of the active PhaseGraph (for serialization/rehydration). */
  readonly phaseGraphId: PhaseGraphId
  readonly currentPhaseId: PhaseId
  /** Time remaining in the current phase, or null for a duration-less (manual/until-dismissed) phase. */
  readonly remaining: Temporal.Duration | null
  /** The file path of the active task, if any. */
  readonly activeFilePath: string | null
  readonly phaseVisitCounts: Readonly<Record<PhaseId, number>>
}
