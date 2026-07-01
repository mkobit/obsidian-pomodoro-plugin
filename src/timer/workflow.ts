import { z } from 'zod'
import { Temporal } from 'temporal-polyfill'
import { PositiveDurationSchema } from '../domain/duration'

/**
 * Identifier for a phase within a workflow. Branded so a PhaseId can't be
 * mixed up with a WorkflowId even though both are plain strings underneath.
 * Brand tag is 'WorkflowPhaseId' (not 'PhaseId') so this doesn't collide
 * with domain/phase/phase.ts's unrelated v2 PhaseId — the two aren't meant
 * to be interchangeable even though this module predates that one.
 */
export const PhaseIdSchema = z.string().min(1).brand<'WorkflowPhaseId'>()
export type PhaseId = z.infer<typeof PhaseIdSchema>

/**
 * Semantic category of a phase (e.g. focus, break). Deliberately an open
 * string rather than a fixed enum — a workflow's cycle may define categories
 * beyond focus/break, so this must not force everything into two buckets.
 */
export const PhaseKindSchema = z.string().min(1).brand<'WorkflowPhaseKind'>()
export type PhaseKind = z.infer<typeof PhaseKindSchema>

/** Built-in phase kinds used by the default Pomodoro workflow. */
export const FOCUS_PHASE_KIND = PhaseKindSchema.parse('focus')
export const BREAK_PHASE_KIND = PhaseKindSchema.parse('break')

/**
 * A single phase within a workflow cycle (e.g., focus, short break, long break).
 * Phases are generic — they have no semantic meaning baked in beyond `kind`.
 * The Pomodoro technique is one concrete application of a workflow.
 */
export const PhaseSchema = z.object({
  /** Unique identifier for this phase within its workflow. */
  id: PhaseIdSchema,
  /** Human-readable label shown in the UI. */
  label: z.string().min(1),
  /** Duration of this phase. */
  duration: PositiveDurationSchema,
  /** Semantic category of this phase, e.g. focus or break. */
  kind: PhaseKindSchema,
})

export type Phase = z.infer<typeof PhaseSchema>

/**
 * Identifier for a workflow. Branded so a WorkflowId can't be mixed up with a PhaseId.
 */
export const WorkflowIdSchema = z.string().min(1).brand<'WorkflowId'>()
export type WorkflowId = z.infer<typeof WorkflowIdSchema>

/**
 * Controls how the active task queue item advances when a phase completes.
 * Only 'manual' has a reader today — 'auto' is a real value with no wired behavior yet.
 */
export const TaskAdvanceModeSchema = z.enum(['manual', 'auto'])
export type TaskAdvanceMode = z.infer<typeof TaskAdvanceModeSchema>

/**
 * A named ordered sequence of phases that cycles after completion.
 * After the last phase completes the cycle restarts at index 0.
 */
export const WorkflowSchema = z.object({
  /** Unique identifier for this workflow. */
  id: WorkflowIdSchema,
  /** Human-readable name shown in the UI. */
  name: z.string().min(1),
  /** Ordered list of phases. Must contain at least one phase. */
  phases: z.array(PhaseSchema).min(1),
  /** How the active task queue item advances when a phase completes. */
  taskAdvanceMode: TaskAdvanceModeSchema.default('manual'),
})

export type Workflow = z.infer<typeof WorkflowSchema>

/** Built-in Pomodoro workflow (25 min focus → 5 min break, repeating). */
export const POMODORO_WORKFLOW: Workflow = WorkflowSchema.parse({
  id: 'pomodoro',
  name: 'Pomodoro',
  phases: [
    { id: 'focus', label: 'Focus', duration: Temporal.Duration.from({ minutes: 25 }), kind: FOCUS_PHASE_KIND },
    { id: 'break', label: 'Short break', duration: Temporal.Duration.from({ minutes: 5 }), kind: BREAK_PHASE_KIND },
  ],
})

/**
 * Look up a phase by index within a workflow, cycling back to 0 after the last phase.
 */
export function getPhaseAt(workflow: Workflow, index: number): Phase {
  const phase = workflow.phases[index % workflow.phases.length]
  if (phase === undefined) {
    throw new Error(`Workflow "${workflow.id}" has no phases`)
  }
  return phase
}

/**
 * Return the next phase index, wrapping around to 0 after the last phase.
 */
export function nextPhaseIndex(workflow: Workflow, currentIndex: number): number {
  return (currentIndex + 1) % workflow.phases.length
}
