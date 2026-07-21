import { test as base, expect, chromium } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import type { ChildProcess } from 'node:child_process'
import ObsidianLauncher from 'obsidian-launcher'
import * as path from 'node:path'
import * as net from 'node:net'
import { stripGitignoredVaultState } from '../vault'
import { terminateProcess } from './process-lifecycle'
import obsidianVersion from '../obsidian-version.json' with { type: 'json' }

const ROOT_DIR = path.resolve(import.meta.dirname, '../../')
const VAULT_PATH = path.join(ROOT_DIR, 'routine-flow-example-vault')
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

type ObsidianResources = ObsidianPage & {
  readonly proc: ChildProcess
  readonly browser: Browser
}

/**
 * Launches Obsidian and waits for it to be ready to drive over CDP. `connectPort`
 * defaults to `listenPort` (the port Obsidian was actually told to listen on) but can be
 * overridden to point at a port nothing is listening on, to exercise the failure path.
 *
 * Self-cleaning on failure: if any step here throws, the already-spawned process is
 * terminated before the error propagates, so a setup failure can never leak a live
 * Obsidian process. Callers are only responsible for cleanup on the success path
 * (see `releaseObsidian`).
 *
 * `onProcSpawned`, if given, fires as soon as the process exists -- so a test that
 * deliberately forces the failure path can still observe the process it needs to
 * assert was cleaned up, since the failure path never returns one.
 */
async function acquireObsidian(
  listenPort: number,
  connectPort: number = listenPort,
  onProcSpawned?: (proc: ChildProcess) => void,
): Promise<ObsidianResources> {
  const launcher = new ObsidianLauncher({ cacheDir: CACHE_DIR })

  // launcher.setupVault's copy is a plain recursive fs.cp -- it doesn't know about
  // .gitignore, so the per-test copy is stripped of gitignored runtime state
  // (.obsidian/workspace.json, .obsidian/plugins/, etc.) before Obsidian ever sees it.
  // Otherwise a local dev machine's leftover interactive-session state can silently
  // leak into every test and diverge from what a fresh checkout/CI produces.
  const copiedVault = await launcher.setupVault({ vault: VAULT_PATH, copy: true })
  await stripGitignoredVaultState(copiedVault)

  const { proc, vault } = await launcher.launch({
    appVersion: obsidianVersion.appVersion,
    installerVersion: obsidianVersion.installerVersion,
    vault: copiedVault,
    copy: false,
    plugins: [ROOT_DIR],
    args: [`--remote-debugging-port=${listenPort}`],
    spawnOptions: { stdio: 'pipe' },
  })
  onProcSpawned?.(proc)

  try {
    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => process.stderr.write(`[obsidian] ${data.toString()}`))
    }

    await waitForCDP(connectPort, proc)

    const browser = await chromium.connectOverCDP(`http://localhost:${connectPort}`)
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

    return { proc, browser, page, vaultPath: vault ?? VAULT_PATH }
  }
  catch (err) {
    await terminateProcess(proc)
    throw err
  }
}

async function releaseObsidian({ proc, browser }: ObsidianResources): Promise<void> {
  try {
    await browser.close()
  }
  finally {
    await terminateProcess(proc)
  }
}

type ObsidianFixtures = {
  readonly obsidianPage: ObsidianPage
}

export const test = base.extend<ObsidianFixtures>({
  obsidianPage: async ({}, use) => {
    const port = await findFreePort()
    const resources = await acquireObsidian(port)

    try {
      await use({ page: resources.page, vaultPath: resources.vaultPath })
    }
    finally {
      await releaseObsidian(resources)
    }
  },
})

export { acquireObsidian, findFreePort }

export { expect }
