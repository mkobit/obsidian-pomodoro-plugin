import { mock, test, expect } from 'bun:test'

void mock.module('obsidian', () => {
  return {
    PluginSettingTab: class {},
    Setting: class {},
    App: class {},
    Plugin: class {},
    TFile: class {},
  }
})

import type { TimerState, TimerAction } from '../src/timer/reducer'

test('reducer start transitions status to running', async () => {
  const { timerReducer } = await import('../src/timer/reducer')
  const { DEFAULT_SETTINGS } = await import('../src/settings')

  const initial: TimerState = {
    status: 'stopped',
    workflowId: 'default',
    currentPhaseIndex: 0,
    remainingSeconds: 1500,
    activeFilePath: null,
  }
  const action: TimerAction = { type: 'start', filePath: 'task.md' }
  const next = timerReducer(initial, action, DEFAULT_SETTINGS)

  expect(next.status).toBe('running')
  expect(next.activeFilePath).toBe('task.md')
})

test('reducer tick decrements remaining seconds', async () => {
  const { timerReducer } = await import('../src/timer/reducer')
  const { DEFAULT_SETTINGS } = await import('../src/settings')

  const initial: TimerState = {
    status: 'running',
    workflowId: 'default',
    currentPhaseIndex: 0,
    remainingSeconds: 10,
    activeFilePath: 'task.md',
  }
  const action: TimerAction = { type: 'tick' }
  const next = timerReducer(initial, action, DEFAULT_SETTINGS)

  expect(next.remainingSeconds).toBe(9)
})
