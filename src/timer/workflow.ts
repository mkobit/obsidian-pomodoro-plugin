import { z } from 'zod'

/**
 * A single phase within a workflow cycle (e.g., focus, short break, long break).
 * Phases are generic — they have no semantic meaning baked in.
 * The Pomodoro technique is one concrete application of a workflow.
 */
export const PhaseSchema = z.object({
  /** Unique identifier for this phase within its workflow. */
  id: z.string().min(1),
  /** Human-readable label shown in the UI. */
  label: z.string().min(1),
  /** Duration of this phase in seconds. */
  durationSeconds: z.number().int().positive(),
})

export type Phase = z.infer<typeof PhaseSchema>

/**
 * A named ordered sequence of phases that cycles after completion.
 * After the last phase completes the cycle restarts at index 0.
 */
export const WorkflowSchema = z.object({
  /** Unique identifier for this workflow. */
  id: z.string().min(1),
  /** Human-readable name shown in the UI. */
  name: z.string().min(1),
  /** Ordered list of phases. Must contain at least one phase. */
  phases: z.array(PhaseSchema).min(1),
})

export type Workflow = z.infer<typeof WorkflowSchema>

/** Built-in Pomodoro workflow (25 min focus → 5 min break, repeating). */
export const POMODORO_WORKFLOW: Workflow = {
  id: 'pomodoro',
  name: 'Pomodoro',
  phases: [
    { id: 'focus', label: 'Focus', durationSeconds: 25 * 60 },
    { id: 'break', label: 'Short break', durationSeconds: 5 * 60 },
  ],
}

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
