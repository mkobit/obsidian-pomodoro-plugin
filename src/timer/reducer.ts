import { z } from 'zod'
import { getPhaseAt, nextPhaseIndex } from './workflow'
import type { Workflow } from './workflow'

/**
 * Represents the current state of the timer state machine.
 * Phases are indexed into the active workflow — no hardcoded phase semantics here.
 */
export const TimerStateSchema = z.object({
  /** Whether the timer is running, paused, or stopped. */
  status: z.enum(['running', 'paused', 'stopped']),
  /** ID of the active workflow (for serialization/rehydration). */
  workflowId: z.string(),
  /** Index into the workflow's phases array. */
  currentPhaseIndex: z.number().int().nonnegative(),
  /** Seconds remaining in the current phase. */
  remainingSeconds: z.number().int().nonnegative(),
  /** The file path of the active task, if any. */
  activeFilePath: z.string().nullable(),
})

export type TimerState = z.infer<typeof TimerStateSchema>

export type TimerAction
  = | { type: 'start', filePath?: string }
    | { type: 'pause' }
    | { type: 'resume' }
    | { type: 'stop' }
    | { type: 'tick' }
    | { type: 'advance-phase' }

/**
 * Build the initial stopped state for a given workflow (at phase 0).
 */
export function initialState(workflow: Workflow): TimerState {
  const phase = getPhaseAt(workflow, 0)
  return {
    status: 'stopped',
    workflowId: workflow.id,
    currentPhaseIndex: 0,
    remainingSeconds: phase.durationSeconds,
    activeFilePath: null,
  }
}

/**
 * Pure reducer for the timer state machine.
 * Receives the active workflow so phase durations and progression are fully configurable.
 */
export function timerReducer(
  state: TimerState,
  action: TimerAction,
  workflow: Workflow,
): TimerState {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        status: 'running',
        activeFilePath: action.filePath !== undefined ? action.filePath : state.activeFilePath,
      }
    case 'pause':
      return { ...state, status: 'paused' }
    case 'resume':
      return { ...state, status: 'running' }
    case 'stop':
      return initialState(workflow)
    case 'tick':
      return state.remainingSeconds > 0
        ? { ...state, remainingSeconds: state.remainingSeconds - 1 }
        : advancePhase(state, workflow)
    case 'advance-phase':
      return advancePhase(state, workflow)
  }
}

/**
 * Advance to the next phase in the workflow cycle.
 * The timer stops when a phase completes — the UI or host decides whether to auto-start.
 */
function advancePhase(state: TimerState, workflow: Workflow): TimerState {
  const nextIndex = nextPhaseIndex(workflow, state.currentPhaseIndex)
  const nextPhase = getPhaseAt(workflow, nextIndex)
  return {
    ...state,
    status: 'stopped',
    currentPhaseIndex: nextIndex,
    remainingSeconds: nextPhase.durationSeconds,
  }
}
