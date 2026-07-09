import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'
import { createNote, writeNoteToVault } from './vault'
import type { EngineAction } from '../src/timer/reducer'

const PLUGIN_ID = 'obsidian-pomodoro-plugin'
const TASK_PATH = 'write-back-e2e-task.md'

function dispatchAction(page: Page, action: EngineAction): Promise<unknown> {
  // pluginId's type is the literal 'obsidian-pomodoro-plugin' (matches PLUGIN_ID's
  // const-inferred type), not a widened `string` -- required so the indexed
  // access below narrows via the PluginsRegistry augmentation in
  // obsidian-internal.d.ts instead of falling back to `unknown`.
  return evaluateObsidian(page, (app, args: { pluginId: typeof PLUGIN_ID, action: EngineAction }) =>
    app.plugins.plugins[args.pluginId]!.store.dispatch(args.action), { pluginId: PLUGIN_ID, action })
}

/**
 * Drives the running focus phase to a real completion (onComplete), which is
 * what the write-back hook is bound to post-migration -- dispatching
 * 'advance-phase' instead fires onSkip, which doesn't trigger write-back.
 * Ticks are simulated dispatches, not wall-clock waits, so looping through a
 * 25-minute duration resolves near-instantly. The final tick (the one that
 * actually crosses zero) is intentionally not awaited: its dispatch fires the
 * write-back hook, whose returned promise doesn't resolve until this test
 * dismisses the modal, so awaiting it here would deadlock the test against
 * itself.
 */
async function completeFocusPhase(page: Page): Promise<void> {
  await evaluateObsidian(page, async (app, args: { pluginId: typeof PLUGIN_ID }) => {
    const store = app.plugins.plugins[args.pluginId]!.store
    const remainingSeconds = store.getState().remaining?.total({ unit: 'seconds' }) ?? 0
    for (let i = 0; i < remainingSeconds; i += 1) {
      await store.dispatch({ type: 'tick' })
    }
  }, { pluginId: PLUGIN_ID })
  void dispatchAction(page, { type: 'tick' })
}

function readPomodoros(page: Page): Promise<unknown> {
  return evaluateObsidian(page, (app, args: { path: string }) => {
    const file = app.vault.getFileByPath(args.path)
    const value: unknown = file ? app.metadataCache.getFileCache(file)?.frontmatter?.pomodoros : undefined
    return value
  }, { path: TASK_PATH })
}

function modalLocator(page: Page) {
  return page.locator('.modal').filter({ hasText: 'Confirm write-back' })
}

test.describe('write-back confirmation modal', () => {
  test.beforeEach(async ({ obsidianPage: { page, vaultPath } }) => {
    const note = createNote(TASK_PATH, { 'note.type': 'work', 'pomodoros': 3 })
    const writeError = await writeNoteToVault(vaultPath, note)
    expect(writeError).toBeUndefined()

    await expect.poll(() => readPomodoros(page)).toBe(3)
    await dispatchAction(page, { type: 'start', filePath: TASK_PATH })
  })

  test('submitting with no edits increments the value', async ({ obsidianPage: { page } }) => {
    await completeFocusPhase(page)

    await modalLocator(page).getByRole('button', { name: 'Submit' }).click()

    await expect.poll(() => readPomodoros(page)).toBe(4)
  })

  test('cancelling the prompt writes nothing', async ({ obsidianPage: { page } }) => {
    await completeFocusPhase(page)

    await modalLocator(page).getByRole('button', { name: 'Cancel' }).click()

    await expect.poll(() => readPomodoros(page)).toBe(3)
  })

  test('editing the value field before submit writes the edited value', async ({ obsidianPage: { page } }) => {
    await completeFocusPhase(page)
    const modal = modalLocator(page)

    await modal.locator('.setting-item', { hasText: 'Value' }).locator('input').fill('99')
    await modal.getByRole('button', { name: 'Submit' }).click()

    await expect.poll(() => readPomodoros(page)).toBe(99)
  })
})
