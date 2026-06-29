import { z } from 'zod';
import { PluginSettingTab, App, Setting } from 'obsidian';
import type PomodoroPlugin from './main';

export const PomodoroSettingsSchema = z.object({
  writeBackProperty: z.string().default('pomodoros'),
  defaultWorkDurationSeconds: z.number().int().positive().default(1500),
  defaultBreakDurationSeconds: z.number().int().positive().default(300),
});

export type PomodoroSettings = z.infer<typeof PomodoroSettingsSchema>;

export const DEFAULT_SETTINGS: PomodoroSettings = {
  writeBackProperty: 'pomodoros',
  defaultWorkDurationSeconds: 1500,
  defaultBreakDurationSeconds: 300,
};

export class PomodoroSettingTab extends PluginSettingTab {
  private plugin: PomodoroPlugin;

  constructor(app: App, plugin: PomodoroPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Write-back property')
      .setDesc('Frontmatter property updated when a focus block completes.')
      .addText((text) =>
        text
          .setPlaceholder('pomodoros')
          .setValue(this.plugin.settings.writeBackProperty)
          .onChange(async (value) => {
            this.plugin.settings.writeBackProperty = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Focus duration (minutes)')
      .setDesc('Duration of the work/focus phase.')
      .addText((text) =>
        text
          .setValue((this.plugin.settings.defaultWorkDurationSeconds / 60).toString())
          .onChange(async (value) => {
            const mins = parseInt(value, 10);
            if (!isNaN(mins) && mins > 0) {
              this.plugin.settings.defaultWorkDurationSeconds = mins * 60;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName('Break duration (minutes)')
      .setDesc('Duration of the break phase.')
      .addText((text) =>
        text
          .setValue((this.plugin.settings.defaultBreakDurationSeconds / 60).toString())
          .onChange(async (value) => {
            const mins = parseInt(value, 10);
            if (!isNaN(mins) && mins > 0) {
              this.plugin.settings.defaultBreakDurationSeconds = mins * 60;
              await this.plugin.saveSettings();
            }
          })
      );
  }
}
