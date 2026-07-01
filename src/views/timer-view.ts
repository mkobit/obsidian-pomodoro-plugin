import { BasesView } from 'obsidian'
import type { ViewOption, QueryController } from 'obsidian'
import type PomodoroPlugin from '../main'
import type { EngineState } from '../domain/session/engine-state'
import { findPhaseById, FOCUS_PHASE_KIND } from '../timer/phase-graph'

export class PomodoroTimerView extends BasesView {
  readonly type = 'pomodoro-timer'
  containerEl: HTMLElement
  private plugin: PomodoroPlugin
  private unsubscribe: (() => void) | null = null

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

    const graph = this.plugin.store.getGraph()
    const phase = findPhaseById(graph, state.currentPhaseId)
    if (!phase || state.remaining === null) {
      return
    }

    // Timer Panel
    const timerPanel = this.containerEl.createDiv({ cls: 'pomodoro-timer-panel' })
    const totalSeconds = state.remaining.total({ unit: 'seconds' })
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0')
    timerPanel.createEl('h2', { text: `${phase.label}: ${mins}:${secs} (${state.status})` })

    // Controls
    const controls = this.containerEl.createDiv({ cls: 'pomodoro-controls' })

    if (state.status !== 'running') {
      const playBtn = controls.createEl('button', { text: 'Start' })
      playBtn.addEventListener('click', () => this.plugin.store.dispatch({ type: 'start' }))
    }
    else {
      const pauseBtn = controls.createEl('button', { text: 'Pause' })
      pauseBtn.addEventListener('click', () => this.plugin.store.dispatch({ type: 'pause' }))
    }

    const stopBtn = controls.createEl('button', { text: 'Reset' })
    stopBtn.addEventListener('click', () => this.plugin.store.dispatch({ type: 'stop' }))

    // Determine phase type to choose appropriate filters
    const isFocus = phase.kind === FOCUS_PHASE_KIND
    const queueTitle = isFocus ? 'Work queue' : 'Break queue'
    const propId = isFocus ? this.config.getAsPropertyId('focusProperty') : this.config.getAsPropertyId('breakProperty')
    const targetVal = isFocus
      ? (this.config.get('focusValue') as string || 'work')
      : (this.config.get('breakValue') as string || 'break')

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
        this.plugin.store.dispatch({ type: 'start', filePath: entry.file.path })
      })
    }
  }

  static getViewOptions(): ViewOption[] {
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
    ]
  }
}
