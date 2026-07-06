#!/usr/bin/env bun
import ObsidianLauncher from 'obsidian-launcher'
import * as path from 'node:path'
import { Command } from 'commander'
import { rebuildGeneratedVault, resolveVaultSeed } from '../e2e/vault'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')
const VAULT_PATH = path.join(ROOT_DIR, 'obsidian-pomodoro-plugin-example-vault')
const CACHE_DIR = path.join(ROOT_DIR, '.obsidian-cache')

async function main(): Promise<void> {
  const program = new Command()
  program.option('--generated', 'rebuild the vault\'s per-routine notes (docs/examples/) before launching', false)
  program.parse()
  const { generated } = program.opts<{ generated: boolean }>()

  if (generated) {
    const seed = resolveVaultSeed()
    const errors = await rebuildGeneratedVault(VAULT_PATH, seed)
    if (errors.length > 0) {
      throw new AggregateError(errors, `Failed to write ${errors.length} generated vault note(s)`)
    }
    console.log(`Rebuilt generated vault notes in ${VAULT_PATH} (seed=${seed})`)
  }

  const launcher = new ObsidianLauncher({ cacheDir: CACHE_DIR })

  // Detached + ignored stdio + unref so this command hands control back to the
  // shell immediately instead of blocking the terminal until Obsidian closes.
  const { proc } = await launcher.launch({
    appVersion: 'latest',
    installerVersion: 'latest',
    vault: VAULT_PATH,
    copy: false,
    plugins: [ROOT_DIR],
    args: ['--disable-gpu'],
    spawnOptions: { stdio: 'ignore', detached: true },
  })
  proc.unref()

  console.log(`Obsidian launched in the background (pid ${proc.pid}) — vault: ${VAULT_PATH}`)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
