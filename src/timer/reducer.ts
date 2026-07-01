import type { EngineState } from '../domain/session/engine-state'
import type { PhaseId } from '../domain/phase/phase'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import { findPhaseById, resolveNextPhaseId } from './phase-graph'

export type EngineAction
  = | { type: 'start', filePath?: string }
    | { type: 'pause' }
    | { type: 'resume' }
    | { type: 'stop' }
    | { type: 'tick' }
    | { type: 'advance-phase' }

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
        : advancePhase(state, graph)
    case 'advance-phase':
      return advancePhase(state, graph)
  }
}

/**
 * Advance out of the current phase, resolving the next phase via the
 * graph's transitions. The timer stops when a phase completes — the UI or
 * host decides whether to auto-start the next one.
 */
function advancePhase(state: EngineState, graph: PhaseGraph): EngineState {
  const updatedCounts = {
    ...state.phaseVisitCounts,
    [state.currentPhaseId]: (state.phaseVisitCounts[state.currentPhaseId] ?? 0) + 1,
  }
  const nextPhaseId = resolveNextPhaseId(graph, state.currentPhaseId, updatedCounts)
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
