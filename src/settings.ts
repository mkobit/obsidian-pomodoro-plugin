import { z } from 'zod'
import type { App } from 'obsidian'
import { PluginSettingTab, Setting } from 'obsidian'
import type PomodoroPlugin from './main'

export const PomodoroSettingsSchema = z.object({
  /** Frontmatter property to increment when a focus phase completes. */
  writeBackProperty: z.string().default('pomodoros'),
})

export type PomodoroSettings = z.infer<typeof PomodoroSettingsSchema>

export const DEFAULT_SETTINGS: PomodoroSettings = {
  writeBackProperty: 'pomodoros',
}

export class PomodoroSettingTab extends PluginSettingTab {
  private plugin: PomodoroPlugin

  constructor(app: App, plugin: PomodoroPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    new Setting(containerEl)
      .setName('Write-back property')
      .setDesc('Frontmatter property incremented when a focus phase completes.')
      .addText(text =>
        text
          .setPlaceholder('Pomodoros')
          .setValue(this.plugin.settings.writeBackProperty)
          .onChange(async (value) => {
            this.plugin.settings.writeBackProperty = value
            await this.plugin.saveSettings()
          }),
      )
  }
}
