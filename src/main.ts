import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type PomodoroSettings } from './settings';
import { TimerManager } from './timer-manager';
import { PomodoroTimerView } from './views/timer-view';

export default class PomodoroPlugin extends Plugin {
  public settings: PomodoroSettings = DEFAULT_SETTINGS;
  public timer!: TimerManager;

  async onload() {
    await this.loadSettings();
    this.timer = new TimerManager(this.settings);

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
