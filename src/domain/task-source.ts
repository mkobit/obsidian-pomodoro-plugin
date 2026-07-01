import { z } from 'zod'

/** Identifier for a task queue item, independent of where it was sourced from. */
export const TaskQueueItemIdSchema = z.string().min(1).brand<'TaskQueueItemId'>()
export type TaskQueueItemId = z.infer<typeof TaskQueueItemIdSchema>

export type TaskQueueItemStatus = 'pending' | 'active' | 'consumed' | 'skipped'

/**
 * A task pulled from wherever the queue is sourced, projected into the shape
 * the timer needs. Deliberately has no knowledge of Bases — a TaskSource
 * implementation is what's specific to a given source.
 */
export interface TaskQueueItem {
  readonly id: TaskQueueItemId
  readonly filePath: string
  readonly displayName: string
  readonly status: TaskQueueItemStatus
}

/**
 * Extension point: abstraction over where the task queue comes from. A Bases
 * query is today's only source, but other sources (a plain folder, a saved
 * search, a different plugin) should be able to implement this without the
 * timer knowing the difference. The Bases-backed implementation is deferred
 * to flow-gu1.9 — today's inline filtering in PomodoroTimerView is the
 * implicit default.
 */
export interface TaskSource {
  readonly getQueue: () => readonly TaskQueueItem[]
}
