import { mock, test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { EngineStore } from '../src/timer/store'
import { PhaseGraphSchema } from '../src/domain/phase/phase-graph'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'
import { PhaseIdSchema, PhaseSchema } from '../src/domain/phase/phase'
import { HookNameSchema, HookReferenceSchema } from '../src/domain/hook/hook-reference'
import type { HookReference } from '../src/domain/hook/hook-reference'
import type { Hook, HookContext, HookRegistry } from '../src/domain/hook/hook'
import { FileMutationSchema } from '../src/domain/mutation/file-mutation'
import type { FileMutation } from '../src/domain/mutation/file-mutation'
import type { FileMutationPort } from '../src/domain/mutation/apply-mutations'

const breakId = PhaseIdSchema.parse('break')

function hookRef(name: string): HookReference {
  return HookReferenceSchema.parse({ name: HookNameSchema.parse(name), params: {} })
}

function createFakeRegistry(hooks: Record<string, Hook>): HookRegistry {
  return {
    resolve: name => hooks[name],
  }
}

function createFakePort(rejections: Partial<Record<keyof FileMutationPort, unknown>> = {}) {
  const make = (name: keyof FileMutationPort) => mock(async (_mutation: FileMutation) => {
    if (name in rejections) {
      throw rejections[name]
    }
  })
  const port: FileMutationPort = {
    writeFrontmatter: make('writeFrontmatter'),
    appendText: make('appendText'),
    reorderQueueItem: make('reorderQueueItem'),
    changeQueueItemStatus: make('changeQueueItemStatus'),
  }
  return port
}

/** Records hook-invocation order without mutating methods, for asserting call sequence. */
function createCallTracker() {
  let calls: readonly string[] = []
  return {
    record: (name: string) => {
      calls = [...calls, name]
    },
    calls: () => calls,
    reset: () => {
      calls = []
    },
  }
}

const appendMutation: FileMutation = FileMutationSchema.parse({
  kind: 'append',
  filePath: 'daily-note.md',
  text: '- fired',
})

interface PhaseHookOverrides {
  readonly onEnter?: HookReference
  readonly onComplete?: HookReference
  readonly onSkip?: HookReference
  readonly onExit?: HookReference
}

/** Builds a two-phase graph (focus <-> break) with per-phase hook overrides. */
function buildGraph(options: {
  readonly focus?: PhaseHookOverrides & {
    readonly completionPolicy?: { kind: 'manualClear' } | { kind: 'noOp' } | null
    readonly durationSeconds?: number
  }
  readonly break?: PhaseHookOverrides
} = {}): PhaseGraph {
  const focus = options.focus ?? {}
  const brk = options.break ?? {}
  return PhaseGraphSchema.parse({
    id: 'test',
    name: 'Test graph',
    phases: [
      PhaseSchema.parse({
        id: 'focus',
        label: 'Focus',
        kind: 'focus',
        duration: Temporal.Duration.from({ seconds: focus.durationSeconds ?? 10 }),
        taskSourceId: null,
        completionPolicy: focus.completionPolicy ?? null,
        notification: null,
        logTarget: { kind: 'activeItem' },
        onEnter: focus.onEnter ?? null,
        onComplete: focus.onComplete ?? null,
        onSkip: focus.onSkip ?? null,
        onExit: focus.onExit ?? null,
      }),
      PhaseSchema.parse({
        id: 'break',
        label: 'Short break',
        kind: 'break',
        duration: Temporal.Duration.from({ seconds: 5 }),
        taskSourceId: null,
        completionPolicy: null,
        notification: null,
        logTarget: { kind: 'callback', name: 'dailyNote' },
        onEnter: brk.onEnter ?? null,
        onComplete: brk.onComplete ?? null,
        onSkip: brk.onSkip ?? null,
        onExit: brk.onExit ?? null,
      }),
    ],
    transitions: [
      { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
      { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
    ],
  })
}

describe('EngineStore hook firing', () => {
  test('advance-phase from stopped fires onExit then onEnter, no onComplete/onSkip', async () => {
    const tracker = createCallTracker()
    const registry = createFakeRegistry({
      exit: () => {
        tracker.record('onExit')
        return []
      },
      enter: () => {
        tracker.record('onEnter')
        return []
      },
    })
    const graph = buildGraph({ focus: { onExit: hookRef('exit') }, break: { onEnter: hookRef('enter') } })
    const store = new EngineStore(graph, registry, createFakePort())

    const applications = await store.dispatch({ type: 'advance-phase' })

    expect(tracker.calls()).toEqual(['onExit', 'onEnter'])
    expect(applications.map(a => a.event)).toEqual(['onExit', 'onEnter'])
  })

  test('manualClear halt fires onComplete only', async () => {
    const tracker = createCallTracker()
    const registry = createFakeRegistry({
      complete: () => {
        tracker.record('onComplete')
        return []
      },
      exit: () => {
        tracker.record('onExit')
        return []
      },
    })
    const graph = buildGraph({
      focus: {
        durationSeconds: 1,
        completionPolicy: { kind: 'manualClear' },
        onComplete: hookRef('complete'),
        onExit: hookRef('exit'),
      },
    })
    const store = new EngineStore(graph, registry, createFakePort())
    await store.dispatch({ type: 'start' })
    await store.dispatch({ type: 'tick' }) // 1s -> 0s, phase still running
    tracker.reset()

    const applications = await store.dispatch({ type: 'tick' }) // 0s -> halts at 'completed'

    expect(tracker.calls()).toEqual(['onComplete'])
    expect(applications.map(a => a.event)).toEqual(['onComplete'])
  })

  test('null-policy auto-advance fires onComplete, then onExit, then onEnter', async () => {
    const tracker = createCallTracker()
    const registry = createFakeRegistry({
      complete: () => {
        tracker.record('onComplete')
        return []
      },
      exit: () => {
        tracker.record('onExit')
        return []
      },
      enter: () => {
        tracker.record('onEnter')
        return []
      },
    })
    const graph = buildGraph({
      focus: { durationSeconds: 1, onComplete: hookRef('complete'), onExit: hookRef('exit') },
      break: { onEnter: hookRef('enter') },
    })
    const store = new EngineStore(graph, registry, createFakePort())
    await store.dispatch({ type: 'start' })
    await store.dispatch({ type: 'tick' }) // 1s -> 0s, phase still running
    tracker.reset()

    const applications = await store.dispatch({ type: 'tick' }) // 0s -> auto-advances to break

    expect(tracker.calls()).toEqual(['onComplete', 'onExit', 'onEnter'])
    expect(applications.map(a => a.event)).toEqual(['onComplete', 'onExit', 'onEnter'])
  })

  test('clearing a completed manualClear phase fires onExit/onEnter only, not onComplete or onSkip', async () => {
    const tracker = createCallTracker()
    const registry = createFakeRegistry({
      complete: () => {
        tracker.record('onComplete')
        return []
      },
      skip: () => {
        tracker.record('onSkip')
        return []
      },
      exit: () => {
        tracker.record('onExit')
        return []
      },
      enter: () => {
        tracker.record('onEnter')
        return []
      },
    })
    const graph = buildGraph({
      focus: {
        durationSeconds: 1,
        completionPolicy: { kind: 'manualClear' },
        onComplete: hookRef('complete'),
        onSkip: hookRef('skip'),
        onExit: hookRef('exit'),
      },
      break: { onEnter: hookRef('enter') },
    })
    const store = new EngineStore(graph, registry, createFakePort())
    await store.dispatch({ type: 'start' })
    await store.dispatch({ type: 'tick' }) // 1s -> 0s
    await store.dispatch({ type: 'tick' }) // 0s -> halts at 'completed'
    tracker.reset()

    const applications = await store.dispatch({ type: 'advance-phase' })

    expect(tracker.calls()).toEqual(['onExit', 'onEnter'])
    expect(applications.map(a => a.event)).toEqual(['onExit', 'onEnter'])
  })

  test.each(['running', 'paused'] as const)(
    'advance-phase from %s fires onSkip, then onExit, then onEnter',
    async (status) => {
      const tracker = createCallTracker()
      const registry = createFakeRegistry({
        skip: () => {
          tracker.record('onSkip')
          return []
        },
        exit: () => {
          tracker.record('onExit')
          return []
        },
        enter: () => {
          tracker.record('onEnter')
          return []
        },
      })
      const graph = buildGraph({
        focus: { onSkip: hookRef('skip'), onExit: hookRef('exit') },
        break: { onEnter: hookRef('enter') },
      })
      const store = new EngineStore(graph, registry, createFakePort())
      await store.dispatch({ type: 'start' })
      if (status === 'paused') {
        await store.dispatch({ type: 'pause' })
      }
      tracker.reset()

      const applications = await store.dispatch({ type: 'advance-phase' })

      expect(tracker.calls()).toEqual(['onSkip', 'onExit', 'onEnter'])
      expect(applications.map(a => a.event)).toEqual(['onSkip', 'onExit', 'onEnter'])
    },
  )

  test('pause fires no hook events', async () => {
    const resolveSpy = mock((_name: string) => undefined)
    const graph = buildGraph({ focus: { onEnter: hookRef('enter'), onExit: hookRef('exit') } })
    const store = new EngineStore(graph, { resolve: resolveSpy }, createFakePort())
    await store.dispatch({ type: 'start' })

    const applications = await store.dispatch({ type: 'pause' })

    expect(applications).toEqual([])
    expect(resolveSpy).not.toHaveBeenCalled()
  })

  test('a tick with remaining time left fires no hook events', async () => {
    const resolveSpy = mock((_name: string) => undefined)
    const graph = buildGraph({ focus: { onEnter: hookRef('enter'), onExit: hookRef('exit') } })
    const store = new EngineStore(graph, { resolve: resolveSpy }, createFakePort())
    await store.dispatch({ type: 'start' })

    const applications = await store.dispatch({ type: 'tick' })

    expect(applications).toEqual([])
    expect(resolveSpy).not.toHaveBeenCalled()
  })

  test('a declared and resolvable hook is invoked exactly once with the firing phase', async () => {
    const hookSpy = mock((_context: HookContext): readonly FileMutation[] => [])
    const registry = createFakeRegistry({ enter: hookSpy })
    const graph = buildGraph({ break: { onEnter: hookRef('enter') } })
    const store = new EngineStore(graph, registry, createFakePort())

    await store.dispatch({ type: 'advance-phase' })

    expect(hookSpy).toHaveBeenCalledTimes(1)
    const context = hookSpy.mock.calls[0]?.[0]
    expect(context?.phase.id).toBe(breakId)
  })

  test('a phase with no hook declared for the firing event calls resolve for nothing', async () => {
    const resolveSpy = mock((_name: string) => undefined)
    const graph = buildGraph()
    const store = new EngineStore(graph, { resolve: resolveSpy }, createFakePort())

    await store.dispatch({ type: 'advance-phase' })

    expect(resolveSpy).not.toHaveBeenCalled()
  })

  test('an unregistered hook name does not throw and does not block a sibling event', async () => {
    const enterSpy = mock((_context: HookContext): readonly FileMutation[] => [])
    const registry = createFakeRegistry({ enter: enterSpy })
    const graph = buildGraph({
      focus: { onExit: hookRef('missing') },
      break: { onEnter: hookRef('enter') },
    })
    const store = new EngineStore(graph, registry, createFakePort())

    const applications = await store.dispatch({ type: 'advance-phase' })

    expect(enterSpy).toHaveBeenCalledTimes(1)
    expect(applications.map(a => a.event)).toEqual(['onEnter'])
  })

  test('a hook\'s returned mutations are applied via the configured FileMutationPort', async () => {
    const registry = createFakeRegistry({ enter: () => [appendMutation] })
    const graph = buildGraph({ break: { onEnter: hookRef('enter') } })
    const port = createFakePort()
    const store = new EngineStore(graph, registry, port)

    await store.dispatch({ type: 'advance-phase' })

    expect(port.appendText).toHaveBeenCalledTimes(1)
    expect(port.appendText).toHaveBeenCalledWith(appendMutation)
  })

  test('a failing onExit mutation does not suppress the paired onEnter hook', async () => {
    const enterSpy = mock((_context: HookContext): readonly FileMutation[] => [])
    const registry = createFakeRegistry({
      exit: () => [appendMutation],
      enter: enterSpy,
    })
    const graph = buildGraph({
      focus: { onExit: hookRef('exit') },
      break: { onEnter: hookRef('enter') },
    })
    const port = createFakePort({ appendText: new Error('vault write failed') })
    const store = new EngineStore(graph, registry, port)

    const applications = await store.dispatch({ type: 'advance-phase' })

    expect(enterSpy).toHaveBeenCalledTimes(1)
    expect(applications).toHaveLength(2)
    expect(applications[0]?.event).toBe('onExit')
    expect(applications[0]?.result.success).toBe(false)
    expect(applications[1]?.event).toBe('onEnter')
    expect(applications[1]?.result.success).toBe(true)
  })

  test('dispatch without a HookRegistry/FileMutationPort transitions state without touching hooks', async () => {
    const graph = buildGraph({ focus: { onExit: hookRef('exit') }, break: { onEnter: hookRef('enter') } })
    const store = new EngineStore(graph)

    const applications = await store.dispatch({ type: 'advance-phase' })

    expect(applications).toEqual([])
    expect(store.getState().currentPhaseId).toBe(breakId)
  })

  test('dispatch resolves with per-event results and does not reject on a hook failure', async () => {
    const registry = createFakeRegistry({
      exit: () => [appendMutation],
      enter: () => [appendMutation],
    })
    const graph = buildGraph({
      focus: { onExit: hookRef('exit') },
      break: { onEnter: hookRef('enter') },
    })
    const port = createFakePort({ appendText: new Error('boom') })
    const store = new EngineStore(graph, registry, port)

    const applications = await store.dispatch({ type: 'advance-phase' })

    expect(applications).toHaveLength(2)
    expect(applications.every(a => a.result.success === false)).toBe(true)
  })
})
