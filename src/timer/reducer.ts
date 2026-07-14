import { Temporal } from 'temporal-polyfill'
import type { EngineState } from '../domain/session/engine-state'
import type { Phase, PhaseId } from '../domain/phase/phase'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import type { HookContext, HookEvent } from '../domain/hook/hook'
import type { PredicateRegistry } from '../domain/hook/predicate'
import { PhaseInstanceIdSchema, SessionIdSchema } from '../domain/session/session'
import type { PhaseInstance, PhaseInstanceEndReason, Session } from '../domain/session/session'
import { findPhaseById, resolveNextPhaseId } from './phase-graph'

export type EngineAction
  = | { type: 'start', filePath?: string }
    | { type: 'pause' }
    | { type: 'resume' }
    | { type: 'stop' }
    | { type: 'tick' }
    | { type: 'finish-phase' }
    | { type: 'advance-phase' }
    | { type: 'set-active-file', filePath: string | null }

/**
 * Build the initial stopped state for a given phase graph, at its first
 * declared phase (the graph's array order is the entry-point convention,
 * same as v1 Workflow).
 */
export function initialEngineState(graph: PhaseGraph): EngineState {
  const startPhase = requirePhaseById(graph, graph.phases[0]?.id)
  return {
    status: 'stopped',
    phaseGraphId: graph.id,
    currentPhaseId: startPhase.id,
    remaining: startPhase.duration,
    activeFilePath: null,
    phaseVisitCounts: {},
  }
}

/**
 * Pure reducer for the timer engine. Receives the active PhaseGraph so phase
 * durations, transitions, and progression are fully configurable.
 */
export function engineReducer(
  state: EngineState,
  action: EngineAction,
  graph: PhaseGraph,
  predicateRegistry?: PredicateRegistry,
): EngineState {
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
      return initialEngineState(graph)
    case 'tick':
      if (state.remaining === null) {
        // Duration-less (manual/until-dismissed) phase: nothing to count down.
        return state
      }
      return state.remaining.sign > 0
        ? { ...state, remaining: state.remaining.subtract({ seconds: 1 }) }
        : completePhase(state, graph, predicateRegistry)
    case 'finish-phase':
      return completePhase(state, graph, predicateRegistry)
    case 'advance-phase':
      return advancePhase(state, graph, predicateRegistry)
    case 'set-active-file':
      return action.filePath === state.activeFilePath
        ? state
        : { ...state, activeFilePath: action.filePath }
  }
}

/** One lifecycle hook event observed for a specific phase during a single dispatch. */
export interface HookEventOccurrence {
  readonly event: HookEvent
  readonly phase: Phase
}

/**
 * Derives which onEnter/onComplete/onSkip/onExit events fired for a single
 * dispatch, by observing the pre- and post-reduce EngineState plus the
 * action that produced the transition — engineReducer itself stays
 * hook-unaware. Doesn't duplicate reducer logic, just interprets its output;
 * see design.md for the full derivation-rules table and rationale.
 */
export function deriveHookEvents(
  prevState: EngineState,
  nextState: EngineState,
  action: EngineAction,
  graph: PhaseGraph,
): readonly HookEventOccurrence[] {
  const prevPhase = requirePhaseById(graph, prevState.currentPhaseId)

  // finish-phase reaches completePhase the same way a zero-remaining tick does, so it derives identically.
  if (action.type === 'tick' || action.type === 'finish-phase') {
    if (nextState.status === 'completed' && prevState.status !== 'completed') {
      return [{ event: 'onComplete', phase: prevPhase }]
    }
    if (prevState.currentPhaseId !== nextState.currentPhaseId) {
      const nextPhase = requirePhaseById(graph, nextState.currentPhaseId)
      return [
        { event: 'onComplete', phase: prevPhase },
        { event: 'onExit', phase: prevPhase },
        { event: 'onEnter', phase: nextPhase },
      ]
    }
    return []
  }

  if (action.type === 'advance-phase') {
    const nextPhase = requirePhaseById(graph, nextState.currentPhaseId)
    const abandoned = prevState.status === 'running' || prevState.status === 'paused'
    return [
      ...(abandoned ? [{ event: 'onSkip', phase: prevPhase } as const] : []),
      { event: 'onExit', phase: prevPhase },
      { event: 'onEnter', phase: nextPhase },
    ]
  }

  return []
}

