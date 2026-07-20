import type { HookRegistry } from '../domain/hook/hook'
import type { PredicateRegistry } from '../domain/hook/predicate'
import type { FileMutationPort } from '../domain/mutation/apply-mutations'

/**
 * Optional collaborators shared by engineReducer and EngineStore. A single
 * growing bag instead of one positional parameter per capability, so adding
 * a new dependency (e.g. a TaskSourceRegistry) stays non-breaking for every
 * existing call site.
 */
export interface EngineDeps {
  readonly hookRegistry?: HookRegistry
  readonly port?: FileMutationPort
  readonly predicateRegistry?: PredicateRegistry
}
