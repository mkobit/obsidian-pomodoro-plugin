import { z } from 'zod'
import { TaskQueueItemIdSchema, TaskQueueItemCycleStatusSchema } from '../queue/task-source'

/**
 * A hook's description of a vault write it wants applied, rather than the
 * hook mutating the vault directly — keeps hooks pure(ish) and testable, and
 * gives the engine a single choke point for applying/logging/undoing writes.
 *
 * Deliberately a closed union rather than a registry (see flow-gu1.15):
 * new variants (e.g. a createNote/linkTo-style mutation for "promote item to
 * a new note") get added here directly as they're needed.
 */
export const FileMutationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('frontmatter'),
    filePath: z.string().min(1),
    property: z.string().min(1),
    value: z.union([z.number(), z.string(), z.boolean()]),
  }),
  z.object({
    kind: z.literal('append'),
    filePath: z.string().min(1),
    text: z.string().min(1),
  }),
  z.object({
    kind: z.literal('queueReorder'),
    itemId: TaskQueueItemIdSchema,
    position: z.enum(['front', 'back']),
  }),
  z.object({
    kind: z.literal('queueStatusChange'),
    itemId: TaskQueueItemIdSchema,
    status: TaskQueueItemCycleStatusSchema,
  }),
]).readonly()

export type FileMutation = z.infer<typeof FileMutationSchema>
