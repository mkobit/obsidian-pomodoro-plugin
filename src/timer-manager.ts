import { z } from 'zod';
import type { PomodoroSettings } from './settings';

export const TimerPhaseSchema = z.enum(['focus', 'break']);
export type TimerPhase = z.infer<typeof TimerPhaseSchema>;

export const TimerStateSchema = z.object({
  status: z.enum(['running', 'paused', 'stopped']),
  workflowId: z.string(),
  currentPhaseIndex: z.number().int().nonnegative(),
  remainingSeconds: z.number().int().nonnegative(),
  activeFilePath: z.string().nullable(),
});
export type TimerState = z.infer<typeof TimerStateSchema>;

export class TimerManager {
  private state: TimerState;
  private settings: PomodoroSettings;
  private intervalId: any = null;
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

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public start(filePath?: string) {
    this.state.status = 'running';
    if (filePath !== undefined) {
      this.state.activeFilePath = filePath;
    }
    this.startTicker();
    this.notify();
  }

  public pause() {
    this.state.status = 'paused';
    this.stopTicker();
    this.notify();
  }

  public resume() {
    this.state.status = 'running';
    this.startTicker();
    this.notify();
  }

  public stop() {
    this.state.status = 'stopped';
    this.state.currentPhaseIndex = 0;
    this.state.remainingSeconds = this.settings.defaultWorkDurationSeconds;
    this.state.activeFilePath = null;
    this.stopTicker();
    this.notify();
  }

  public tick() {
    if (this.state.remainingSeconds > 0) {
      this.state.remainingSeconds -= 1;
    } else {
      this.completePhase();
    }
    this.notify();
  }

  private startTicker() {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  private stopTicker() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private completePhase() {
    this.stopTicker();
    if (this.state.currentPhaseIndex === 0) {
      this.state.currentPhaseIndex = 1;
      this.state.remainingSeconds = this.settings.defaultBreakDurationSeconds;
    } else {
      this.state.currentPhaseIndex = 0;
      this.state.remainingSeconds = this.settings.defaultWorkDurationSeconds;
    }
    this.notify();
  }
}
