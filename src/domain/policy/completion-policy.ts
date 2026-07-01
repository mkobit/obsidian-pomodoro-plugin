import { z } from 'zod'
import { PositiveDurationSchema } from '../duration'

/** Name of a custom completion policy resolved via a registry, mirroring HookName. */
export const CompletionPolicyNameSchema = z.string().min(1).brand<'CompletionPolicyName'>()
export type CompletionPolicyName = z.infer<typeof CompletionPolicyNameSchema>

/**
 * Governs what happens when a phase ends. Two-tier like hooks: a small set
 * of built-in, parameterized, zod-validated configs covering the completion
 * modes seen so far (manual clear, queue cycling, future-dating for spaced
 * repetition, no-op for phases with no completion semantics at all — e.g. a
 * standup's per-person timer), plus a 'custom' escape hatch resolved via a
 * registry for anything else.
 */
export const CompletionPolicySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manualClear') }),
  z.object({ kind: z.literal('queueCycle') }),
  z.object({ kind: z.literal('futureDate'), after: PositiveDurationSchema }),
  z.object({ kind: z.literal('noOp') }),
  z.object({ kind: z.literal('custom'), name: CompletionPolicyNameSchema }),
]).readonly()

export type CompletionPolicy = z.infer<typeof CompletionPolicySchema>
