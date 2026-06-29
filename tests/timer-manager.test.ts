import { expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { TimerManager } from '../src/timer-manager';
import { DEFAULT_SETTINGS } from '../src/settings';

let manager: TimerManager;

beforeEach(() => {
  manager = new TimerManager(DEFAULT_SETTINGS);
});

afterEach(() => {
  manager.stop();
});

test('initial state is stopped and idle', () => {
  const state = manager.getState();
  expect(state.status).toBe('stopped');
  expect(state.currentPhaseIndex).toBe(0);
  expect(state.remainingSeconds).toBe(1500);
  expect(state.activeFilePath).toBeNull();
});

test('starting timer transitions to running', () => {
  manager.start('task-1.md');
  const state = manager.getState();
  expect(state.status).toBe('running');
  expect(state.activeFilePath).toBe('task-1.md');
});

test('pausing timer transitions to paused', () => {
  manager.start('task-1.md');
  manager.pause();
  const state = manager.getState();
  expect(state.status).toBe('paused');
});

test('ticking decrements remaining seconds', () => {
  manager.start('task-1.md');
  manager.tick();
  const state = manager.getState();
  expect(state.remainingSeconds).toBe(1499);
});
