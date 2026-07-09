import { z } from 'zod'
import { PositiveDurationSchema } from '../duration'

/**
 * Governs what happens when a phase ends: a small set of built-in,
 * parameterized, zod-validated configs covering the completion modes seen so
 * far (manual clear, queue cycling, future-dating for spaced repetition,
 * no-op for phases with no completion semantics at all — e.g. a standup's
 * per-person timer). A phase needing arbitrary completion-time FileMutations
 * declares an `onComplete` HookReference instead of a policy here — that
 * covers the same shape (context => FileMutation[]) without a second,
 * parallel resolution mechanism.
 */
export const CompletionPolicySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manualClear') }),
  z.object({ kind: z.literal('queueCycle') }),
  z.object({ kind: z.literal('futureDate'), after: PositiveDurationSchema }),
  z.object({ kind: z.literal('noOp') }),
]).readonly()

export type CompletionPolicy = z.infer<typeof CompletionPolicySchema>