/**
 * Builds a throwaway HookContext for a single hook invocation. EngineState
 * doesn't track PhaseInstance/Session history yet (flow-c08 will design real
 * tracking) — every field below is either read from EngineState or a
 * best-effort/permissive placeholder, documented per-field, and discarded
 * once the hook returns.
 */
export function synthesizeHookContext(
  phase: Phase,
  event: HookEvent,
  nextState: EngineState,
): HookContext {
  const now = Temporal.Now.instant()
  const plannedDuration = phase.duration
  const actualDuration = event === 'onEnter'
    ? Temporal.Duration.from({ seconds: 0 })
    : plannedDuration === null
      ? Temporal.Duration.from({ seconds: 0 })
      // Best-effort "how much of the plan elapsed", not a wall-clock measurement — superseded once flow-c08 tracks real elapsed time.
      : plannedDuration.subtract(nextState.remaining ?? plannedDuration)
  const endReason: PhaseInstanceEndReason | null = event === 'onComplete'
    ? 'completed'
    : event === 'onSkip'
      ? 'skipped'
      : null

  const instance: PhaseInstance = {
    // Fresh id per hook call, not stable across a phase's lifetime — superseded once flow-c08 tracks real PhaseInstance identity.
    id: PhaseInstanceIdSchema.parse(crypto.randomUUID()),
    phaseId: phase.id,
    plannedDuration,
    actualDuration,
    // "Now" at hook-fire time, not the phase's real start — EngineState doesn't track one.
    startedAt: now,
    endedAt: event === 'onEnter' ? null : now,
    endReason,
    // TaskSource/TaskQueueItem now resolve for real (base-query-task-source), but the reducer doesn't
    // populate activeItem/itemsTouched from them yet — deferred to flow-c08's history-tracking work.
    activeItem: null,
    itemsTouched: [],
    // This call's own mutations are its return value, not known yet while its context is being built.
    mutationsApplied: [],
  }

  const session: Session = {
    // Fresh id per hook call, not a real session identity — superseded once flow-c08 lands.
    id: SessionIdSchema.parse(crypto.randomUUID()),
    phaseGraphId: nextState.phaseGraphId,
    // Not the session's real start time — EngineState doesn't track when the session began.
    startedAt: now,
    endedAt: event === 'onEnter' ? null : now,
    // No accumulated history — this session object is not a real traversal record.
    history: [],
  }

  return { phase, instance, session, activeFilePath: nextState.activeFilePath }
}

/**
 * Natural (tick-driven) completion of the current phase — branches on its
 * completionPolicy. Unlike advancePhase (an explicit override dispatched via
 * the 'advance-phase' action, which always advances regardless of policy),
 * this is only reached when a phase's duration actually elapses.
 */
function completePhase(state: EngineState, graph: PhaseGraph, predicateRegistry: PredicateRegistry | undefined): EngineState {
  const phase = requirePhaseById(graph, state.currentPhaseId)
  const policy = phase.completionPolicy
  if (policy === null || policy.kind === 'noOp') {
    return advancePhase(state, graph, predicateRegistry)
  }
  if (policy.kind === 'manualClear') {
    return { ...state, status: 'completed' }
  }
  throw new Error(
    `Phase "${phase.id}" has completionPolicy "${policy.kind}", which the engine doesn't execute yet.`,
  )
}

/**
 * Advance out of the current phase, resolving the next phase via the
 * graph's transitions. The timer stops when a phase completes — the UI or
 * host decides whether to auto-start the next one.
 */
function advancePhase(state: EngineState, graph: PhaseGraph, predicateRegistry: PredicateRegistry | undefined): EngineState {
  const updatedCounts = {
    ...state.phaseVisitCounts,
    [state.currentPhaseId]: (state.phaseVisitCounts[state.currentPhaseId] ?? 0) + 1,
  }
  const nextPhaseId = resolveNextPhaseId(graph, state.currentPhaseId, updatedCounts, predicateRegistry)
  const nextPhase = requirePhaseById(graph, nextPhaseId)
  return {
    ...state,
    status: 'stopped',
    currentPhaseId: nextPhaseId,
    remaining: nextPhase.duration,
    phaseVisitCounts: updatedCounts,
  }
}

function requirePhaseById(graph: PhaseGraph, id: PhaseId | undefined) {
  if (id === undefined) {
    throw new Error(`PhaseGraph "${graph.id}" has no phases`)
  }
  const phase = findPhaseById(graph, id)
  if (phase === undefined) {
    throw new Error(`PhaseGraph "${graph.id}" has no phase "${id}"`)
  }
  return phase
}
