import * as path from 'node:path'
import { rebuildGeneratedVault, resolveVaultSeed } from './vault'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')
const VAULT_PATH = path.join(ROOT_DIR, 'obsidian-pomodoro-plugin-example-vault')

/**
 * Rebuilds the shared vault's per-routine notes once before the whole run
 * (playwright.config.ts runs `workers: 1`, so there's no concurrent-write race
 * with per-test fixtures). Each test's `copy: true` fixture then copies this
 * freshly-rebuilt content into its own isolated per-test vault directory.
 */
export default async function globalSetup(): Promise<void> {
  const seed = resolveVaultSeed()
  const errors = await rebuildGeneratedVault(VAULT_PATH, seed)
  if (errors.length > 0) {
    throw new AggregateError(errors, `Failed to write ${errors.length} generated vault note(s)`)
  }
  process.stdout.write(`Rebuilt generated vault notes in ${VAULT_PATH} (seed=${seed})\n`)
}
