import { Temporal } from 'temporal-polyfill'
import type { Phase } from '../domain/phase/phase'
import type { LogTargetResolverRegistry } from '../domain/log-target/log-target-resolver'
import type { FrontmatterReader } from '../domain/mutation/frontmatter-reader'
import type { FileMutationPort, ApplyMutationsResult } from '../domain/mutation/apply-mutations'
import { applyMutations } from '../domain/mutation/apply-mutations'
import { nextLogEntry } from '../domain/mutation/log-entry'
import { FileMutationSchema } from '../domain/mutation/file-mutation'

export type WriteBackResult
  = | { readonly kind: 'skipped' }
    | { readonly kind: 'applied', readonly result: ApplyMutationsResult }

export interface WriteBackDeps {
  readonly logTargetResolverRegistry: LogTargetResolverRegistry
  readonly frontmatterReader: FrontmatterReader
  readonly fileMutationPort: FileMutationPort
}

function resolveTargetFilePath(
  phase: Phase,
  activeFilePath: string | null,
  registry: LogTargetResolverRegistry,
): string | null {
  if (phase.logTarget.kind === 'activeItem') {
    return activeFilePath
  }
  const resolver = registry.resolve(phase.logTarget.name)
  return resolver === undefined ? null : resolver(phase)
}

/**
 * Resolves where a completed phase's write-back goes, then reads, computes,
 * and applies a single frontmatter mutation there. See
 * specs/frontmatter-write-back-trigger/spec.md for the scenarios this covers.
 */
export async function writeBackPhaseCompletion(
  phase: Phase,
  activeFilePath: string | null,
  property: string,
  deps: WriteBackDeps,
): Promise<WriteBackResult> {
  const filePath = resolveTargetFilePath(phase, activeFilePath, deps.logTargetResolverRegistry)
  if (filePath === null) {
    return { kind: 'skipped' }
  }
  const currentValue = deps.frontmatterReader.readValue(filePath, property)
  const entry = nextLogEntry(currentValue, property, Temporal.Now.instant())
  const mutation = FileMutationSchema.parse({
    kind: 'frontmatter',
    filePath,
    property: entry.property,
    value: entry.value,
  })
  const result = await applyMutations(deps.fileMutationPort, [mutation])
  return { kind: 'applied', result }
}
