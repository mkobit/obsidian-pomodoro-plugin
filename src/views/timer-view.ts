import { BasesView, type ViewOption, type QueryController } from 'obsidian';
import type PomodoroPlugin from '../main';
import type { TimerState } from '../timer-manager';

export class PomodoroTimerView extends BasesView {
  readonly type = 'pomodoro-timer';
  containerEl: HTMLElement;
  private plugin: PomodoroPlugin;
  private unsubscribe: (() => void) | null = null;

  constructor(controller: QueryController, containerEl: HTMLElement, plugin: PomodoroPlugin) {
    super(controller);
    this.containerEl = containerEl;
    this.plugin = plugin;
  }

  onload() {
    this.unsubscribe = this.plugin.timer.subscribe((state) => {
      this.render(state);
    });
    this.render(this.plugin.timer.getState());
  }

  onunload() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  onDataUpdated() {
    this.render(this.plugin.timer.getState());
  }

  private render(state: TimerState) {
    this.containerEl.empty();
    
    // Timer Panel
    const timerPanel = this.containerEl.createDiv({ cls: 'pomodoro-timer-panel' });
    const mins = Math.floor(state.remainingSeconds / 60).toString().padStart(2, '0');
    const secs = (state.remainingSeconds % 60).toString().padStart(2, '0');
    timerPanel.createEl('h2', { text: `${mins}:${secs} (${state.status})` });

    // Controls
    const controls = this.containerEl.createDiv({ cls: 'pomodoro-controls' });
    
    if (state.status !== 'running') {
      const playBtn = controls.createEl('button', { text: 'Start' });
      playBtn.addEventListener('click', () => this.plugin.timer.start());
    } else {
      const pauseBtn = controls.createEl('button', { text: 'Pause' });
      pauseBtn.addEventListener('click', () => this.plugin.timer.pause());
    }

    const stopBtn = controls.createEl('button', { text: 'Reset' });
    stopBtn.addEventListener('click', () => this.plugin.timer.stop());

    // Work Queue
    const queueEl = this.containerEl.createDiv({ cls: 'pomodoro-queue' });
    queueEl.createEl('h3', { text: 'Work Queue' });
    
    const entries = this.data?.data || [];
    if (entries.length === 0) {
      queueEl.createEl('p', { text: 'No tasks found.' });
      return;
    }

    const ul = queueEl.createEl('ul');
    for (const entry of entries) {
      const li = ul.createEl('li');
      const taskBtn = li.createEl('button', { text: entry.file.basename });
      if (state.activeFilePath === entry.file.path) {
        li.addClass('is-active-task');
      }
      taskBtn.addEventListener('click', () => {
        this.plugin.timer.start(entry.file.path);
      });
    }
  }

  static getViewOptions(): ViewOption[] {
    return [];
  }
}
