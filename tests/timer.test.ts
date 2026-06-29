import { expect, test } from 'bun:test';
import { timerReducer, type TimerState, type TimerAction } from '../src/timer/reducer';
import { DEFAULT_SETTINGS } from '../src/settings';

test('reducer start transitions status to running', () => {
  const initial: TimerState = {
    status: 'stopped',
    workflowId: 'default',
    currentPhaseIndex: 0,
    remainingSeconds: 1500,
    activeFilePath: null,
  };
  const action: TimerAction = { type: 'start', filePath: 'task.md' };
  const next = timerReducer(initial, action, DEFAULT_SETTINGS);
  
  expect(next.status).toBe('running');
  expect(next.activeFilePath).toBe('task.md');
});

test('reducer tick decrements remaining seconds', () => {
  const initial: TimerState = {
    status: 'running',
    workflowId: 'default',
    currentPhaseIndex: 0,
    remainingSeconds: 10,
    activeFilePath: 'task.md',
  };
  const action: TimerAction = { type: 'tick' };
  const next = timerReducer(initial, action, DEFAULT_SETTINGS);

  expect(next.remainingSeconds).toBe(9);
});
