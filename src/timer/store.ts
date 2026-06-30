import { timerReducer, initialState } from './reducer'
import type { TimerState, TimerAction } from './reducer'
import type { Workflow } from './workflow'

/**
 * Holds the current TimerState and routes dispatched actions through the pure reducer.
 * Notifies subscribers after each state transition.
 * Accepts a Workflow via dependency injection — no hardcoded phase semantics.
 */
export class TimerStore {
  private state: TimerState
  private workflow: Workflow
  private listeners: ((state: TimerState) => void)[] = []

  constructor(workflow: Workflow) {
    this.workflow = workflow
    this.state = initialState(workflow)
  }

  public getState(): TimerState {
    return this.state
  }

  public subscribe(listener: (state: TimerState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  public dispatch(action: TimerAction) {
    const next = timerReducer(this.state, action, this.workflow)
    if (next !== this.state) {
      this.state = next
      for (const listener of this.listeners) {
        listener(this.state)
      }
    }
  }

  /**
   * Switch to a different workflow and reset to its initial state.
   * Use when the user selects a different workflow in settings.
   */
  public setWorkflow(workflow: Workflow) {
    this.workflow = workflow
    this.state = initialState(workflow)
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  public getWorkflow(): Workflow {
    return this.workflow
  }
}
