import { Plugin, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, type PomodoroSettings, PomodoroSettingTab } from './settings';
import { TimerStore } from './timer/store';
import { TimerTicker } from './timer/ticker';
import { PomodoroTimerView } from './views/timer-view';

export default class PomodoroPlugin extends Plugin {
  public settings: PomodoroSettings = DEFAULT_SETTINGS;
  public store!: TimerStore;
  public ticker!: TimerTicker;

  async onload() {
    await this.loadSettings();
    this.store = new TimerStore(this.settings);
    this.ticker = new TimerTicker((action) => this.store.dispatch(action));

    // Handle background ticker transitions
    let lastState = this.store.getState();
    this.store.subscribe(async (state) => {
      if (state.status === 'running') {
        this.ticker.start();
      } else {
        this.ticker.stop();
      }

      // Check phase completion write-back transition
      if (lastState.currentPhaseIndex === 0 && state.currentPhaseIndex === 1 && state.activeFilePath) {
        await this.handlePhaseComplete(state.activeFilePath);
      }
      lastState = state;
    });

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

    this.addSettingTab(new PomodoroSettingTab(this.app, this));
  }

  private async handlePhaseComplete(filePath: string) {
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
  }

  onunload() {
    this.ticker.stop();
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData() as Partial<PomodoroSettings>,
    );
    if (this.store) {
      this.store.updateSettings(this.settings);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    if (this.store) {
      this.store.updateSettings(this.settings);
    }
  }
}
