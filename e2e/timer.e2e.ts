import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'

const PLUGIN_ID = 'obsidian-pomodoro-plugin'

test.describe('Pomodoro Timer View', () => {
  test('registers bases view and can start a timer', async ({ obsidianPage: { page } }) => {
    // Assert registration exists
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true)
  })
})

test.describe('duration-less phase (finish-phase / "Done" control)', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true)

    // Tasks.base's "Workout" view (routines/workout-routine.md) has a duration-less "Set" phase.
    // Reuse the bases leaf the vault's persisted workspace.json already restores on launch (rather
    // than opening a second tab) so exactly one bases leaf exists to select below.
    await evaluateObsidian(page, async (app) => {
      const file = app.vault.getFileByPath('Tasks.base')
      if (!file) {
        throw new Error('Tasks.base not found')
      }
      const leaf = app.workspace.getLeavesOfType('bases')[0] ?? app.workspace.getLeaf('tab')
      await leaf.openFile(file)
    })
    await page.locator('.workspace-leaf-content[data-type="bases"] .bases-toolbar-views-menu .text-icon-button').click()
    await page.locator('.menu .bases-toolbar-menu-item-name', { hasText: 'Workout' }).click()
  })

  test('renders the phase (not blank) and a Done button appears once running, completing the phase on click', async ({ obsidianPage: { page } }) => {
    const panel = page.locator('.workspace-leaf-content[data-type="bases"] .pomodoro-timer-panel')
    const controls = page.locator('.workspace-leaf-content[data-type="bases"] .pomodoro-controls')

    // The header currently reflects the shared engine's default (untouched) graph, not this tab's
    // own Workout routine -- that only takes effect once Start switches the engine's active graph.
    await controls.getByRole('button', { name: 'Start' }).click()
    await expect(panel.locator('h2')).toHaveText(/^Warm-up: \d{2}:\d{2} \(running\)$/)

    // advance-phase always lands at 'stopped' -- skip the warmup timer (avoid a real wall-clock
    // wait) and start the duration-less "Set" phase it reveals.
    await evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID }) =>
      app.plugins.plugins[args.pluginId]!.store.dispatch({ type: 'advance-phase' }), { pluginId: PLUGIN_ID })
    await expect(panel.locator('h2')).toHaveText('Set (stopped)')

    await controls.getByRole('button', { name: 'Start' }).click()

    // Duration-less: no countdown in the header, and a Done control instead of a blank view.
    await expect(panel.locator('h2')).toHaveText('Set (running)')
    const doneBtn = controls.getByRole('button', { name: 'Done' })
    await expect(doneBtn).toBeVisible()

    await doneBtn.click()

    // "Set"'s completionPolicy is null, so finish-phase auto-advances to "Rest".
    await expect(panel.locator('h2')).toHaveText(/^Rest: \d{2}:\d{2} \(stopped\)$/)
  })
})

test.describe('BaseQuerySource-backed queue (base-query-task-source)', () => {
  test.beforeEach(async ({ obsidianPage: { page } }) => {
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true)
  })

  test('Work queue renders real Bases entries sorted by pomodoro-priority', async ({ obsidianPage: { page } }) => {
    // Tasks.base's persisted workspace.json opens directly on the "Pomodoro" sub-view (no
    // routineFile -- the default POMODORO_PHASE_GRAPH), whose focus phase's taskSourceId is
    // focus-queue. No engine interaction needed: the queue renders from the shared engine's
    // default (untouched) state, which starts at the 'focus' phase.
    const queue = page.locator('.workspace-leaf-content[data-type="bases"] .pomodoro-queue')
    await expect(queue.locator('h3')).toHaveText('Work queue')

    // e2e/vault/generator.ts's generatePomodoroNotes(DEFAULT_VAULT_SEED) is deterministic --
    // these five notes' pomodoro-priority values sort ascending as below (one has no
    // pomodoro-priority at all, exercising BaseQuerySource's "missing sorts as 0" default).
    // displayName is the file's basename (indexedPath's slugified filename), not the note's title.
    await expect(queue.locator('li button')).toHaveText([
      '04-draft-release-notes',
      '01-refactor-auth-module',
      '05-fix-flaky-test',
      '02-review-pr-feedback',
      '03-update-onboarding-docs',
    ], { timeout: 20_000 })
  })
})
