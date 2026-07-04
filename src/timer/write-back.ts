import { Temporal } from 'temporal-polyfill'
import type { Phase } from '../domain/phase/phase'
import type { LogTargetResolverRegistry } from '../domain/log-target/log-target-resolver'
import type { FrontmatterReader } from '../domain/mutation/frontmatter-reader'
import type { FileMutationPort, ApplyMutationsResult } from '../domain/mutation/apply-mutations'
import { applyMutations } from '../domain/mutation/apply-mutations'
import { nextLogEntry } from '../domain/mutation/log-entry'
import { FileMutationSchema } from '../domain/mutation/file-mutation'
import type { WriteBackPromptPort } from '../domain/mutation/write-back-prompt'

export type WriteBackResult
  = | { readonly kind: 'skipped' }
    | { readonly kind: 'applied', readonly result: ApplyMutationsResult }

export interface WriteBackDeps {
  readonly logTargetResolverRegistry: LogTargetResolverRegistry
  readonly frontmatterReader: FrontmatterReader
  readonly fileMutationPort: FileMutationPort
  readonly writeBackPrompt: WriteBackPromptPort
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
 * prompts for confirmation, and (if submitted) applies a single frontmatter
 * mutation there. See specs/frontmatter-write-back-trigger/spec.md and
 * specs/write-back-input-modal/spec.md for the scenarios this covers.
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
  const promptResult = await deps.writeBackPrompt.prompt({ filePath, property: entry.property, value: entry.value })
  if (promptResult.kind === 'cancelled') {
    return { kind: 'skipped' }
  }
  const mutation = FileMutationSchema.parse({
    kind: 'frontmatter',
    filePath: promptResult.values.filePath,
    property: promptResult.values.property,
    value: promptResult.values.value,
  })
  const result = await applyMutations(deps.fileMutationPort, [mutation])
  return { kind: 'applied', result }
}
