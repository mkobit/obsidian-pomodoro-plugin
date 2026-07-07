import { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, type PomodoroSettings, PomodoroSettingTab } from './settings'
import { EngineStore } from './timer/store'
import { TimerTicker } from './timer/ticker'
import { POMODORO_PHASE_GRAPH, findPhaseById } from './timer/phase-graph'
import { ObsidianFileMutationPort } from './timer/obsidian-file-mutation-port'
import { ObsidianFrontmatterReader } from './timer/obsidian-frontmatter-reader'
import { writeBackPhaseCompletion } from './timer/write-back'
import type { WriteBackDeps } from './timer/write-back'
import { PomodoroTimerView } from './views/timer-view'
import { ObsidianWriteBackPromptPort } from './views/write-back-modal'

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

    const writeBackDeps: WriteBackDeps = {
      // No named log-target resolver (e.g. 'dailyNote') is registered yet — see design.md decision 2.
      logTargetResolverRegistry: { resolve: () => undefined },
      frontmatterReader: new ObsidianFrontmatterReader(this.app),
      fileMutationPort: port,
      writeBackPrompt: new ObsidianWriteBackPromptPort(this.app),
    }

    // Handle background ticker transitions
    let lastState = this.store.getState()
    this.store.subscribe((state) => {
      if (state.status === 'running') {
        this.ticker.start()
      }
      else {
        this.ticker.stop()
      }

      if (lastState.currentPhaseId !== state.currentPhaseId) {
        const lastPhase = findPhaseById(this.store.getGraph(), lastState.currentPhaseId)
        if (lastPhase) {
          void writeBackPhaseCompletion(lastPhase, lastState.activeFilePath, this.settings.writeBackProperty, writeBackDeps).then((result) => {
            if (result.kind === 'applied' && !result.result.success) {
              // eslint-disable-next-line no-console -- no Notice yet for write-back failures, see design.md decision 6
              console.error('Pomodoro write-back failed', result.result)
            }
            return undefined
          }, (cause: unknown) => {
            // eslint-disable-next-line no-console -- mirrors the applied-but-failed branch above; keeps a resolution/read failure from becoming an unhandled rejection
            console.error('Pomodoro write-back failed', cause)
          })
        }
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
        options: () => PomodoroTimerView.getViewOptions(this.app),
      },
    )

    this.addSettingTab(new PomodoroSettingTab(this.app, this))
  }

  onunload() {
    this.ticker.stop()
  }

  async loadSettings() {
    const loaded: Partial<PomodoroSettings> = await this.loadData()
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded)
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}
