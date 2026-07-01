import { z } from 'zod'
import { Temporal } from 'temporal-polyfill'

/**
 * A single write-back to a task's frontmatter, e.g. incrementing a pomodoro
 * count. Zod-backed because the property's current value is read back from
 * (untrusted, user-editable) frontmatter before this is constructed.
 */
export const LogEntrySchema = z.object({
  property: z.string().min(1),
  value: z.union([z.number(), z.string(), z.boolean()]),
  recordedAt: z.instanceof(Temporal.Instant),
}).readonly()

export type LogEntry = z.infer<typeof LogEntrySchema>
