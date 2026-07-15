import { Temporal } from 'temporal-polyfill'
import { PhaseGraphSchema } from '../phase/phase-graph'
import type { PhaseGraph } from '../phase/phase-graph'
import type { Phase } from '../phase/phase'

/**
 * Why a routine file's JSON block failed to become a PhaseGraph. `issues` is
 * only populated for schema-validation failures (mirrors ZodIssue's
 * path/message, decoupled from zod's own type so callers don't need it).
 */
export interface RoutineParseError {
  readonly message: string
  readonly issues?: readonly RoutineParseIssue[]
}

export interface RoutineParseIssue {
  readonly path: readonly PropertyKey[]
  readonly message: string
}

/** Mirrors ApplyMutationsResult's resolved-result convention — never a thrown exception. */
export type RoutineParseResult
  = | { readonly success: true, readonly graph: PhaseGraph }
    | { readonly success: false, readonly error: RoutineParseError }

type FieldConversionResult
  = | { readonly success: true, readonly value: unknown }
    | { readonly success: false, readonly error: RoutineParseError }

type PhaseConversionResult
  = | { readonly success: true, readonly phase: unknown }
    | { readonly success: false, readonly error: RoutineParseError }

type PhaseListConversionResult
  = | { readonly success: true, readonly phases: readonly unknown[] }
    | { readonly success: false, readonly error: RoutineParseError }

type JsonParseResult
  = | { readonly success: true, readonly value: unknown }
    | { readonly success: false }

type BlockExtractionResult
  = | { readonly success: true, readonly json: string }
    | { readonly success: false, readonly error: RoutineParseError }

const FENCED_JSON_BLOCK = /```json[ \t]*\r?\n([\s\S]*?)\r?\n?```/gi

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function tryParseDuration(iso: string): Temporal.Duration | null {
  try {
    return Temporal.Duration.from(iso)
  }
  catch {
    return null
  }
}

function tryParseJson(text: string): JsonParseResult {
  try {
    return { success: true, value: JSON.parse(text) }
  }
  catch {
    return { success: false }
  }
}

function extractJsonBlock(content: string): BlockExtractionResult {
  const matches = [...content.matchAll(FENCED_JSON_BLOCK)]
  return matches.length === 1
    ? { success: true, json: matches[0]?.[1] ?? '' }
    : {
        success: false,
        error: {
          message: matches.length === 0
            ? 'Routine file has no fenced JSON code block (```json ... ```).'
            : `Routine file has ${matches.length} fenced JSON code blocks; exactly one is required.`,
        },
      }
}

function convertDurationString(iso: string): FieldConversionResult {
  const duration = tryParseDuration(iso)
  return duration === null
    ? { success: false, error: { message: `Invalid ISO 8601 duration: "${iso}"` } }
    : { success: true, value: duration }
}

/** Leaves non-string values untouched — schema validation rejects the wrong shape on its own. */
function convertDurationField(value: unknown): FieldConversionResult {
  return typeof value !== 'string'
    ? { success: true, value }
    : convertDurationString(value)
}

function convertFutureDatePolicy(policy: Record<string, unknown>): FieldConversionResult {
  const afterResult = convertDurationField(policy.after)
  return !afterResult.success
    ? afterResult
    : { success: true, value: { ...policy, after: afterResult.value } }
}

/** Only `{ kind: 'futureDate', after: <ISO string> }` carries a duration field to convert. */
function convertCompletionPolicy(value: unknown): FieldConversionResult {
  return !isRecord(value) || value.kind !== 'futureDate'
    ? { success: true, value }
    : convertFutureDatePolicy(value)
}

function mergePhaseFields(
  phase: Record<string, unknown>,
  durationResult: FieldConversionResult,
  policyResult: FieldConversionResult,
): PhaseConversionResult {
  return !durationResult.success
    ? durationResult
    : !policyResult.success
        ? policyResult
        : { success: true, phase: { ...phase, duration: durationResult.value, completionPolicy: policyResult.value } }
}

function convertPhase(phase: unknown): PhaseConversionResult {
  return !isRecord(phase)
    ? { success: true, phase }
    : mergePhaseFields(phase, convertDurationField(phase.duration), convertCompletionPolicy(phase.completionPolicy))
}

function mergeConvertedPhase(
  acc: { readonly success: true, readonly phases: readonly unknown[] },
  phaseResult: PhaseConversionResult,
): PhaseListConversionResult {
  return !phaseResult.success
    ? phaseResult
    : { success: true, phases: [...acc.phases, phaseResult.phase] }
}

function convertPhaseList(phases: readonly unknown[]): PhaseListConversionResult {
  return phases.reduce<PhaseListConversionResult>(
    (acc, phase) => (!acc.success ? acc : mergeConvertedPhase(acc, convertPhase(phase))),
    { success: true, phases: [] },
  )
}

/** completePhase (src/timer/reducer.ts) has no execution path for these yet — see flow-gu1.25. */
function unimplementedPolicyKindOf(phase: Phase): string | null {
  const kind = phase.completionPolicy?.kind
  return kind === 'queueCycle' || kind === 'futureDate' ? kind : null
}

/** Rejects at load time rather than letting completePhase throw on every tick once the phase is reached. */
function rejectUnimplementedPolicies(graph: PhaseGraph): RoutineParseResult {
  const phase = graph.phases.find(p => unimplementedPolicyKindOf(p) !== null)
  return phase === undefined
    ? { success: true, graph }
    : {
        success: false,
        error: {
          message: `Phase "${phase.id}" has completionPolicy "${unimplementedPolicyKindOf(phase)}", which the engine doesn't execute yet.`,
        },
      }
}

function runSchema(converted: unknown): RoutineParseResult {
  const schemaResult = PhaseGraphSchema.safeParse(converted)
  return schemaResult.success
    ? rejectUnimplementedPolicies(schemaResult.data)
    : {
        success: false,
        error: {
          message: 'Routine file failed PhaseGraph schema validation.',
          issues: schemaResult.error.issues.map(issue => ({ path: issue.path, message: issue.message })),
        },
      }
}

function validateConverted(parsed: unknown): RoutineParseResult {
  const phasesResult = isRecord(parsed) && Array.isArray(parsed.phases)
    ? convertPhaseList(parsed.phases)
    : null
  return phasesResult !== null && !phasesResult.success
    ? phasesResult
    : runSchema(
        isRecord(parsed) && phasesResult !== null
          ? { ...parsed, phases: phasesResult.phases }
          : parsed,
      )
}

function parseExtractedJson(json: string): RoutineParseResult {
  const parsed = tryParseJson(json)
  return !parsed.success
    ? { success: false, error: { message: 'Routine file\'s fenced JSON block is not valid JSON.' } }
    : validateConverted(parsed.value)
}

/**
 * Parses a routine file's raw note content into a PhaseGraph: extracts the
 * single fenced JSON block, parses it, converts ISO 8601 duration strings at
 * `phases[].duration` and `phases[].completionPolicy.after` (futureDate only)
 * to Temporal.Duration, then validates via PhaseGraphSchema unchanged. Also
 * rejects `completionPolicy.kind: 'queueCycle' | 'futureDate'` — schema-valid
 * but not yet executed by completePhase (flow-gu1.25) — so that gap surfaces
 * once here rather than as a per-tick runtime throw. Never throws — every
 * failure path returns a RoutineParseError (see design.md decisions 3-4).
 */
export function parseRoutineFile(content: string): RoutineParseResult {
  const blockResult = extractJsonBlock(content)
  return !blockResult.success ? blockResult : parseExtractedJson(blockResult.json)
}
