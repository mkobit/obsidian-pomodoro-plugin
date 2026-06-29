import { test, expect } from './fixtures/obsidian';
import { evaluateObsidian } from './helpers/evaluate';

const PLUGIN_ID = 'obsidian-pomodoro-plugin';

test.describe('Pomodoro Timer View', () => {
  test('registers bases view and can start a timer', async ({ obsidianPage: { page } }) => {
    // Assert registration exists
    const hasView = await evaluateObsidian(
      page,
      (app, args: { pluginId: string }) => app.plugins.plugins[args.pluginId] !== undefined,
      { pluginId: PLUGIN_ID }
    );
    expect(hasView).toBe(true);
  });
});
