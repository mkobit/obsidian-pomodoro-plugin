import { z } from 'zod'
import { PhaseIdSchema, PhaseSchema } from './phase'
import { HookNameSchema } from '../hook/hook-reference'

/**
 * Identifier for a PhaseGraph. Branded so it can't be mixed up with a PhaseId.
 */
export const PhaseGraphIdSchema = z.string().min(1).brand<'PhaseGraphId'>()
export type PhaseGraphId = z.infer<typeof PhaseGraphIdSchema>

/**
 * When a transition fires. 'everyNth' needs a visit counter, but that
 * counter is runtime state (see session/engine-state.ts's phaseVisitCounts)
 * — not part of this static graph config.
 */
export const TransitionConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('always') }),
  z.object({ kind: z.literal('everyNth'), n: z.number().int().positive() }),
  z.object({ kind: z.literal('custom'), predicate: HookNameSchema }),
]).readonly()

export type TransitionCondition = z.infer<typeof TransitionConditionSchema>

/** An edge in a PhaseGraph: from one phase to another, under some condition. */
export const PhaseTransitionSchema = z.object({
  fromPhaseId: PhaseIdSchema,
  toPhaseId: PhaseIdSchema,
  condition: TransitionConditionSchema,
}).readonly()

export type PhaseTransition = z.infer<typeof PhaseTransitionSchema>

/**
 * A named graph of Phases plus the transitions between them. Supersedes the
 * flat, cyclic Workflow from flow-gu1.12 for routines that need branching
 * (e.g. a long break every 4th cycle, or skipping a phase based on a
 * predicate) — not wired into the currently-shipped reducer in this pass.
 */
export const PhaseGraphSchema = z.object({
  id: PhaseGraphIdSchema,
  name: z.string().min(1),
  phases: z.array(PhaseSchema).min(1),
  transitions: z.array(PhaseTransitionSchema),
}).readonly()

export type PhaseGraph = z.infer<typeof PhaseGraphSchema>
