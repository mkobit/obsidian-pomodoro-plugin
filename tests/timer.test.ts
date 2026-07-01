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

import { Temporal } from 'temporal-polyfill'
import { engineReducer, initialEngineState } from '../src/timer/reducer'
import type { EngineAction } from '../src/timer/reducer'
import type { EngineState } from '../src/domain/session/engine-state'
import { PhaseGraphSchema, PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import { PhaseSchema, PhaseIdSchema } from '../src/domain/phase/phase'
import type { PhaseId } from '../src/domain/phase/phase'

const focusId = PhaseIdSchema.parse('focus')
const breakId = PhaseIdSchema.parse('break')
const longBreakId = PhaseIdSchema.parse('long-break')
const testGraphId = PhaseGraphIdSchema.parse('test')

const phaseDefaults = {
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
} as const

const testGraph: PhaseGraph = PhaseGraphSchema.parse({
  id: 'test',
  name: 'Test graph',
  phases: [
    PhaseSchema.parse({ ...phaseDefaults, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 1500 }), logTarget: 'activeItem' }),
    PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 300 }), logTarget: 'dailyNote' }),
    PhaseSchema.parse({ ...phaseDefaults, id: 'long-break', label: 'Long break', kind: 'break', duration: Temporal.Duration.from({ seconds: 900 }), logTarget: 'dailyNote' }),
  ],
  transitions: [
    { fromPhaseId: 'focus', toPhaseId: 'long-break', condition: { kind: 'everyNth', n: 4 } },
    { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
    { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
    { fromPhaseId: 'long-break', toPhaseId: 'focus', condition: { kind: 'always' } },
  ],
})

describe('engineReducer', () => {
  test('initialEngineState builds stopped state at the first declared phase', () => {
    const state = initialEngineState(testGraph)
    expect(state.status).toBe('stopped')
    expect(state.phaseGraphId).toBe(testGraphId)
    expect(state.currentPhaseId).toBe(focusId)
    expect(state.remaining?.total({ unit: 'seconds' })).toBe(1500)
    expect(state.activeFilePath).toBeNull()
  })

  test('start transitions to running and records file path', () => {
    const state = initialEngineState(testGraph)
    const next = engineReducer(state, { type: 'start', filePath: 'task.md' }, testGraph)
    expect(next.status).toBe('running')
    expect(next.activeFilePath).toBe('task.md')
  })

  test('pause transitions running to paused', () => {
    const state: EngineState = { ...initialEngineState(testGraph), status: 'running' }
    const next = engineReducer(state, { type: 'pause' }, testGraph)
    expect(next.status).toBe('paused')
  })

  test('resume transitions paused to running', () => {
    const state: EngineState = { ...initialEngineState(testGraph), status: 'paused' }
    const next = engineReducer(state, { type: 'resume' }, testGraph)
    expect(next.status).toBe('running')
  })

  test('stop resets to initial state at the first phase', () => {
    const running: EngineState = {
      status: 'running',
      phaseGraphId: testGraphId,
      currentPhaseId: breakId,
      remaining: Temporal.Duration.from({ seconds: 42 }),
      activeFilePath: 'task.md',
      phaseVisitCounts: { [focusId]: 1 },
    }
    const next = engineReducer(running, { type: 'stop' }, testGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(focusId)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(1500)
    expect(next.activeFilePath).toBeNull()
  })

  test('tick decrements remaining time by one second', () => {
    const state: EngineState = {
      ...initialEngineState(testGraph),
      status: 'running',
      remaining: Temporal.Duration.from({ seconds: 10 }),
    }
    const next = engineReducer(state, { type: 'tick' }, testGraph)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(9)
    expect(next.status).toBe('running')
  })

  test('tick at 0 advances to next phase and stops', () => {
    const state: EngineState = {
      ...initialEngineState(testGraph),
      status: 'running',
      remaining: Temporal.Duration.from({ seconds: 0 }),
    }
    const next = engineReducer(state, { type: 'tick' }, testGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(breakId)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(300)
  })

  test('tick is a no-op for a duration-less phase', () => {
    const state: EngineState = {
      ...initialEngineState(testGraph),
      status: 'running',
      remaining: null,
    }
    const next = engineReducer(state, { type: 'tick' }, testGraph)
    expect(next).toBe(state)
  })

  test('advance-phase cycles focus <-> break, taking the long break on the 4th focus exit', () => {
    const action: EngineAction = { type: 'advance-phase' }
    let state: EngineState = { ...initialEngineState(testGraph), status: 'running' }

    // Exits 1-3 from focus: everyNth(4) not due yet, falls through to 'always' (break)
    const expectedIds: PhaseId[] = [breakId, focusId, breakId, focusId, breakId, focusId]
    for (const expected of expectedIds) {
      state = engineReducer(state, action, testGraph)
      expect(state.currentPhaseId).toBe(expected)
    }

    // 4th exit from focus: everyNth(4) is due, takes the long-break branch instead of 'always'
    state = engineReducer(state, action, testGraph)
    expect(state.currentPhaseId).toBe(longBreakId)
    expect(state.remaining?.total({ unit: 'seconds' })).toBe(900)

    // Exiting long-break falls back to 'always' -> focus
    state = engineReducer(state, action, testGraph)
    expect(state.currentPhaseId).toBe(focusId)
  })

  test('advance-phase throws when no transition is eligible from the current phase', () => {
    const terminalGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'terminal',
      name: 'Terminal graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, id: 'only', label: 'Only', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: 'activeItem' }),
      ],
      transitions: [],
    })
    const state: EngineState = { ...initialEngineState(terminalGraph), status: 'running' }
    expect(() => engineReducer(state, { type: 'advance-phase' }, terminalGraph)).toThrow(
      'PhaseGraph "terminal" has no eligible transition from phase "only"',
    )
  })
})
