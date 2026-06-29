import { Plugin, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, type PomodoroSettings } from './settings';
import { TimerManager } from './timer-manager';
import { PomodoroTimerView } from './views/timer-view';

export default class PomodoroPlugin extends Plugin {
  public settings: PomodoroSettings = DEFAULT_SETTINGS;
  public timer!: TimerManager;

  async onload() {
    await this.loadSettings();
    this.timer = new TimerManager(this.settings);
    this.timer.onPhaseComplete(async (filePath) => {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) {
        return;
      }
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        const prop = this.settings.writeBackProperty;
        const current = frontmatter[prop];
        if (typeof current === 'number') {
          frontmatter[prop] = current + 1;
        } else {
          frontmatter[prop] = 1;
        }
      });
    });

    // Register Bases View
    this.registerBasesView(
      'pomodoro-timer',
      {
        name: 'Pomodoro Timer',
        icon: 'timer',
        factory: (controller, containerEl) => new PomodoroTimerView(
          controller,
          containerEl,
          this,
        ),
        options: () => PomodoroTimerView.getViewOptions(),
      },
    );

    console.log('Pomodoro Plugin loaded successfully');
  }

  onunload() {
    this.timer.stop();
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
