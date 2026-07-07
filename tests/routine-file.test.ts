import { test, expect, describe } from 'bun:test'
import { parseRoutineFile } from '../src/domain/routine/routine-file'
import { PhaseGraphIdSchema } from '../src/domain/phase/phase-graph'

const validPhaseGraph = {
  id: 'standup',
  name: 'Standup routine',
  phases: [
    {
      id: 'turn',
      label: 'Turn',
      kind: 'focus',
      duration: 'PT25M',
      taskSourceId: null,
      completionPolicy: null,
      notification: null,
      logTarget: { kind: 'activeItem' },
      onEnter: null,
      onComplete: null,
      onSkip: null,
      onExit: null,
    },
  ],
  transitions: [],
}

function routineFile(graph: unknown): string {
  return `---\npomodoro-routine: true\n---\n\n# Standup routine\n\n\`\`\`json\n${JSON.stringify(graph, null, 2)}\n\`\`\`\n`
}

describe('parseRoutineFile', () => {
  test('parses a valid single fenced JSON block into a PhaseGraph', () => {
    const result = parseRoutineFile(routineFile(validPhaseGraph))

    expect(result.success).toBe(true)
    expect(result.success && result.graph.id).toBe(PhaseGraphIdSchema.parse('standup'))
    expect(result.success && result.graph.phases[0]?.duration?.total({ unit: 'minutes' })).toBe(25)
  })

  test('converts a well-formed ISO 8601 duration string to a Temporal.Duration, not a string', () => {
    const result = parseRoutineFile(routineFile(validPhaseGraph))

    expect(result.success).toBe(true)
    expect(typeof (result.success && result.graph.phases[0]?.duration)).not.toBe('string')
  })

  test('converts completionPolicy.after for a futureDate policy', () => {
    const graph = {
      ...validPhaseGraph,
      phases: [{ ...validPhaseGraph.phases[0], completionPolicy: { kind: 'futureDate', after: 'P1D' } }],
    }
    const result = parseRoutineFile(routineFile(graph))

    expect(result.success).toBe(true)
    const policy = result.success ? result.graph.phases[0]?.completionPolicy : undefined
    expect(policy?.kind).toBe('futureDate')
    expect(policy?.kind === 'futureDate' && policy.after.total({ unit: 'days' })).toBe(1)
  })

  test('a malformed ISO 8601 duration string fails with a RoutineParseError, not a throw', () => {
    const graph = { ...validPhaseGraph, phases: [{ ...validPhaseGraph.phases[0], duration: '25 minutes' }] }

    const result = parseRoutineFile(routineFile(graph))

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.message).toContain('Invalid ISO 8601 duration')
  })

  test('a malformed futureDate duration string fails with a RoutineParseError', () => {
    const graph = {
      ...validPhaseGraph,
      phases: [{ ...validPhaseGraph.phases[0], completionPolicy: { kind: 'futureDate', after: 'not-a-duration' } }],
    }

    const result = parseRoutineFile(routineFile(graph))

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.message).toContain('Invalid ISO 8601 duration')
  })

  test('malformed JSON in the fenced block fails with a RoutineParseError, not a throw', () => {
    const content = '---\npomodoro-routine: true\n---\n\n```json\n{ not valid json\n```\n'

    const result = parseRoutineFile(content)

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.message).toContain('not valid JSON')
  })

  test('JSON that fails PhaseGraphSchema validation fails with issue detail', () => {
    const invalidGraph = { ...validPhaseGraph, phases: [] } // PhaseGraphSchema requires phases.min(1)

    const result = parseRoutineFile(routineFile(invalidGraph))

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.issues && result.error.issues.length > 0).toBe(true)
    expect(result.success === false && result.error.issues?.[0]?.path).toEqual(['phases'])
  })

  test('a note body with zero fenced JSON blocks fails with a RoutineParseError', () => {
    const content = '---\npomodoro-routine: true\n---\n\nNo code block here.\n'

    const result = parseRoutineFile(content)

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.message).toContain('no fenced JSON code block')
  })

  test('a note body with multiple fenced JSON blocks fails with a RoutineParseError', () => {
    const content = `---\npomodoro-routine: true\n---\n\n\`\`\`json\n${JSON.stringify(validPhaseGraph)}\n\`\`\`\n\n\`\`\`json\n${JSON.stringify(validPhaseGraph)}\n\`\`\`\n`

    const result = parseRoutineFile(content)

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.message).toContain('2 fenced JSON code blocks')
  })
})
