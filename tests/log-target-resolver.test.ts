import { test, expect, describe } from 'bun:test'
import { LogTargetResolverNameSchema } from '../src/domain/phase/phase'
import type { LogTargetResolverRegistry } from '../src/domain/log-target/log-target-resolver'

describe('LogTargetResolverRegistry', () => {
  test('resolve returns undefined for an unregistered name', () => {
    const registry: LogTargetResolverRegistry = { resolve: () => undefined }

    expect(registry.resolve(LogTargetResolverNameSchema.parse('dailyNote'))).toBeUndefined()
  })

  test('resolve returns the registered function for a registered name', () => {
    const dailyNoteResolver = (): string | null => 'daily-note.md'
    const registry: LogTargetResolverRegistry = {
      resolve: name => (name === LogTargetResolverNameSchema.parse('dailyNote') ? dailyNoteResolver : undefined),
    }

    expect(registry.resolve(LogTargetResolverNameSchema.parse('dailyNote'))).toBe(dailyNoteResolver)
  })
})
