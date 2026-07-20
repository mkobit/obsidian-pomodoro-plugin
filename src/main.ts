import { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, type PomodoroSettings, PomodoroSettingTab } from './settings'
import { EngineStore } from './timer/store'
import type { HookEventApplication } from './timer/store'
import { TimerTicker } from './timer/ticker'
import { POMODORO_PHASE_GRAPH } from './timer/phase-graph'
import { ObsidianFileMutationPort } from './timer/obsidian-file-mutation-port'
import { ObsidianFrontmatterReader } from './timer/obsidian-frontmatter-reader'
import { createWriteBackHook, WRITE_BACK_HOOK_NAME } from './timer/write-back'
import type { HookRegistry } from './domain/hook/hook'
import type { PredicateRegistry } from './domain/hook/predicate'
import { createTaskSourceRegistry } from './timer/task-source-registry'
import type { MutableTaskSourceRegistry } from './timer/task-source-registry'
import { PomodoroTimerView } from './views/timer-view'
import { ObsidianWriteBackPromptPort } from './views/write-back-modal'

/** Surfaces a dispatched hook's failed FileMutation applications — mirrors the reporting main.ts's old write-back subscriber did inline. */
function reportFailedHookApplications(applications: readonly HookEventApplication[]): void {
  for (const application of applications) {
    if (!application.result.success) {
      // eslint-disable-next-line no-console -- no Notice yet for write-back failures, see design.md decision 6
      console.error('Pomodoro write-back failed', application.result)
    }
  }
}

export default class PomodoroPlugin extends Plugin {
  public settings: PomodoroSettings = DEFAULT_SETTINGS
  public store!: EngineStore
  public ticker!: TimerTicker
  public taskSourceRegistry: MutableTaskSourceRegistry = createTaskSourceRegistry()

  async onload() {
    await this.loadSettings()
    const port = new ObsidianFileMutationPort(this.app)

    const writeBackHook = createWriteBackHook({
      // No named log-target resolver (e.g. 'dailyNote') is registered yet — see design.md decision 2.
      logTargetResolverRegistry: { resolve: () => undefined },
      frontmatterReader: new ObsidianFrontmatterReader(this.app),
      writeBackPrompt: new ObsidianWriteBackPromptPort(this.app),
      getWriteBackProperty: () => this.settings.writeBackProperty,
    })
    const hookRegistry: HookRegistry = {
      resolve: name => name === WRITE_BACK_HOOK_NAME ? writeBackHook : undefined,
    }
    // No custom TransitionCondition predicate registered anywhere yet — see flow-b74/flow-gu1.10.
    const predicateRegistry: PredicateRegistry = { resolve: () => undefined }
    this.store = new EngineStore(POMODORO_PHASE_GRAPH, { hookRegistry, port, predicateRegistry, taskSourceRegistry: this.taskSourceRegistry })
    this.ticker = new TimerTicker((action) => {
      void this.store.dispatch(action).then(reportFailedHookApplications, (cause: unknown) => {
        // eslint-disable-next-line no-console -- no Notice yet for write-back failures, see design.md decision 6
        console.error('Pomodoro hook dispatch failed', cause)
      })
    })

    // Handle background ticker transitions
    this.store.subscribe((state) => {
      if (state.status === 'running') {
        this.ticker.start()
      }
      else {
        this.ticker.stop()
      }
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
