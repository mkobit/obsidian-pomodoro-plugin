import { test, expect } from './fixtures/obsidian'
import { evaluateObsidian } from './helpers/evaluate'

const PLUGIN_ID = 'obsidian-pomodoro-plugin'

test.describe('plugin lifecycle', () => {
  test('loads into the plugin registry', async ({ obsidianPage: { page } }) => {
    await expect.poll(async () =>
      evaluateObsidian(
        page,
        (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
        { pluginId: PLUGIN_ID },
      ),
    ).toBe(true)
  })
})
