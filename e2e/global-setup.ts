import * as path from 'node:path'
import { spawn } from 'node:child_process'
import { rebuildGeneratedVault, resolveVaultSeed } from './vault'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')
const VAULT_PATH = path.join(ROOT_DIR, 'obsidian-pomodoro-plugin-example-vault')

/**
 * e2e/fixtures/obsidian.ts launches Obsidian against whatever main.js already sits at ROOT_DIR --
 * it doesn't rebuild from src/ itself. Without this, a stale bundle silently passes tests against
 * old code (flow-k2x; discovered when a 2-day-old main.js gave a false-green 3/3).
 */
async function rebuildPlugin(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('bun', ['run', 'build'], { cwd: ROOT_DIR, stdio: 'inherit' })
    proc.on('error', reject)
    proc.on('close', code => (code === 0 ? resolve() : reject(new Error(`bun run build exited ${code}`))))
  })
}

/**
 * Rebuilds the shared vault's per-routine notes once before the whole run
 * (playwright.config.ts runs `workers: 1`, so there's no concurrent-write race
 * with per-test fixtures). Each test's `copy: true` fixture then copies this
 * freshly-rebuilt content into its own isolated per-test vault directory.
 */
export default async function globalSetup(): Promise<void> {
  await rebuildPlugin()

  const seed = resolveVaultSeed()
  const errors = await rebuildGeneratedVault(VAULT_PATH, seed)
  if (errors.length > 0) {
    throw new AggregateError(errors, `Failed to write ${errors.length} generated vault note(s)`)
  }
  process.stdout.write(`Rebuilt generated vault notes in ${VAULT_PATH} (seed=${seed})\n`)
}
