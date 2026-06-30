import { mock, test, expect, describe } from 'bun:test'

void mock.module('obsidian', () => {
  return {
    PluginSettingTab: class {},
    Setting: class {},
    App: class {},
    Plugin: class {},
    TFile: class {},
  }
})

import { timerReducer, initialState } from '../src/timer/reducer'
import type { TimerState, TimerAction } from '../src/timer/reducer'
import type { Workflow } from '../src/timer/workflow'

const testWorkflow: Workflow = {
  id: 'test',
  name: 'Test workflow',
  phases: [
    { id: 'focus', label: 'Focus', durationSeconds: 1500 },
    { id: 'break', label: 'Short break', durationSeconds: 300 },
    { id: 'long-break', label: 'Long break', durationSeconds: 900 },
  ],
}

describe('timerReducer', () => {
  test('initialState builds stopped state at phase 0', () => {
    const state = initialState(testWorkflow)
    expect(state.status).toBe('stopped')
    expect(state.workflowId).toBe('test')
    expect(state.currentPhaseIndex).toBe(0)
    expect(state.remainingSeconds).toBe(1500)
    expect(state.activeFilePath).toBeNull()
  })

  test('start transitions to running and records file path', () => {
    const state = initialState(testWorkflow)
    const next = timerReducer(state, { type: 'start', filePath: 'task.md' }, testWorkflow)
    expect(next.status).toBe('running')
    expect(next.activeFilePath).toBe('task.md')
  })

  test('pause transitions running to paused', () => {
    const state: TimerState = { ...initialState(testWorkflow), status: 'running' }
    const next = timerReducer(state, { type: 'pause' }, testWorkflow)
    expect(next.status).toBe('paused')
  })

  test('resume transitions paused to running', () => {
    const state: TimerState = { ...initialState(testWorkflow), status: 'paused' }
    const next = timerReducer(state, { type: 'resume' }, testWorkflow)
    expect(next.status).toBe('running')
  })

  test('stop resets to initial state at phase 0', () => {
    const running: TimerState = {
      status: 'running',
      workflowId: 'test',
      currentPhaseIndex: 1,
      remainingSeconds: 42,
      activeFilePath: 'task.md',
    }
    const next = timerReducer(running, { type: 'stop' }, testWorkflow)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseIndex).toBe(0)
    expect(next.remainingSeconds).toBe(1500)
    expect(next.activeFilePath).toBeNull()
  })

  test('tick decrements remaining seconds', () => {
    const state: TimerState = { ...initialState(testWorkflow), status: 'running', remainingSeconds: 10 }
    const next = timerReducer(state, { type: 'tick' }, testWorkflow)
    expect(next.remainingSeconds).toBe(9)
    expect(next.status).toBe('running')
  })

  test('tick at 0 advances to next phase and stops', () => {
    const state: TimerState = { ...initialState(testWorkflow), status: 'running', remainingSeconds: 0 }
    const next = timerReducer(state, { type: 'tick' }, testWorkflow)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseIndex).toBe(1)
    expect(next.remainingSeconds).toBe(300)
  })

  test('advance-phase cycles through all phases and wraps back to 0', () => {
    const action: TimerAction = { type: 'advance-phase' }
    const s0: TimerState = { ...initialState(testWorkflow), status: 'running' }
    const s1 = timerReducer(s0, action, testWorkflow)
    expect(s1.currentPhaseIndex).toBe(1)
    expect(s1.remainingSeconds).toBe(300)

    const s2 = timerReducer(s1, action, testWorkflow)
    expect(s2.currentPhaseIndex).toBe(2)
    expect(s2.remainingSeconds).toBe(900)

    // Wraps back to phase 0
    const s3 = timerReducer(s2, action, testWorkflow)
    expect(s3.currentPhaseIndex).toBe(0)
    expect(s3.remainingSeconds).toBe(1500)
  })
})
