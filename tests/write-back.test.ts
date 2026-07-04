import { mock, test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PhaseSchema } from '../src/domain/phase/phase'
import type { Phase } from '../src/domain/phase/phase'
import { LogTargetResolverNameSchema } from '../src/domain/phase/phase'
import type { LogTargetResolverRegistry, LogTargetResolver } from '../src/domain/log-target/log-target-resolver'
import type { FrontmatterReader } from '../src/domain/mutation/frontmatter-reader'
import type { FileMutation } from '../src/domain/mutation/file-mutation'
import type { FileMutationPort } from '../src/domain/mutation/apply-mutations'
import type { WriteBackFormValues, WriteBackPromptPort, WriteBackPromptResult } from '../src/domain/mutation/write-back-prompt'
import { writeBackPhaseCompletion } from '../src/timer/write-back'
import type { WriteBackDeps } from '../src/timer/write-back'

const phaseDefaults = {
  label: 'Focus',
  duration: Temporal.Duration.from({ minutes: 25 }),
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
} as const

const activeItemPhase: Phase = PhaseSchema.parse({
  ...phaseDefaults,
  id: 'focus',
  kind: 'focus',
  logTarget: { kind: 'activeItem' },
})

const callbackPhase: Phase = PhaseSchema.parse({
  ...phaseDefaults,
  id: 'break',
  kind: 'break',
  label: 'Short break',
  logTarget: { kind: 'callback', name: 'dailyNote' },
})

function createFakePort(): FileMutationPort {
  return {
    writeFrontmatter: mock(async (_mutation: FileMutation) => {}),
    appendText: mock(async (_mutation: FileMutation) => {}),
    reorderQueueItem: mock(async (_mutation: FileMutation) => {}),
    changeQueueItemStatus: mock(async (_mutation: FileMutation) => {}),
  }
}

function createFakeReader(value: unknown): FrontmatterReader {
  return { readValue: mock((_filePath: string, _property: string) => value) }
}

function createFakeRegistry(resolvers: Record<string, LogTargetResolver> = {}): LogTargetResolverRegistry {
  return { resolve: name => resolvers[name] }
}

/** Defaults to auto-submitting whatever defaults it was prompted with, so existing "writes back" scenarios don't need to know about the prompt step. */
function createFakePrompt(resolve: (defaults: WriteBackFormValues) => WriteBackPromptResult = defaults => ({ kind: 'submitted', values: defaults })): WriteBackPromptPort {
  return {
    // eslint-disable-next-line functional/prefer-tacit -- the async wrapper is required so this satisfies WriteBackPromptPort's Promise-returning signature; `resolve` itself is synchronous
    prompt: mock(async (defaults: WriteBackFormValues) => resolve(defaults)),
  }
}

function createDeps(overrides: Partial<WriteBackDeps> = {}): WriteBackDeps {
  return {
    logTargetResolverRegistry: createFakeRegistry(),
    frontmatterReader: createFakeReader(undefined),
    fileMutationPort: createFakePort(),
    writeBackPrompt: createFakePrompt(),
    ...overrides,
  }
}

