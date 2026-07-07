import { BasesView } from 'obsidian'
import type { ViewOption, QueryController, App, TFile } from 'obsidian'
import type PomodoroPlugin from '../main'
import type { EngineState } from '../domain/session/engine-state'
import type { PhaseGraph } from '../domain/phase/phase-graph'
import { findPhaseById, FOCUS_PHASE_KIND, POMODORO_PHASE_GRAPH } from '../timer/phase-graph'
import { decideStartAction, resolveRoutineGraph } from '../timer/routine-selection'
import type { RoutineResolution } from '../timer/routine-selection'
import { RoutineReplaceModal } from './routine-replace-modal'

export class PomodoroTimerView extends BasesView {
  readonly type = 'pomodoro-timer'
  containerEl: HTMLElement
  private plugin: PomodoroPlugin
  private unsubscribe: (() => void) | null = null
  private routineFilePath: string | null = null
  private routineResolution: RoutineResolution = { kind: 'default', graph: POMODORO_PHASE_GRAPH }

  constructor(controller: QueryController, containerEl: HTMLElement, plugin: PomodoroPlugin) {
    super(controller)
    this.containerEl = containerEl
    this.plugin = plugin
  }

  onload() {
    this.unsubscribe = this.plugin.store.subscribe((state) => {
      this.render(state)
    })
    this.render(this.plugin.store.getState())
  }

  onunload() {
    if (this.unsubscribe) {
      this.unsubscribe()
    }
  }

  onDataUpdated() {
    this.render(this.plugin.store.getState())
  }

  private render(state: EngineState) {
    this.containerEl.empty()

    const configuredPath = this.getConfiguredRoutineFilePath()
    if (configuredPath !== this.routineFilePath) {
      this.routineFilePath = configuredPath
      this.routineResolution = configuredPath === null ? { kind: 'default', graph: POMODORO_PHASE_GRAPH } : { kind: 'loading' }
      if (configuredPath !== null) {
        void this.loadRoutineFile(configuredPath)
      }
    }

    if (this.routineResolution.kind === 'error') {
      this.containerEl.createEl('p', { text: `Routine error: ${this.routineResolution.error.message}`, cls: 'pomodoro-routine-error' })
      return
    }

    if (this.routineResolution.kind === 'loading') {
      this.containerEl.createEl('p', { text: 'Loading routine…', cls: 'pomodoro-routine-loading' })
      return
    }

    const viewGraph = this.routineResolution.graph

    const graph = this.plugin.store.getGraph()
    const phase = findPhaseById(graph, state.currentPhaseId)
    if (!phase || state.remaining === null) {
      return
    }

    const isViewRoutineActive = graph.id === viewGraph.id

    // Timer Panel
    const timerPanel = this.containerEl.createDiv({ cls: 'pomodoro-timer-panel' })
    const totalSeconds = state.remaining.total({ unit: 'seconds' })
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0')
    timerPanel.createEl('h2', { text: `${phase.label}: ${mins}:${secs} (${state.status})` })

    if (!isViewRoutineActive && state.status !== 'stopped') {
      timerPanel.createEl('p', { text: `"${graph.name}" is currently active instead of this view's routine ("${viewGraph.name}").`, cls: 'pomodoro-routine-inert' })
    }

    // Controls
    const controls = this.containerEl.createDiv({ cls: 'pomodoro-controls' })

    if (isViewRoutineActive && state.status === 'running') {
      const pauseBtn = controls.createEl('button', { text: 'Pause' })
      pauseBtn.addEventListener('click', () => void this.plugin.store.dispatch({ type: 'pause' }))
    }
    else {
      const playBtn = controls.createEl('button', { text: 'Start' })
      playBtn.addEventListener('click', () => void this.handleStart(viewGraph))
    }

    const stopBtn = controls.createEl('button', { text: 'Reset' })
    stopBtn.addEventListener('click', () => void this.plugin.store.dispatch({ type: 'stop' }))

    // Determine phase type to choose appropriate filters
    const isFocus = phase.kind === FOCUS_PHASE_KIND
    const queueTitle = isFocus ? 'Work queue' : 'Break queue'
    const propId = isFocus ? this.config?.getAsPropertyId('focusProperty') : this.config?.getAsPropertyId('breakProperty')
    const rawTargetVal = isFocus ? this.config?.get('focusValue') : this.config?.get('breakValue')
    const targetValFallback = isFocus ? 'work' : 'break'
    const targetVal = typeof rawTargetVal === 'string' && rawTargetVal ? rawTargetVal : targetValFallback

    const entries = this.data?.data || []
    const filteredEntries = entries.filter((entry) => {
      if (!propId) {
        return isFocus
      }
      const valObj = entry.getValue(propId)
      const valStr = valObj ? valObj.toString() : ''
      return valStr.toLowerCase() === targetVal.toLowerCase()
    })

    // Queue Panel
    const queueEl = this.containerEl.createDiv({ cls: 'pomodoro-queue' })
    queueEl.createEl('h3', { text: queueTitle })

    if (filteredEntries.length === 0) {
      queueEl.createEl('p', { text: 'No tasks found.' })
      return
    }

    const ul = queueEl.createEl('ul')
    for (const entry of filteredEntries) {
      const li = ul.createEl('li')
      const taskBtn = li.createEl('button', { text: entry.file.basename })
      if (state.activeFilePath === entry.file.path) {
        li.addClass('is-active-task')
      }
      taskBtn.addEventListener('click', () => {
        void this.plugin.store.dispatch({ type: 'start', filePath: entry.file.path })
      })
    }
  }

