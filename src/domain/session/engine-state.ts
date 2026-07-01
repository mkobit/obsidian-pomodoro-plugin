import type { PhaseId } from '../phase/phase'
import type { Session } from './session'

/**
 * Runtime engine state for a live session. `phaseVisitCounts` backs
 * TransitionCondition's 'everyNth' case (e.g. a long break every 4th cycle)
 * — it's derived at runtime by replaying/counting phase entries, not part of
 * the static PhaseGraph config.
 *
 * Deliberately minimal for this pass — a fuller EngineState (replacing
 * src/timer/reducer.ts's TimerState) is follow-up work once the reducer
 * migrates to PhaseGraph.
 */
export interface EngineState {
  readonly session: Session
  readonly phaseVisitCounts: Readonly<Record<PhaseId, number>>
}
