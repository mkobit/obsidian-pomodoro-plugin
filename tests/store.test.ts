import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { EngineStore } from '../src/timer/store'
import { PhaseGraphSchema, PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import { PhaseIdSchema, PhaseSchema } from '../src/domain/phase/phase'
import { POMODORO_PHASE_GRAPH } from '../src/timer/phase-graph'
import { WRITE_BACK_HOOK_NAME } from '../src/timer/write-back'

const phaseDefaults = {
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
} as const

function createCounter() {
  let count = 0
  return {
    increment: () => {
      count += 1
    },
    count: () => count,
  }
}

function buildGraph(id: string, durationSeconds = 10): PhaseGraph {
  return PhaseGraphSchema.parse({
    id,
    name: `Graph ${id}`,
    phases: [
      PhaseSchema.parse({ ...phaseDefaults, id: 'focus', label: 'Focus', kind: 'focus', duration: Temporal.Duration.from({ seconds: durationSeconds }), logTarget: { kind: 'activeItem' } }),
      PhaseSchema.parse({ ...phaseDefaults, id: 'break', label: 'Break', kind: 'break', duration: Temporal.Duration.from({ seconds: 5 }), logTarget: { kind: 'activeItem' } }),
    ],
    transitions: [
      { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
      { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
    ],
  })
}

describe('EngineStore', () => {
  test('constructs with the initial state of the given graph', () => {
    const graph = buildGraph('a')
    const store = new EngineStore(graph)

    expect(store.getGraph()).toBe(graph)
    expect(store.getState().status).toBe('stopped')
    expect(store.getState().phaseGraphId).toBe(PhaseGraphIdSchema.parse('a'))
  })

  test('subscribe is notified after a state-changing dispatch', async () => {
    const store = new EngineStore(buildGraph('a'))
    let seen: readonly string[] = []
    store.subscribe((state) => {
      seen = [...seen, state.status]
    })

    await store.dispatch({ type: 'start' })

    expect(seen).toEqual(['running'])
  })

  test('subscribe is not notified when the reducer returns the same state reference (duration-less phase tick)', async () => {
    const manualGraph = PhaseGraphSchema.parse({
      id: 'manual',
      name: 'Manual graph',
      phases: [PhaseSchema.parse({ ...phaseDefaults, id: 'turn', label: 'Turn', kind: 'focus', duration: null, logTarget: { kind: 'activeItem' } })],
      transitions: [],
    })
    const store = new EngineStore(manualGraph)
    await store.dispatch({ type: 'start' })
    const counter = createCounter()
    store.subscribe(() => counter.increment())

    await store.dispatch({ type: 'tick' })

    expect(counter.count()).toBe(0)
  })

  test('unsubscribe stops further notifications', async () => {
    const store = new EngineStore(buildGraph('a'))
    const counter = createCounter()
    const unsubscribe = store.subscribe(() => counter.increment())

    await store.dispatch({ type: 'start' })
    unsubscribe()
    await store.dispatch({ type: 'pause' })

    expect(counter.count()).toBe(1)
  })

  test('setGraph switches the active graph and resets to its initial state', () => {
    const store = new EngineStore(buildGraph('a'))
    const graphB = buildGraph('b', 42)

    store.setGraph(graphB)

    expect(store.getGraph()).toBe(graphB)
    expect(store.getState().status).toBe('stopped')
    expect(store.getState().phaseGraphId).toBe(PhaseGraphIdSchema.parse('b'))
    expect(store.getState().currentPhaseId).toBe(PhaseIdSchema.parse('focus'))
    expect(store.getState().remaining?.total({ unit: 'seconds' })).toBe(42)
  })

  test('setGraph while running unconditionally resets, discarding in-progress state (documented contract)', async () => {
    const store = new EngineStore(buildGraph('a'))
    await store.dispatch({ type: 'start', filePath: 'task.md' })
    expect(store.getState().status).toBe('running')

    store.setGraph(buildGraph('b'))

    expect(store.getState().status).toBe('stopped')
    expect(store.getState().activeFilePath).toBeNull()
  })

  test('setGraph notifies subscribers', () => {
    const store = new EngineStore(buildGraph('a'))
    const counter = createCounter()
    store.subscribe(() => counter.increment())

    store.setGraph(buildGraph('b'))

    expect(counter.count()).toBe(1)
  })
})

describe('POMODORO_PHASE_GRAPH write-back wiring', () => {
  test('every phase declares onComplete naming the write-back hook', () => {
    for (const phase of POMODORO_PHASE_GRAPH.phases) {
      expect(phase.onComplete).toEqual({ name: WRITE_BACK_HOOK_NAME, params: {} })
    }
  })
})
