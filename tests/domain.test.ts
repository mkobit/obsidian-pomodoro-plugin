import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PositiveDurationSchema, NonNegativeDurationSchema } from '../src/domain/duration'
import { LogEntrySchema } from '../src/domain/mutation/log-entry'

describe('PositiveDurationSchema', () => {
  test('accepts a positive duration', () => {
    const result = PositiveDurationSchema.safeParse(Temporal.Duration.from({ seconds: 1 }))
    expect(result.success).toBe(true)
  })

  test('rejects a zero duration', () => {
    const result = PositiveDurationSchema.safeParse(Temporal.Duration.from({ seconds: 0 }))
    expect(result.success).toBe(false)
  })
})

describe('NonNegativeDurationSchema', () => {
  test('accepts a zero duration', () => {
    const result = NonNegativeDurationSchema.safeParse(Temporal.Duration.from({ seconds: 0 }))
    expect(result.success).toBe(true)
  })

  test('rejects a negative duration', () => {
    const result = NonNegativeDurationSchema.safeParse(Temporal.Duration.from({ seconds: -1 }))
    expect(result.success).toBe(false)
  })
})

describe('LogEntrySchema', () => {
  test('parses a valid entry', () => {
    const entry = LogEntrySchema.parse({
      property: 'pomodoros',
      value: 1,
      recordedAt: Temporal.Now.instant(),
    })
    expect(entry.property).toBe('pomodoros')
    expect(entry.value).toBe(1)
  })

  test('rejects an empty property name', () => {
    const result = LogEntrySchema.safeParse({
      property: '',
      value: 1,
      recordedAt: Temporal.Now.instant(),
    })
    expect(result.success).toBe(false)
  })
})
