/**
 * Resolves what EngineState.activeFilePath should be after a task queue's
 * entries change. Unchanged if still present in the queue (or already
 * null); otherwise the first remaining entry, or null if the queue is
 * empty. Operates on plain file paths, not BasesEntry/TaskSource, so it
 * needs no Obsidian types and no mocking to test.
 */
export function resolveActiveFilePath(
  activeFilePath: string | null,
  queueFilePaths: readonly string[],
): string | null {
  if (activeFilePath === null || queueFilePaths.includes(activeFilePath)) {
    return activeFilePath
  }
  return queueFilePaths[0] ?? null
}
