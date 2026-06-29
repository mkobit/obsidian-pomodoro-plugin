import { z } from 'zod';
import type { PomodoroSettings } from '../settings';

export const TimerStateSchema = z.object({
  status: z.enum(['running', 'paused', 'stopped']),
  workflowId: z.string(),
  currentPhaseIndex: z.number().int().nonnegative(),
  remainingSeconds: z.number().int().nonnegative(),
  activeFilePath: z.string().nullable(),
});
export type TimerState = z.infer<typeof TimerStateSchema>;

export type TimerAction =
  | { type: 'start'; filePath?: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  | { type: 'tick' }
  | { type: 'complete-phase' };

export function timerReducer(state: TimerState, action: TimerAction, settings: PomodoroSettings): TimerState {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        status: 'running',
        activeFilePath: action.filePath !== undefined ? action.filePath : state.activeFilePath,
      };
    case 'pause':
      return { ...state, status: 'paused' };
    case 'resume':
      return { ...state, status: 'running' };
    case 'stop':
      return {
        status: 'stopped',
        workflowId: 'default',
        currentPhaseIndex: 0,
        remainingSeconds: settings.defaultWorkDurationSeconds,
        activeFilePath: null,
      };
    case 'tick':
      if (state.remainingSeconds > 0) {
        return { ...state, remainingSeconds: state.remainingSeconds - 1 };
      }
      return completePhase(state, settings);
    case 'complete-phase':
      return completePhase(state, settings);
  }
}

function completePhase(state: TimerState, settings: PomodoroSettings): TimerState {
  if (state.currentPhaseIndex === 0) {
    return {
      ...state,
      status: 'stopped',
      currentPhaseIndex: 1,
      remainingSeconds: settings.defaultBreakDurationSeconds,
    };
  }
  return {
    ...state,
    status: 'stopped',
    currentPhaseIndex: 0,
    remainingSeconds: settings.defaultWorkDurationSeconds,
  };
}
