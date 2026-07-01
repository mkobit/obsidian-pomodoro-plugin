import { Temporal } from 'temporal-polyfill'
import { PhaseKindSchema, PhaseSchema } from '../domain/phase/phase'
import type { Phase, PhaseId } from '../domain/phase/phase'
import { PhaseGraphIdSchema, PhaseGraphSchema } from '../domain/phase/phase-graph'
import type { PhaseGraph, TransitionCondition } from '../domain/phase/phase-graph'

/** Built-in phase kinds used by the default Pomodoro phase graph. */
export const FOCUS_PHASE_KIND = PhaseKindSchema.parse('focus')
export const BREAK_PHASE_KIND = PhaseKindSchema.parse('break')

/**
 * Look up a phase by id within a graph. Returns undefined rather than
 * throwing — callers that need an invariant (the reducer) throw themselves;
 * UI code can fall back to rendering nothing.
 */
export function findPhaseById(graph: PhaseGraph, id: PhaseId): Phase | undefined {
  return graph.phases.find(phase => phase.id === id)
}

/**
 * Resolve which phase to enter next from `fromPhaseId`, evaluating
 * transitions in declared array order and taking the first whose condition
 * is satisfied — so a graph author puts exception branches (e.g. everyNth)
 * before the fallback 'always' branch.
 *
 * Throws if no outgoing transition matches (a misconfigured graph) or if a
 * 'custom' condition is reached — custom predicates aren't resolvable yet,
 * since HookRegistry only resolves to Hooks that return FileMutation[], not
 * boolean-returning predicates (see the follow-up bead for this gap).
 */
export function resolveNextPhaseId(
  graph: PhaseGraph,
  fromPhaseId: PhaseId,
  visitCounts: Readonly<Record<PhaseId, number>>,
): PhaseId {
  const candidates = graph.transitions.filter(transition => transition.fromPhaseId === fromPhaseId)
  for (const transition of candidates) {
    if (isConditionSatisfied(transition.condition, fromPhaseId, visitCounts)) {
      return transition.toPhaseId
    }
  }
  throw new Error(`PhaseGraph "${graph.id}" has no eligible transition from phase "${fromPhaseId}"`)
}

function isConditionSatisfied(
  condition: TransitionCondition,
  fromPhaseId: PhaseId,
  visitCounts: Readonly<Record<PhaseId, number>>,
): boolean {
  switch (condition.kind) {
    case 'always':
      return true
    case 'everyNth':
      return (visitCounts[fromPhaseId] ?? 0) % condition.n === 0
    case 'custom':
      throw new Error(
        `Transition predicate "${condition.predicate}" is a 'custom' condition, which isn't supported yet — `
        + 'HookRegistry only resolves to Hooks returning FileMutation[], not boolean predicates.',
      )
  }
}

const phaseDefaults = {
  taskSourceId: null,
  completionPolicy: null,
  notification: null,
  onEnter: null,
  onComplete: null,
  onSkip: null,
  onExit: null,
} as const

const focusPhase: Phase = PhaseSchema.parse({
  ...phaseDefaults,
  id: 'focus',
  label: 'Focus',
  kind: FOCUS_PHASE_KIND,
  duration: Temporal.Duration.from({ minutes: 25 }),
  logTarget: 'activeItem',
})

const breakPhase: Phase = PhaseSchema.parse({
  ...phaseDefaults,
  id: 'break',
  label: 'Short break',
  kind: BREAK_PHASE_KIND,
  duration: Temporal.Duration.from({ minutes: 5 }),
  logTarget: 'dailyNote',
})

const longBreakPhase: Phase = PhaseSchema.parse({
  ...phaseDefaults,
  id: 'long-break',
  label: 'Long break',
  kind: BREAK_PHASE_KIND,
  duration: Temporal.Duration.from({ minutes: 15 }),
  logTarget: 'dailyNote',
})

/**
 * Built-in Pomodoro phase graph: 25 min focus → 5 min break, repeating,
 * with a 15 min long break every 4th focus phase.
 */
export const POMODORO_PHASE_GRAPH: PhaseGraph = PhaseGraphSchema.parse({
  id: PhaseGraphIdSchema.parse('pomodoro'),
  name: 'Pomodoro',
  phases: [focusPhase, breakPhase, longBreakPhase],
  transitions: [
    { fromPhaseId: focusPhase.id, toPhaseId: longBreakPhase.id, condition: { kind: 'everyNth', n: 4 } },
    { fromPhaseId: focusPhase.id, toPhaseId: breakPhase.id, condition: { kind: 'always' } },
    { fromPhaseId: breakPhase.id, toPhaseId: focusPhase.id, condition: { kind: 'always' } },
    { fromPhaseId: longBreakPhase.id, toPhaseId: focusPhase.id, condition: { kind: 'always' } },
  ],
})
