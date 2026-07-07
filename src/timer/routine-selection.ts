import type { PhaseGraph, PhaseGraphId } from '../domain/phase/phase-graph'
import type { EngineStatus } from '../domain/session/engine-state'
import { parseRoutineFile } from '../domain/routine/routine-file'
import type { RoutineParseError } from '../domain/routine/routine-file'

/**
 * A view's resolved routine, across the states between "nothing configured"
 * and "file read and parsed". `default` and `loading` are view/async-layer
 * concerns `parseRoutineFile` itself doesn't know about.
 */
export type RoutineResolution
  = | { readonly kind: 'default', readonly graph: PhaseGraph }
    | { readonly kind: 'loading' }
    | { readonly kind: 'loaded', readonly graph: PhaseGraph }
    | { readonly kind: 'error', readonly error: RoutineParseError }

/** Parses an already-read routine file's content into a loaded routine or an inline-renderable error. */
export function resolveRoutineGraph(fileContent: string): RoutineResolution {
  const result = parseRoutineFile(fileContent)
  return result.success ? { kind: 'loaded', graph: result.graph } : { kind: 'error', error: result.error }
}

/**
 * Whether clicking Start should load+start immediately, or confirm first.
 * "Session in progress" is any status other than 'stopped' (the fresh state
 * setGraph itself produces) — a paused or completed session still holds
 * meaningful progress a silent switch would discard, not just a literal
 * EngineStatus 'running' check (see design.md's Risks section).
 */
export function decideStartAction(
  active: { readonly graphId: PhaseGraphId, readonly status: EngineStatus },
  requestedGraphId: PhaseGraphId,
): 'start' | 'confirm' {
  const sessionInProgress = active.status !== 'stopped'
  const sameRoutine = active.graphId === requestedGraphId
  return sessionInProgress && !sameRoutine ? 'confirm' : 'start'
}
