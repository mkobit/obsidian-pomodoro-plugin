import type { Phase, LogTargetResolverName } from '../phase/phase'

/**
 * Resolves a Phase's 'callback' log target to a file path, or null if the
 * phase has nowhere to write back to right now (e.g. no daily note exists
 * yet). A much narrower question (Phase -> string | null) than a Hook
 * (HookContext -> FileMutation[]), so it gets its own registry rather than
 * reusing HookRegistry.
 */
export type LogTargetResolver = (phase: Phase) => string | null

/** Resolves a log target resolver by name. Never eval's from settings/frontmatter. */
export interface LogTargetResolverRegistry {
  readonly resolve: (name: LogTargetResolverName) => LogTargetResolver | undefined
}
