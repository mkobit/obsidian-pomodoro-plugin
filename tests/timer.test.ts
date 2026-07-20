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
import { PredicateNameSchema } from '../src/domain/hook/predicate'
import type { PredicateRegistry } from '../src/domain/hook/predicate'

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
    PhaseSchema.parse({ ...phaseDefaults, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 1500 }), logTarget: { kind: 'activeItem' } }),
    PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 300 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
    PhaseSchema.parse({ ...phaseDefaults, id: 'long-break', label: 'Long break', kind: 'break', duration: Temporal.Duration.from({ seconds: 900 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
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

  test('set-active-file updates activeFilePath without touching status', () => {
    const state: EngineState = { ...initialEngineState(testGraph), status: 'running', activeFilePath: 'task.md' }
    const next = engineReducer(state, { type: 'set-active-file', filePath: 'other.md' }, testGraph)
    expect(next.activeFilePath).toBe('other.md')
    expect(next.status).toBe('running')
  })

  test('set-active-file is a no-op when the file path is unchanged', () => {
    const state: EngineState = { ...initialEngineState(testGraph), activeFilePath: 'task.md' }
    const next = engineReducer(state, { type: 'set-active-file', filePath: 'task.md' }, testGraph)
    expect(next).toBe(state)
  })

  test('set-active-file can clear activeFilePath back to null', () => {
    const state: EngineState = { ...initialEngineState(testGraph), activeFilePath: 'task.md' }
    const next = engineReducer(state, { type: 'set-active-file', filePath: null }, testGraph)
    expect(next.activeFilePath).toBeNull()
  })

  test('set-queue-exhausted updates queueExhausted without touching status', () => {
    const state: EngineState = { ...initialEngineState(testGraph), status: 'running' }
    const next = engineReducer(state, { type: 'set-queue-exhausted', exhausted: true }, testGraph)
    expect(next.queueExhausted).toBe(true)
    expect(next.status).toBe('running')
  })

  test('set-queue-exhausted is a no-op when the value is unchanged', () => {
    const state: EngineState = initialEngineState(testGraph)
    const next = engineReducer(state, { type: 'set-queue-exhausted', exhausted: false }, testGraph)
    expect(next).toBe(state)
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
      queueExhausted: false,
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

  test('tick at 0 halts at status "completed" for a manualClear phase, without advancing', () => {
    const manualClearGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'manual-clear',
      name: 'Manual clear graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy: { kind: 'manualClear' }, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 5 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const state: EngineState = {
      ...initialEngineState(manualClearGraph),
      status: 'running',
      remaining: Temporal.Duration.from({ seconds: 0 }),
    }
    const next = engineReducer(state, { type: 'tick' }, manualClearGraph)
    expect(next.status).toBe('completed')
    expect(next.currentPhaseId).toBe(focusId)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(0)
  })

  test('advance-phase clears a completed manualClear phase, same as from running', () => {
    const manualClearGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'manual-clear',
      name: 'Manual clear graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy: { kind: 'manualClear' }, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 5 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const state: EngineState = {
      ...initialEngineState(manualClearGraph),
      status: 'completed',
      remaining: Temporal.Duration.from({ seconds: 0 }),
    }
    const next = engineReducer(state, { type: 'advance-phase' }, manualClearGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(breakId)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(5)
  })

  test('tick at 0 advances a noOp-policy phase identically to a null-policy phase', () => {
    const noOpGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'test',
      name: 'Test graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy: { kind: 'noOp' }, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 1500 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 300 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const state: EngineState = {
      ...initialEngineState(noOpGraph),
      status: 'running',
      remaining: Temporal.Duration.from({ seconds: 0 }),
    }
    const next = engineReducer(state, { type: 'tick' }, noOpGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(breakId)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(300)
  })

  test.each([
    ['queueCycle', { kind: 'queueCycle' } as const],
    ['futureDate', { kind: 'futureDate', after: Temporal.Duration.from({ days: 1 }) } as const],
  ])('tick at 0 throws for the not-yet-implemented %s completion policy', (_name, completionPolicy) => {
    const unimplementedGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'test',
      name: 'Test graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: 1500 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 300 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const state: EngineState = {
      ...initialEngineState(unimplementedGraph),
      status: 'running',
      remaining: Temporal.Duration.from({ seconds: 0 }),
    }
    expect(() => engineReducer(state, { type: 'tick' }, unimplementedGraph)).toThrow(
      `Phase "focus" has completionPolicy "${completionPolicy.kind}", which the engine doesn't execute yet.`,
    )
  })

  test('finish-phase halts at status "completed" for a manualClear phase, without advancing', () => {
    const manualClearGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'manual-clear',
      name: 'Manual clear graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy: { kind: 'manualClear' }, id: 'focus', label: 'Focus', kind: 'focus', duration: null, logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 5 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const state: EngineState = { ...initialEngineState(manualClearGraph), status: 'running' }
    const next = engineReducer(state, { type: 'finish-phase' }, manualClearGraph)
    expect(next.status).toBe('completed')
    expect(next.currentPhaseId).toBe(focusId)
    expect(next.remaining).toBeNull()
  })

  test('finish-phase advances a null-policy duration-less phase to the next phase', () => {
    const state: EngineState = {
      ...initialEngineState(testGraph),
      status: 'running',
      remaining: null,
    }
    const next = engineReducer(state, { type: 'finish-phase' }, testGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(breakId)
    expect(next.remaining?.total({ unit: 'seconds' })).toBe(300)
  })

  test('finish-phase completes a phase even when remaining is non-null, not gated on duration-less state', () => {
    const state: EngineState = {
      ...initialEngineState(testGraph),
      status: 'running',
      remaining: Temporal.Duration.from({ seconds: 42 }),
    }
    const next = engineReducer(state, { type: 'finish-phase' }, testGraph)
    expect(next.status).toBe('stopped')
    expect(next.currentPhaseId).toBe(breakId)
  })

  test.each([
    ['queueCycle', { kind: 'queueCycle' } as const],
    ['futureDate', { kind: 'futureDate', after: Temporal.Duration.from({ days: 1 }) } as const],
  ])('finish-phase throws for the not-yet-implemented %s completion policy', (_name, completionPolicy) => {
    const unimplementedGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'test',
      name: 'Test graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, completionPolicy, id: 'focus', label: 'Focus', kind: 'focus', duration: null, logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Short break', kind: 'break', duration: Temporal.Duration.from({ seconds: 300 }), logTarget: { kind: 'callback', name: 'dailyNote' } }),
      ],
      transitions: [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    })
    const state: EngineState = { ...initialEngineState(unimplementedGraph), status: 'running' }
    expect(() => engineReducer(state, { type: 'finish-phase' }, unimplementedGraph)).toThrow(
      `Phase "focus" has completionPolicy "${completionPolicy.kind}", which the engine doesn't execute yet.`,
    )
  })

  test('advance-phase throws when no transition is eligible from the current phase', () => {
    const terminalGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'terminal',
      name: 'Terminal graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, id: 'only', label: 'Only', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
      ],
      transitions: [],
    })
    const state: EngineState = { ...initialEngineState(terminalGraph), status: 'running' }
    expect(() => engineReducer(state, { type: 'advance-phase' }, terminalGraph)).toThrow(
      'PhaseGraph "terminal" has no eligible transition from phase "only"',
    )
  })

  describe('custom TransitionCondition resolution', () => {
    const isRestDayName = PredicateNameSchema.parse('isRestDay')
    const skipToId = PhaseIdSchema.parse('skip-to')
    const normalNextId = PhaseIdSchema.parse('normal-next')

    const customConditionGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'custom-condition',
      name: 'Custom condition graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, id: 'weights', label: 'Weights', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'skip-to', label: 'Skip to', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'normal-next', label: 'Normal next', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
      ],
      transitions: [
        { fromPhaseId: 'weights', toPhaseId: 'skip-to', condition: { kind: 'custom', predicate: isRestDayName } },
        { fromPhaseId: 'weights', toPhaseId: 'normal-next', condition: { kind: 'always' } },
      ],
    })

    function registryResolvingTo(result: boolean): PredicateRegistry {
      return { resolve: name => (name === isRestDayName ? () => result : undefined) }
    }

    test('a resolvable predicate returning true satisfies the transition', () => {
      const state: EngineState = { ...initialEngineState(customConditionGraph), status: 'running' }
      const next = engineReducer(state, { type: 'advance-phase' }, customConditionGraph, { predicateRegistry: registryResolvingTo(true) })
      expect(next.currentPhaseId).toBe(skipToId)
    })

    test('a resolvable predicate returning false falls through to the next candidate', () => {
      const state: EngineState = { ...initialEngineState(customConditionGraph), status: 'running' }
      const next = engineReducer(state, { type: 'advance-phase' }, customConditionGraph, { predicateRegistry: registryResolvingTo(false) })
      expect(next.currentPhaseId).toBe(normalNextId)
    })

    test('an unresolved predicate name falls through without throwing', () => {
      const emptyRegistry: PredicateRegistry = { resolve: () => undefined }
      const state: EngineState = { ...initialEngineState(customConditionGraph), status: 'running' }
      const next = engineReducer(state, { type: 'advance-phase' }, customConditionGraph, { predicateRegistry: emptyRegistry })
      expect(next.currentPhaseId).toBe(normalNextId)
    })

    test('omitting PredicateRegistry entirely treats every custom condition as unsatisfied', () => {
      const state: EngineState = { ...initialEngineState(customConditionGraph), status: 'running' }
      const next = engineReducer(state, { type: 'advance-phase' }, customConditionGraph)
      expect(next.currentPhaseId).toBe(normalNextId)
    })

    test('every candidate unsatisfied still throws the existing "no eligible transition" error', () => {
      const onlyCustomGraph: PhaseGraph = PhaseGraphSchema.parse({
        id: 'only-custom',
        name: 'Only custom graph',
        phases: [
          PhaseSchema.parse({ ...phaseDefaults, id: 'weights', label: 'Weights', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
          PhaseSchema.parse({ ...phaseDefaults, id: 'skip-to', label: 'Skip to', kind: 'focus', duration: Temporal.Duration.from({ seconds: 10 }), logTarget: { kind: 'activeItem' } }),
        ],
        transitions: [
          { fromPhaseId: 'weights', toPhaseId: 'skip-to', condition: { kind: 'custom', predicate: isRestDayName } },
        ],
      })
      const state: EngineState = { ...initialEngineState(onlyCustomGraph), status: 'running' }
      expect(() => engineReducer(state, { type: 'advance-phase' }, onlyCustomGraph, { predicateRegistry: registryResolvingTo(false) })).toThrow(
        'PhaseGraph "only-custom" has no eligible transition from phase "weights"',
      )
    })
  })

  describe('queueExhausted TransitionCondition resolution', () => {
    const doneId = PhaseIdSchema.parse('done')
    const setId = PhaseIdSchema.parse('set')

    const queueExhaustedGraph: PhaseGraph = PhaseGraphSchema.parse({
      id: 'queue-exhausted',
      name: 'Queue exhausted graph',
      phases: [
        PhaseSchema.parse({ ...phaseDefaults, id: 'set', label: 'Set', kind: 'set', duration: null, logTarget: { kind: 'activeItem' } }),
        PhaseSchema.parse({ ...phaseDefaults, id: 'done', label: 'Done', kind: 'done', duration: null, logTarget: { kind: 'activeItem' } }),
      ],
      transitions: [
        { fromPhaseId: 'set', toPhaseId: 'done', condition: { kind: 'queueExhausted' } },
        { fromPhaseId: 'set', toPhaseId: 'set', condition: { kind: 'always' } },
      ],
    })

    test('state.queueExhausted true satisfies the queueExhausted transition', () => {
      const state: EngineState = { ...initialEngineState(queueExhaustedGraph), status: 'running', queueExhausted: true }
      const next = engineReducer(state, { type: 'advance-phase' }, queueExhaustedGraph)
      expect(next.currentPhaseId).toBe(doneId)
    })

    test('state.queueExhausted false falls through to the next candidate', () => {
      const state: EngineState = { ...initialEngineState(queueExhaustedGraph), status: 'running', queueExhausted: false }
      const next = engineReducer(state, { type: 'advance-phase' }, queueExhaustedGraph)
      expect(next.currentPhaseId).toBe(setId)
    })

    test('queueExhausted defaults to false from initialEngineState, so a fresh graph loops rather than skipping to done', () => {
      const state: EngineState = { ...initialEngineState(queueExhaustedGraph), status: 'running' }
      const next = engineReducer(state, { type: 'advance-phase' }, queueExhaustedGraph)
      expect(next.currentPhaseId).toBe(setId)
    })
  })
})
