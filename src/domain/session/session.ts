import { z } from 'zod'
import type { Temporal } from 'temporal-polyfill'
import type { PhaseId } from '../phase/phase'
import type { PhaseGraphId } from '../phase/phase-graph'
import type { TaskQueueItem, TaskQueueItemId } from '../queue/task-source'
import type { FileMutation } from '../mutation/file-mutation'

/** Identifier for a single traversal of a PhaseGraph. */
export const SessionIdSchema = z.string().min(1).brand<'SessionId'>()
export type SessionId = z.infer<typeof SessionIdSchema>

/** Identifier for one concrete occurrence of a phase within a session. */
export const PhaseInstanceIdSchema = z.string().min(1).brand<'PhaseInstanceId'>()
export type PhaseInstanceId = z.infer<typeof PhaseInstanceIdSchema>

/** How a phase instance ended. */
export type PhaseInstanceEndReason = 'completed' | 'skipped' | 'abandoned'

/**
 * A concrete occurrence of a Phase within a Session. `activeItem` stays
 * optional even when the phase completes — a phase with no TaskSource (e.g.
 * a stretch break) still completes and logs, it just has nothing to target
 * besides the phase itself (see Phase.logTarget).
 */
export interface PhaseInstance {
  readonly id: PhaseInstanceId
  readonly phaseId: PhaseId
  readonly plannedDuration: Temporal.Duration | null
  readonly actualDuration: Temporal.Duration
  readonly startedAt: Temporal.Instant
  readonly endedAt: Temporal.Instant | null
  readonly endReason: PhaseInstanceEndReason | null
  readonly activeItem: TaskQueueItem | null
  readonly itemsTouched: readonly TaskQueueItemId[]
  readonly mutationsApplied: readonly FileMutation[]
}

/**
 * One full traversal of a PhaseGraph, from start until the user stops it.
 * Session-level state is derived from `history`, not stored redundantly.
 */
export interface Session {
  readonly id: SessionId
  readonly phaseGraphId: PhaseGraphId
  readonly startedAt: Temporal.Instant
  readonly endedAt: Temporal.Instant | null
  readonly history: readonly PhaseInstance[]
}
