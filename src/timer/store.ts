import { deriveHookEvents, engineReducer, initialEngineState, synthesizeHookContext } from './reducer'
import type { EngineAction } from './reducer'
import type { EngineState } from '../domain/session/engine-state'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import type { Phase } from '../domain/phase/phase'
import type { HookEvent } from '../domain/hook/hook'
import type { HookReference } from '../domain/hook/hook-reference'
import { applyMutations } from '../domain/mutation/apply-mutations'
import type { ApplyMutationsResult } from '../domain/mutation/apply-mutations'
import type { EngineDeps } from './engine-deps'

/** Result of resolving, invoking, and applying one fired hook event's mutations. */
export interface HookEventApplication {
  readonly event: HookEvent
  readonly phase: Phase
  readonly result: ApplyMutationsResult
}

function hookReferenceFor(phase: Phase, event: HookEvent): HookReference | null {
  switch (event) {
    case 'onEnter': return phase.onEnter
    case 'onComplete': return phase.onComplete
    case 'onSkip': return phase.onSkip
    case 'onExit': return phase.onExit
  }
}

/**
 * Holds the current EngineState and routes dispatched actions through the
 * pure reducer. Notifies subscribers after each state transition.
 * Accepts a PhaseGraph via dependency injection — no hardcoded phase semantics.
 *
 * Optionally takes an EngineDeps bag. Supplying both hookRegistry and port
 * makes dispatch resolve and fire onEnter/onComplete/onSkip/onExit hooks
 * after each transition and apply their FileMutations; omitting either
 * makes hook firing a no-op — existing/test construction sites don't need
 * to supply fakes they don't care about. Omitting predicateRegistry treats
 * every 'custom' TransitionCondition as unsatisfied, rather than requiring
 * a fake for graphs that don't use one.
 */
export class EngineStore {
  private state: EngineState
  private graph: PhaseGraph
  private listeners: ((state: EngineState) => void)[] = []
  private readonly deps: EngineDeps

  constructor(graph: PhaseGraph, deps: EngineDeps = {}) {
    this.graph = graph
    this.state = initialEngineState(graph)
    this.deps = deps
  }

  public getState(): EngineState {
    return this.state
  }

  public subscribe(listener: (state: EngineState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  public async dispatch(action: EngineAction): Promise<readonly HookEventApplication[]> {
    const prevState = this.state
    const nextState = engineReducer(prevState, action, this.graph, this.deps)
    if (nextState !== this.state) {
      this.state = nextState
      for (const listener of this.listeners) {
        listener(this.state)
      }
    }

    const { hookRegistry, port } = this.deps
    if (hookRegistry === undefined || port === undefined) {
      return []
    }

    let applications: readonly HookEventApplication[] = []
    for (const { event, phase, endReason } of deriveHookEvents(prevState, nextState, action, this.graph)) {
      const reference = hookReferenceFor(phase, event)
      if (reference === null) {
        continue
      }
      const hook = hookRegistry.resolve(reference.name)
      if (hook === undefined) {
        continue
      }
      const mutations = await hook(synthesizeHookContext(phase, event, endReason, nextState))
      const result = await applyMutations(port, mutations)
      applications = [...applications, { event, phase, result }]
    }
    return applications
  }

  /**
   * Switch to a different phase graph and reset to its initial state.
   * Unconditional and immediate: resets even if a session is currently
   * running or paused, discarding its progress with no warning. This store
   * enforces no guard against that — callers that let a user trigger this
   * (e.g. PomodoroTimerView's Start handler) must confirm with the user
   * first whenever a different routine is already in progress.
   */
  public setGraph(graph: PhaseGraph) {
    this.graph = graph
    this.state = initialEngineState(graph)
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  public getGraph(): PhaseGraph {
    return this.graph
  }
}
