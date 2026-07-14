import { test, expect, describe } from 'bun:test'
import { TaskSourceIdSchema } from '../src/domain/queue/task-source'
import type { TaskSource } from '../src/domain/queue/task-source'
import { createTaskSourceRegistry } from '../src/timer/task-source-registry'

const fakeSource = (queue: ReturnType<TaskSource['getQueue']> = []): TaskSource => ({ getQueue: () => queue })

describe('MutableTaskSourceRegistry', () => {
  test('resolving an unregistered id returns undefined', () => {
    const registry = createTaskSourceRegistry()

    expect(registry.resolve(TaskSourceIdSchema.parse('missing'))).toBeUndefined()
  })

  test('resolving a registered id returns its TaskSource', () => {
    const registry = createTaskSourceRegistry()
    const id = TaskSourceIdSchema.parse('focus-queue')
    const source = fakeSource()

    registry.register(id, source)

    expect(registry.resolve(id)).toBe(source)
  })

  test('re-registering the same id overwrites the previous TaskSource', () => {
    const registry = createTaskSourceRegistry()
    const id = TaskSourceIdSchema.parse('focus-queue')
    const first = fakeSource()
    const second = fakeSource()

    registry.register(id, first)
    registry.register(id, second)

    expect(registry.resolve(id)).toBe(second)
  })

  test('unregistering an id makes it resolve to undefined again', () => {
    const registry = createTaskSourceRegistry()
    const id = TaskSourceIdSchema.parse('focus-queue')

    registry.register(id, fakeSource())
    registry.unregister(id)

    expect(registry.resolve(id)).toBeUndefined()
  })
})
