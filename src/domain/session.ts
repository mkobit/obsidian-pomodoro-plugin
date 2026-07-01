import { z } from 'zod'
import type { Temporal } from 'temporal-polyfill'
import type { PhaseId, WorkflowId } from '../timer/workflow'

/** Identifier for a single traversal of a workflow. */
export const SessionIdSchema = z.string().min(1).brand<'SessionId'>()
export type SessionId = z.infer<typeof SessionIdSchema>

/** Identifier for one concrete occurrence of a phase within a session. */
export const PhaseInstanceIdSchema = z.string().min(1).brand<'PhaseInstanceId'>()
export type PhaseInstanceId = z.infer<typeof PhaseInstanceIdSchema>

/** How a phase instance ended. */
export type PhaseInstanceOutcome = 'completed' | 'skipped' | 'extended'

/**
 * A concrete occurrence of a Phase within a Session. Actual duration may
 * differ from the phase's planned duration once extend/skip exist.
 */
export interface PhaseInstance {
  readonly id: PhaseInstanceId
  readonly phaseId: PhaseId
  readonly plannedDuration: Temporal.Duration
  readonly actualDuration: Temporal.Duration
  readonly startedAt: Temporal.Instant
  readonly endedAt: Temporal.Instant | null
  readonly outcome: PhaseInstanceOutcome
}

/** One full traversal of a workflow, from start until the user stops it. */
export interface Session {
  readonly id: SessionId
  readonly workflowId: WorkflowId
  readonly startedAt: Temporal.Instant
  readonly endedAt: Temporal.Instant | null
  readonly activeTaskFilePath: string | null
  readonly phaseHistory: readonly PhaseInstance[]
}
