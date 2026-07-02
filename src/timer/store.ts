import { deriveHookEvents, engineReducer, initialEngineState, synthesizeHookContext } from './reducer'
import type { EngineAction } from './reducer'
import type { EngineState } from '../domain/session/engine-state'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import type { Phase } from '../domain/phase/phase'
import type { HookEvent, HookRegistry } from '../domain/hook/hook'
import type { HookReference } from '../domain/hook/hook-reference'
import { applyMutations } from '../domain/mutation/apply-mutations'
import type { ApplyMutationsResult, FileMutationPort } from '../domain/mutation/apply-mutations'

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
 * Optionally takes a HookRegistry + FileMutationPort: when both are
 * supplied, dispatch resolves and fires onEnter/onComplete/onSkip/onExit
 * hooks after each transition and applies their FileMutations. Omitting
 * either makes hook firing a no-op — existing/test construction sites don't
 * need to supply fakes they don't care about.
 */
export class EngineStore {
  private state: EngineState
  private graph: PhaseGraph
  private listeners: ((state: EngineState) => void)[] = []
  private readonly hookRegistry: HookRegistry | undefined
  private readonly port: FileMutationPort | undefined

  constructor(graph: PhaseGraph, hookRegistry?: HookRegistry, port?: FileMutationPort) {
    this.graph = graph
    this.state = initialEngineState(graph)
    this.hookRegistry = hookRegistry
    this.port = port
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
    const nextState = engineReducer(prevState, action, this.graph)
    if (nextState !== this.state) {
      this.state = nextState
      for (const listener of this.listeners) {
        listener(this.state)
      }
    }

    const { hookRegistry, port } = this
    if (hookRegistry === undefined || port === undefined) {
      return []
    }

    let applications: readonly HookEventApplication[] = []
    for (const { event, phase } of deriveHookEvents(prevState, nextState, action, this.graph)) {
      const reference = hookReferenceFor(phase, event)
      if (reference === null) {
        continue
      }
      const hook = hookRegistry.resolve(reference.name)
      if (hook === undefined) {
        continue
      }
      const mutations = hook(synthesizeHookContext(phase, event, nextState))
      const result = await applyMutations(port, mutations)
      applications = [...applications, { event, phase, result }]
    }
    return applications
  }

  /**
   * Switch to a different phase graph and reset to its initial state.
   * Use when the user selects a different routine in settings.
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
