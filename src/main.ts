import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type PomodoroSettings } from './settings';

export default class PomodoroPlugin extends Plugin {
  public settings: PomodoroSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    console.log('Pomodoro Plugin loaded successfully');
  }

  onunload() {
    console.log('Pomodoro Plugin unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData() as Partial<PomodoroSettings>,
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
