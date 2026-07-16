import { test, expect, describe } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { PhaseSchema } from '../src/domain/phase/phase'
import { PhaseGraphSchema, checkPhaseGraphIntegrity } from '../src/domain/phase/phase-graph'
import type { PhaseGraph } from '../src/domain/phase/phase-graph'

const phaseDefaults = {
  label: 'Phase',
  kind: 'focus',
  duration: Temporal.Duration.from({ seconds: 10 }),
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  logTarget: { kind: 'activeItem' },
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
}

function phase(id: string) {
  return PhaseSchema.parse({ ...phaseDefaults, id })
}

function graph(phases: unknown[], transitions: unknown[]): PhaseGraph {
  return PhaseGraphSchema.parse({ id: 'test', name: 'Test graph', phases, transitions })
}

describe('checkPhaseGraphIntegrity', () => {
  test('a well-formed two-phase cycle has no issues', () => {
    const g = graph(
      [phase('focus'), phase('break')],
      [
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
        { fromPhaseId: 'break', toPhaseId: 'focus', condition: { kind: 'always' } },
      ],
    )
    expect(checkPhaseGraphIntegrity(g)).toEqual([])
  })

  test('flags a duplicated phase id', () => {
    const g = graph(
      [phase('focus'), phase('focus')],
      [{ fromPhaseId: 'focus', toPhaseId: 'focus', condition: { kind: 'always' } }],
    )
    const issues = checkPhaseGraphIntegrity(g)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toBe('Phase id "focus" is declared more than once.')
  })

  test('flags a transition whose fromPhaseId does not exist', () => {
    const g = graph(
      [phase('focus')],
      [{ fromPhaseId: 'ghost', toPhaseId: 'focus', condition: { kind: 'always' } }],
    )
    const issues = checkPhaseGraphIntegrity(g)
    expect(issues.some(issue => issue.message.includes('"ghost"'))).toBe(true)
  })

  test('flags a transition whose toPhaseId does not exist', () => {
    const g = graph(
      [phase('focus')],
      [{ fromPhaseId: 'focus', toPhaseId: 'ghost', condition: { kind: 'always' } }],
    )
    const issues = checkPhaseGraphIntegrity(g)
    expect(issues.some(issue => issue.message.includes('"ghost"'))).toBe(true)
  })

  test('flags a reachable phase with zero outgoing transitions', () => {
    const g = graph(
      [phase('focus'), phase('dead-end')],
      [{ fromPhaseId: 'focus', toPhaseId: 'dead-end', condition: { kind: 'always' } }],
    )
    const issues = checkPhaseGraphIntegrity(g)
    expect(issues.some(issue => issue.message.includes('"dead-end"') && issue.message.includes('no outgoing transitions'))).toBe(true)
  })

  test('does not flag an unreachable phase with zero outgoing transitions', () => {
    const g = graph(
      [phase('focus'), phase('orphan')],
      [{ fromPhaseId: 'focus', toPhaseId: 'focus', condition: { kind: 'always' } }],
    )
    const issues = checkPhaseGraphIntegrity(g)
    expect(issues.some(issue => issue.message.includes('"orphan"'))).toBe(false)
  })

  test('flags a reachable phase whose outgoing transitions are all conditional', () => {
    const g = graph(
      [phase('focus'), phase('skip-to')],
      [{ fromPhaseId: 'focus', toPhaseId: 'skip-to', condition: { kind: 'custom', predicate: 'isRestDay' } }],
    )
    const issues = checkPhaseGraphIntegrity(g)
    expect(issues.some(issue => issue.message.includes('"focus"') && issue.message.includes('all conditional'))).toBe(true)
  })

  test('does not flag a phase with a conditional transition plus an unconditional fallback', () => {
    const g = graph(
      [phase('focus'), phase('long-break'), phase('break')],
      [
        { fromPhaseId: 'focus', toPhaseId: 'long-break', condition: { kind: 'everyNth', n: 4 } },
        { fromPhaseId: 'focus', toPhaseId: 'break', condition: { kind: 'always' } },
      ],
    )
    const issues = checkPhaseGraphIntegrity(g)
    expect(issues.some(issue => issue.message.includes('"focus"'))).toBe(false)
  })
})
