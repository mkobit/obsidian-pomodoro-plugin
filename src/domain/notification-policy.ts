import { z } from 'zod'

/**
 * Per-phase notification config, deliberately decoupled from Phase so it's
 * reusable across graphs. Now embedded directly on Phase (see phase/phase.ts),
 * so this needs to be zod-backed like its container.
 */
export const NotificationPolicySchema = z.object({
  sound: z.string().nullable(),
  systemNotification: z.boolean(),
}).readonly()

export type NotificationPolicy = z.infer<typeof NotificationPolicySchema>
