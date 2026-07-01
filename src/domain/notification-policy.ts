/**
 * Per-phase notification config, deliberately decoupled from Phase so it's
 * reusable across workflows. Stub — nothing constructs or persists this yet.
 */
export interface NotificationPolicy {
  readonly sound: string | null
  readonly systemNotification: boolean
}
