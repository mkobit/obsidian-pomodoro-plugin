import type { TimerState, TimerAction } from './reducer';
import { timerReducer } from './reducer';
import type { PomodoroSettings } from '../settings';

export class TimerStore {
  private state: TimerState;
  private settings: PomodoroSettings;
  private listeners: ((state: TimerState) => void)[] = [];

  constructor(settings: PomodoroSettings) {
    this.settings = settings;
    this.state = {
      status: 'stopped',
      workflowId: 'default',
      currentPhaseIndex: 0,
      remainingSeconds: settings.defaultWorkDurationSeconds,
      activeFilePath: null,
    };
  }

  public getState(): TimerState {
    return this.state;
  }

  public subscribe(listener: (state: TimerState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public dispatch(action: TimerAction) {
    const next = timerReducer(this.state, action, this.settings);
    if (next !== this.state) {
      this.state = next;
      for (const listener of this.listeners) {
        listener(this.state);
      }
    }
  }

  public updateSettings(settings: PomodoroSettings) {
    this.settings = settings;
  }
}
