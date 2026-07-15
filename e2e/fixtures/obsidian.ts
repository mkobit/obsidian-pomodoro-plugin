import { test as base, expect, chromium } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { ChildProcess } from 'node:child_process'
import ObsidianLauncher from 'obsidian-launcher'
import * as path from 'node:path'
import * as net from 'node:net'
import { stripGitignoredVaultState } from '../vault'

const ROOT_DIR = path.resolve(import.meta.dirname, '../../')
const VAULT_PATH = path.join(ROOT_DIR, 'obsidian-pomodoro-plugin-example-vault')
const CACHE_DIR = path.join(ROOT_DIR, '.obsidian-cache')

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, () => {
      const addr = server.address()
      server.close(() => {
        if (addr !== null && typeof addr === 'object') {
          resolve(addr.port)
        }
        else {
          reject(new Error('Could not determine free port'))
        }
      })
    })
  })
}

async function waitForCDP(port: number, proc: ChildProcess): Promise<void> {
  await expect(async () => {
    if (proc.exitCode !== null) {
      throw new Error(`Obsidian process exited early with code ${proc.exitCode}`)
    }
    const browser = await chromium.connectOverCDP(`http://localhost:${port}`, { timeout: 2000 })
    await browser.close()
  }).toPass({ intervals: [1000], timeout: 30_000 })
}

export type ObsidianPage = {
  readonly page: Page
  /** Path to the (per-test, `copy: true`) vault actually running — writes here are picked up by the running Obsidian instance. */
  readonly vaultPath: string
}

type ObsidianFixtures = {
  readonly obsidianPage: ObsidianPage
}

export const test = base.extend<ObsidianFixtures>({
  obsidianPage: async ({}, use) => {
    const port = await findFreePort()
    const launcher = new ObsidianLauncher({ cacheDir: CACHE_DIR })

    // launcher.setupVault's copy is a plain recursive fs.cp -- it doesn't know about
    // .gitignore, so the per-test copy is stripped of gitignored runtime state
    // (.obsidian/workspace.json, .obsidian/plugins/, etc.) before Obsidian ever sees it.
    // Otherwise a local dev machine's leftover interactive-session state can silently
    // leak into every test and diverge from what a fresh checkout/CI produces.
    const copiedVault = await launcher.setupVault({ vault: VAULT_PATH, copy: true })
    await stripGitignoredVaultState(copiedVault)

    const { proc, vault } = await launcher.launch({
      appVersion: 'latest',
      installerVersion: 'latest',
      vault: copiedVault,
      copy: false,
      plugins: [ROOT_DIR],
      args: [`--remote-debugging-port=${port}`],
      spawnOptions: { stdio: 'pipe' },
    })

    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => process.stderr.write(`[obsidian] ${data.toString()}`))
    }

    await waitForCDP(port, proc)

    const browser = await chromium.connectOverCDP(`http://localhost:${port}`)
    const context = browser.contexts()[0] ?? await browser.newContext()
    const page = context.pages()[0] ?? await context.newPage()

    await page.waitForFunction(
      () => typeof window.app !== 'undefined',
      { timeout: 30_000 },
    )

    // window.app existing only means the renderer booted -- workspace.json-driven leaf restore
    // (e.g. the Tasks.base leaf) is a separate, later async step that can still be in flight here.
    // workspace.layoutReady is Obsidian's own public signal that restore has finished.
    await page.waitForFunction(
      () => window.app!.workspace.layoutReady,
      { timeout: 30_000 },
    )

    await use({ page, vaultPath: vault ?? VAULT_PATH })

    await browser.close()
    proc.kill()
  },
})

export { expect }
