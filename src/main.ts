import { Plugin, TFile } from 'obsidian'
import { DEFAULT_SETTINGS, type PomodoroSettings, PomodoroSettingTab } from './settings'
import { EngineStore } from './timer/store'
import { TimerTicker } from './timer/ticker'
import { POMODORO_PHASE_GRAPH, FOCUS_PHASE_KIND, findPhaseById } from './timer/phase-graph'
import { ObsidianFileMutationPort } from './timer/obsidian-file-mutation-port'
import { PomodoroTimerView } from './views/timer-view'

export default class PomodoroPlugin extends Plugin {
  public settings: PomodoroSettings = DEFAULT_SETTINGS
  public store!: EngineStore
  public ticker!: TimerTicker

  async onload() {
    await this.loadSettings()
    const port = new ObsidianFileMutationPort(this.app)
    // No phase currently sets onEnter/onComplete/onSkip/onExit, so there's nothing to resolve yet.
    const hookRegistry = { resolve: () => undefined }
    this.store = new EngineStore(POMODORO_PHASE_GRAPH, hookRegistry, port)
    this.ticker = new TimerTicker(action => void this.store.dispatch(action))

    // Handle background ticker transitions
    let lastState = this.store.getState()
    this.store.subscribe((state) => {
      if (state.status === 'running') {
        this.ticker.start()
      }
      else {
        this.ticker.stop()
      }

      // Write back when a focus-kind phase completes and advances
      const lastPhase = findPhaseById(this.store.getGraph(), lastState.currentPhaseId)
      if (
        lastState.currentPhaseId !== state.currentPhaseId
        && lastPhase?.kind === FOCUS_PHASE_KIND
        && state.activeFilePath
      ) {
        void this.handlePhaseComplete(state.activeFilePath)
      }
      lastState = state
    })

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
    )

    this.addSettingTab(new PomodoroSettingTab(this.app, this))
  }

  private async handlePhaseComplete(filePath: string) {
    const file = this.app.vault.getAbstractFileByPath(filePath)
    if (!file || !(file instanceof TFile)) {
      return
    }
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      const prop = this.settings.writeBackProperty
      const current = frontmatter[prop]
      if (typeof current === 'number') {
        frontmatter[prop] = current + 1
      }
      else {
        frontmatter[prop] = 1
      }
    })
  }

  onunload() {
    this.ticker.stop()
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData() as Partial<PomodoroSettings>,
    )
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}
