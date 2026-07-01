import { engineReducer, initialEngineState } from './reducer'
import type { EngineAction } from './reducer'
import type { EngineState } from '../domain/session/engine-state'
import type { PhaseGraph } from '../domain/phase/phase-graph'

/**
 * Holds the current EngineState and routes dispatched actions through the
 * pure reducer. Notifies subscribers after each state transition.
 * Accepts a PhaseGraph via dependency injection — no hardcoded phase semantics.
 */
export class EngineStore {
  private state: EngineState
  private graph: PhaseGraph
  private listeners: ((state: EngineState) => void)[] = []

  constructor(graph: PhaseGraph) {
    this.graph = graph
    this.state = initialEngineState(graph)
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

  public dispatch(action: EngineAction) {
    const next = engineReducer(this.state, action, this.graph)
    if (next !== this.state) {
      this.state = next
      for (const listener of this.listeners) {
        listener(this.state)
      }
    }
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