describe('writeBackPhaseCompletion', () => {
  test('activeItem target with an active file prompts and writes back on submit', async () => {
    const reader = createFakeReader(3)
    const port = createFakePort()
    const prompt = createFakePrompt()
    const deps = createDeps({ frontmatterReader: reader, fileMutationPort: port, writeBackPrompt: prompt })

    const result = await writeBackPhaseCompletion(activeItemPhase, 'task.md', 'pomodoros', deps)

    expect(reader.readValue).toHaveBeenCalledWith('task.md', 'pomodoros')
    expect(prompt.prompt).toHaveBeenCalledWith({ filePath: 'task.md', property: 'pomodoros', value: 4 })
    expect(port.writeFrontmatter).toHaveBeenCalledTimes(1)
    expect(port.writeFrontmatter).toHaveBeenCalledWith({ kind: 'frontmatter', filePath: 'task.md', property: 'pomodoros', value: 4 })
    expect(result).toEqual({ kind: 'applied', result: { success: true } })
  })

  test('activeItem target with no active file is skipped without prompting', async () => {
    const reader = createFakeReader(3)
    const port = createFakePort()
    const prompt = createFakePrompt()
    const deps = createDeps({ frontmatterReader: reader, fileMutationPort: port, writeBackPrompt: prompt })

    const result = await writeBackPhaseCompletion(activeItemPhase, null, 'pomodoros', deps)

    expect(result).toEqual({ kind: 'skipped' })
    expect(reader.readValue).not.toHaveBeenCalled()
    expect(prompt.prompt).not.toHaveBeenCalled()
    expect(port.writeFrontmatter).not.toHaveBeenCalled()
  })

  test('callback target with an unregistered resolver is skipped without prompting', async () => {
    const reader = createFakeReader(3)
    const port = createFakePort()
    const prompt = createFakePrompt()
    const deps = createDeps({ frontmatterReader: reader, fileMutationPort: port, writeBackPrompt: prompt })

    const result = await writeBackPhaseCompletion(callbackPhase, null, 'pomodoros', deps)

    expect(result).toEqual({ kind: 'skipped' })
    expect(reader.readValue).not.toHaveBeenCalled()
    expect(prompt.prompt).not.toHaveBeenCalled()
    expect(port.writeFrontmatter).not.toHaveBeenCalled()
  })

  test('callback target with a registered resolver prompts and writes back on submit', async () => {
    const reader = createFakeReader(undefined)
    const port = createFakePort()
    const prompt = createFakePrompt()
    const resolver: LogTargetResolver = () => 'daily-note.md'
    const deps = createDeps({
      frontmatterReader: reader,
      fileMutationPort: port,
      writeBackPrompt: prompt,
      logTargetResolverRegistry: createFakeRegistry({ [LogTargetResolverNameSchema.parse('dailyNote')]: resolver }),
    })

    const result = await writeBackPhaseCompletion(callbackPhase, null, 'pomodoros', deps)

    expect(reader.readValue).toHaveBeenCalledWith('daily-note.md', 'pomodoros')
    expect(prompt.prompt).toHaveBeenCalledWith({ filePath: 'daily-note.md', property: 'pomodoros', value: 1 })
    expect(port.writeFrontmatter).toHaveBeenCalledWith({ kind: 'frontmatter', filePath: 'daily-note.md', property: 'pomodoros', value: 1 })
    expect(result).toEqual({ kind: 'applied', result: { success: true } })
  })

  test('callback target with a registered resolver that returns null is skipped without prompting', async () => {
    const reader = createFakeReader(3)
    const port = createFakePort()
    const prompt = createFakePrompt()
    const resolver: LogTargetResolver = () => null
    const deps = createDeps({
      frontmatterReader: reader,
      fileMutationPort: port,
      writeBackPrompt: prompt,
      logTargetResolverRegistry: createFakeRegistry({ [LogTargetResolverNameSchema.parse('dailyNote')]: resolver }),
    })

    const result = await writeBackPhaseCompletion(callbackPhase, null, 'pomodoros', deps)

    expect(result).toEqual({ kind: 'skipped' })
    expect(reader.readValue).not.toHaveBeenCalled()
    expect(prompt.prompt).not.toHaveBeenCalled()
    expect(port.writeFrontmatter).not.toHaveBeenCalled()
  })

  test('a non-focus (break-kind) phase with a resolvable target still writes back', async () => {
    const reader = createFakeReader(undefined)
    const port = createFakePort()
    const resolver: LogTargetResolver = () => 'daily-note.md'
    const deps = createDeps({
      frontmatterReader: reader,
      fileMutationPort: port,
      logTargetResolverRegistry: createFakeRegistry({ [LogTargetResolverNameSchema.parse('dailyNote')]: resolver }),
    })

    const result = await writeBackPhaseCompletion(callbackPhase, null, 'pomodoros', deps)

    expect(result.kind).toBe('applied')
    expect(port.writeFrontmatter).toHaveBeenCalledTimes(1)
  })

  test('a failing FileMutationPort write surfaces as an applied-but-failed result', async () => {
    const reader = createFakeReader(3)
    const port: FileMutationPort = {
      writeFrontmatter: mock(async (_mutation: FileMutation) => {
        throw new Error('vault write failed')
      }),
      appendText: mock(async (_mutation: FileMutation) => {}),
      reorderQueueItem: mock(async (_mutation: FileMutation) => {}),
      changeQueueItemStatus: mock(async (_mutation: FileMutation) => {}),
    }
    const deps = createDeps({ frontmatterReader: reader, fileMutationPort: port })

    const result = await writeBackPhaseCompletion(activeItemPhase, 'task.md', 'pomodoros', deps)

    expect(result.kind).toBe('applied')
    expect(result.kind === 'applied' && result.result.success).toBe(false)
  })

  test('cancelling the prompt is skipped and never applies a mutation', async () => {
    const reader = createFakeReader(3)
    const port = createFakePort()
    const prompt = createFakePrompt(() => ({ kind: 'cancelled' }))
    const deps = createDeps({ frontmatterReader: reader, fileMutationPort: port, writeBackPrompt: prompt })

    const result = await writeBackPhaseCompletion(activeItemPhase, 'task.md', 'pomodoros', deps)

    expect(result).toEqual({ kind: 'skipped' })
    expect(port.writeFrontmatter).not.toHaveBeenCalled()
  })

  test('submitting edited values applies the edits, not the original defaults', async () => {
    const reader = createFakeReader(3)
    const port = createFakePort()
    const editedValues: WriteBackFormValues = { filePath: 'other-task.md', property: 'sessions', value: 'edited' }
    const prompt = createFakePrompt(() => ({ kind: 'submitted', values: editedValues }))
    const deps = createDeps({ frontmatterReader: reader, fileMutationPort: port, writeBackPrompt: prompt })

    const result = await writeBackPhaseCompletion(activeItemPhase, 'task.md', 'pomodoros', deps)

    expect(port.writeFrontmatter).toHaveBeenCalledWith({ kind: 'frontmatter', filePath: 'other-task.md', property: 'sessions', value: 'edited' })
    expect(result).toEqual({ kind: 'applied', result: { success: true } })
  })
})
