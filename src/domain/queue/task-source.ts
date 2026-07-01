import { z } from 'zod'
import type { Temporal } from 'temporal-polyfill'

/** Identifier for a configured TaskSource, referenced from Phase.taskSourceId. */
export const TaskSourceIdSchema = z.string().min(1).brand<'TaskSourceId'>()
export type TaskSourceId = z.infer<typeof TaskSourceIdSchema>

/**
 * Where a TaskSource's items come from. Open-ended by design — a live Bases
 * query is the common case, but several use cases (workout reps, a fixed
 * exercise sequence) have no Bases involvement at all.
 */
export type TaskSourceKind = 'baseQuery' | 'staticList' | 'fixedSequence'

/** Identifier for a task queue item, independent of where it was sourced from. */
export const TaskQueueItemIdSchema = z.string().min(1).brand<'TaskQueueItemId'>()
export type TaskQueueItemId = z.infer<typeof TaskQueueItemIdSchema>

/**
 * Where an item sits in its cycle. 'deferred' (distinct from 'skipped')
 * covers the spaced-repetition case: the item isn't done, but shouldn't come
 * up again until some future date written to its frontmatter.
 */
export const TaskQueueItemCycleStatusSchema = z.enum(['pending', 'active', 'done', 'skipped', 'deferred'])
export type TaskQueueItemCycleStatus = z.infer<typeof TaskQueueItemCycleStatusSchema>

/**
 * A task pulled from a TaskSource, projected into the shape the engine needs.
 * Queue reordering (e.g. "cycle to back") is a mutation on a persisted
 * priority field, not a reorder of the live query itself — a live Base query
 * can't be reordered in place.
 */
export interface TaskQueueItem {
  readonly id: TaskQueueItemId
  readonly sourcePath: string
  readonly displayName: string
  readonly cycleStatus: TaskQueueItemCycleStatus
  readonly timeSpent: Temporal.Duration
  readonly lastCycledAt: Temporal.Instant | null
}

/** Identity/kind data for a configured TaskSource, kept separate from the behavioral TaskSource interface below. */
export interface TaskSourceConfig {
  readonly id: TaskSourceId
  readonly kind: TaskSourceKind
}

/**
 * Extension point: abstraction over where a phase's items come from.
 * Optional per-Phase, not core to Phase — several use cases (stretch
 * routine, standup) have no queue at all. A real Bases-backed implementation
 * is deferred to flow-gu1.9.
 */
export interface TaskSource {
  readonly getQueue: () => readonly TaskQueueItem[]
}