  private getConfiguredRoutineFilePath(): string | null {
    const raw = this.config?.get('routineFile')
    return typeof raw === 'string' && raw.length > 0 ? raw : null
  }

  private async loadRoutineFile(path: string): Promise<void> {
    const file = this.plugin.app.vault.getFileByPath(path)
    const resolution: RoutineResolution = file === null
      ? { kind: 'error', error: { message: `Routine file not found: ${path}` } }
      : resolveRoutineGraph(await this.plugin.app.vault.cachedRead(file))

    // Only apply if still the current selection — the user may have picked a different file mid-load.
    if (this.routineFilePath === path) {
      this.routineResolution = resolution
      this.render(this.plugin.store.getState())
    }
  }

  private async handleStart(graph: PhaseGraph): Promise<void> {
    const activeGraph = this.plugin.store.getGraph()
    const action = decideStartAction(
      { graphId: activeGraph.id, status: this.plugin.store.getState().status },
      graph.id,
    )

    if (action === 'confirm') {
      const result = await new RoutineReplaceModal(this.plugin.app, activeGraph.name, graph.name).waitForResult()
      if (result !== 'confirmed') {
        return
      }
    }

    if (activeGraph.id !== graph.id) {
      this.plugin.store.setGraph(graph)
    }
    void this.plugin.store.dispatch({ type: 'start' })
  }

  static getViewOptions(app: App): ViewOption[] {
    return [
      {
        key: 'focusProperty',
        type: 'property',
        displayName: 'Focus task property',
        default: 'note.type',
      },
      {
        key: 'focusValue',
        type: 'text',
        displayName: 'Focus task value',
        default: 'work',
      },
      {
        key: 'breakProperty',
        type: 'property',
        displayName: 'Break task property',
        default: 'note.type',
      },
      {
        key: 'breakValue',
        type: 'text',
        displayName: 'Break task value',
        default: 'break',
      },
      {
        key: 'routineFile',
        type: 'file',
        displayName: 'Routine file',
        filter: (file: TFile) => app.metadataCache.getFileCache(file)?.frontmatter?.['pomodoro-routine'] === true,
      },
    ]
  }
}
